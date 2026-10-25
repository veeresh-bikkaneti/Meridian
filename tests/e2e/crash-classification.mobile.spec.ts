import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * TEST cell — crash-classification fix (branch
 * fix/crash-report-background-classification).
 *
 * Root cause: Android routinely kills backgrounded tabs for memory, and the
 * next-boot asymmetry detector cannot distinguish that from a genuine
 * foreground crash — both surface as `suspected_crash` with no error and
 * the same last-milestone. The fix records `backgrounded`/`foregrounded`
 * milestones on visibilitychange, so every future report self-classifies.
 *
 * Black-box journey on a phone viewport (390×844, touch): fresh boot →
 * simulate the tab being backgrounded (visibilityState hidden +
 * visibilitychange, the exact signals Android Chrome fires) → the
 * breadcrumb trail in sessionStorage must end at "backgrounded" → simulate
 * return → trail ends at "foregrounded". Asserts the real handler running
 * in the real browser, never implementation internals alone.
 */

test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const BREADCRUMB_KEY = "meridian.breadcrumb";

async function readBreadcrumb(page: Page): Promise<{ lastMilestone: string; history: Array<{ name: string }> } | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { lastMilestone: string; history: Array<{ name: string }> }) : null;
  }, BREADCRUMB_KEY);
}

async function setVisibility(page: Page, state: "hidden" | "visible"): Promise<void> {
  await page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

/**
 * Slice 1 journey (crash-report verdicts): a killed session's next boot
 * emits exactly one `suspected_crash` carrying the verdict evidence
 * stamps (bgTerminal / buildReplaced / trailStuck / storageOk / lcV /
 * provisional verdict + whyKey). Seeding mirrors observability.spec.ts:
 * an init script writes the state a kill leaves behind (cleanExit "0" +
 * previous breadcrumb) exactly once, and flags.json is stubbed to carry
 * the observability endpoint (intercepted — no real network).
 */
const ENDPOINT = "https://meridian-crash-report.knowledgetest.workers.dev/ingest";

async function seedKillAndCollect(
  context: Parameters<typeof serveBuiltArtifact>[0],
  trail: { lastMilestone: string; history: Array<{ name: string; at: number }> },
): Promise<Array<Record<string, unknown>>> {
  const ingested: Array<Record<string, unknown>> = [];
  await context.route("**/flags.json*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        flags: { learningOutcomes: true, pwaUpdateToast: true },
        observabilityEndpoint: ENDPOINT,
      }),
    });
  });
  await context.route(ENDPOINT, async (route) => {
    try {
      ingested.push(route.request().postDataJSON() as Record<string, unknown>);
    } catch {
      ingested.push({});
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await context.addInitScript((t) => {
    if (sessionStorage.getItem("meridian.verdictSeeded")) return;
    sessionStorage.setItem("meridian.verdictSeeded", "1");
    sessionStorage.setItem("meridian.cleanExit", "0");
    sessionStorage.setItem(
      "meridian.breadcrumb",
      JSON.stringify({
        sessionId: "prev-verdict-session",
        buildId: "prev-build",
        startedAt: Date.now() - 60_000,
        lastMilestone: t.lastMilestone,
        history: t.history,
        edition: "state",
        regionId: "nebraska",
        device: { ua: "e2e", dpr: 2, screenW: 414, screenH: 896 },
      }),
    );
  }, trail);
  return ingested;
}

const HIST = (...names: string[]) =>
  names.map((name, i) => ({ name, at: Date.now() - 60_000 + i * 1000 }));

test("next boot after a backgrounded kill emits suspected_crash carrying the Slice 1 stamps and the ignore verdict", async ({ context }) => {
  const ingested = await seedKillAndCollect(context, {
    lastMilestone: "backgrounded",
    history: HIST("boot_start", "run_start", "game_loaded", "backgrounded"),
  });
  const page = await context.newPage();
  await page.goto(APP);
  await expect
    .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, { timeout: 20_000 })
    .toBe(1);
  const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
  expect(crash.bgTerminal).toBe(true);
  expect(crash.trailStuck).toBe(false);
  expect(crash.buildReplaced).toBe(true);
  expect(crash.storageOk).toBe(true);
  expect(crash.lcV).toBe("1");
  expect(crash.verdict).toBe("not_a_real_issue");
  expect(crash.whyKey).toBe("bg_close");
  await page.close();
});

test("next boot after a foreground gameplay kill emits suspected_crash with bgTerminal=false and the replaced-build verdict", async ({ context }) => {
  const ingested = await seedKillAndCollect(context, {
    lastMilestone: "game_loaded",
    history: HIST("boot_start", "backgrounded", "foregrounded", "run_start", "game_loaded"),
  });
  const page = await context.newPage();
  await page.goto(APP);
  await expect
    .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, { timeout: 20_000 })
    .toBe(1);
  const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
  expect(crash.bgTerminal).toBe(false);
  expect(crash.buildReplaced).toBe(true);
  expect(crash.storageOk).toBe(true);
  expect(crash.lcV).toBe("1");
  expect(crash.verdict).toBe("insufficient_evidence");
  expect(crash.whyKey).toBe("fg_kill_replaced");
  await page.close();
});

test("next boot after a kill with no visibility record emits suspected_crash with bgTerminal absent and the can't-tell verdict", async ({ context }) => {
  // Fail closed (Reality Checker blocker, 2026-10-25): a trail that
  // records no visibility transition has an unknown terminal visibility
  // state — the stamp is omitted, never inferred from lastMilestone,
  // and the provisional verdict is missing_fields, never benign.
  const ingested = await seedKillAndCollect(context, {
    lastMilestone: "game_loaded",
    history: HIST("boot_start", "run_start", "game_loaded"),
  });
  const page = await context.newPage();
  await page.goto(APP);
  await expect
    .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, { timeout: 20_000 })
    .toBe(1);
  const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
  expect(crash.bgTerminal).toBeUndefined();
  expect(crash.buildReplaced).toBe(true);
  expect(crash.storageOk).toBe(true);
  expect(crash.lcV).toBe("1");
  expect(crash.verdict).toBe("insufficient_evidence");
  expect(crash.whyKey).toBe("missing_fields");
  await page.close();
});

test("backgrounding the tab records 'backgrounded'; returning records 'foregrounded'", async ({ page }) => {
  await page.goto(APP);
  // Wait for observability init to write the breadcrumb trail.
  await page.waitForFunction(
    (key) => sessionStorage.getItem(key) !== null,
    BREADCRUMB_KEY,
    { timeout: 30_000 },
  );

  const before = await readBreadcrumb(page);
  expect(before).not.toBeNull();
  expect(before!.lastMilestone).not.toBe("backgrounded");

  // Android backgrounds the tab (user switches apps / locks the phone).
  await setVisibility(page, "hidden");
  const bg = await readBreadcrumb(page);
  expect(bg?.lastMilestone).toBe("backgrounded");
  expect(bg?.history[bg.history.length - 1]?.name).toBe("backgrounded");

  // User returns to the tab.
  await setVisibility(page, "visible");
  const fg = await readBreadcrumb(page);
  expect(fg?.lastMilestone).toBe("foregrounded");
});
