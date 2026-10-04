import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  commitHit,
  clickNextPlace,
  readPhase,
  resultCard,
} from "./helpers";

/**
 * Learning-outcomes prototype E2E (built Pages artifact, base path /Meridian/).
 *
 * Verifies the flag-gated contract end to end:
 *
 * - flag OFF (default): no `meridian:learning:v1` key is created, no growth
 *   line renders on the reveal card, no "My growth" section on the summary —
 *   the app is prod-identical.
 * - flag ON: each pin commit writes a per-place learning record (placeId,
 *   edition, region, distance, radius, hit, score), the reveal card shows
 *   the kid-friendly growth line, and the end-game summary shows "My growth".
 * - reload persistence: the record survives a reload and the growth line
 *   recomputes identically from the persisted record.
 * - unreachable flags.json: baked-in default (false) wins silently — no
 *   records, no growth UI, boot unaffected.
 *
 * flags.json is route-intercepted per test (same pattern as
 * feature-flags.spec.ts). The learning effect AWAITS the memoized
 * loadFlags() before reading the flag, so the on-position wins the
 * boot-time race deterministically.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const LEARNING_KEY = "meridian:learning:v1";

// React #418 is a pre-existing flaky hydration warning in this build — it
// comes and goes on unmodified loads, so it is excluded from the error
// assertions here exactly as in tests/e2e/feature-flags.spec.ts.
function relevantErrors(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const flagsBody = (learningOutcomes: boolean) =>
  JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes } });

async function fulfillFlagsJson(
  context: import("playwright/test").BrowserContext,
  body: string,
  opts: { status?: number } = {},
) {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: opts.status ?? 200,
      body,
      contentType: "application/json; charset=utf-8",
    });
  });
}

async function learningStoreRaw(page: import("playwright/test").Page) {
  return page.evaluate((key) => localStorage.getItem(key), LEARNING_KEY);
}

async function learningStore(page: import("playwright/test").Page) {
  const raw = await learningStoreRaw(page);
  return raw ? JSON.parse(raw) : null;
}

/** Type-narrowing assertion for the polled store payload. */
function assertStore(
  store: unknown,
): asserts store is {
  records: Record<string, { placeId: string; attempts: Array<{ [k: string]: unknown }> }>;
  regionNames: Record<string, string>;
  daysPlayed: string[];
} {
  if (!store || typeof store !== "object" || !("records" in store)) {
    throw new Error(`expected a learning store, got: ${JSON.stringify(store)?.slice(0, 120)}`);
  }
}

async function endGameToSummary(page: import("playwright/test").Page) {
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("flag off: no learning key, no growth line, no growth section — prod-identical", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(false));

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startGlobeRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  // No growth UI at all.
  await expect(card.getByTestId("growth-line")).toBeHidden();
  // No trace in storage.
  expect(await learningStoreRaw(page)).toBeNull();

  // The card content is untouched: the miss card's blurb lede still renders.
  await expect(card.getByTestId("miss-subscript")).toBeVisible({ timeout: 5_000 });

  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  const dialog = await endGameToSummary(page);
  await expect(dialog.getByTestId("growth-section")).toBeHidden();
  expect(await learningStoreRaw(page)).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

test("flag on: miss → record written, first-encounter growth line shows", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startGlobeRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });

  // First-encounter miss line from the copy bank.
  const line = card.getByTestId("growth-line");
  await expect(line).toBeVisible({ timeout: 10_000 });
  await expect(line).toContainText("Good try — you'll get this one.");

  // The record landed in localStorage with the commit's own data.
  await expect
    .poll(() => learningStore(page), { timeout: 10_000 })
    .not.toBeNull();
  const store = await learningStore(page);
  assertStore(store);
  const ids = Object.keys(store.records);
  expect(ids).toHaveLength(1);
  const record = store.records[ids[0]];
  expect(record.attempts).toHaveLength(1);
  const a = record.attempts[0];
  expect(a.hit).toBe(false);
  expect(a.edition).toBe("globe");
  expect(typeof a.distanceKm).toBe("number");
  expect(a.distanceKm).toBeGreaterThan(0);
  expect(a.radiusKm).toBeGreaterThan(0);
  expect(typeof a.at).toBe("number");
  expect(store.regionNames[a.regionId]).toBeTruthy();
  expect(store.daysPlayed).toHaveLength(1);

  // Card content is untouched: the miss card's blurb lede still renders
  // above the growth line (the story scroller only exists when storyRest
  // is non-empty, so the lede is the stable blurb assertion here).
  await expect(card.getByTestId("miss-subscript")).toBeVisible({ timeout: 5_000 });

  expect(relevantErrors(errors)).toEqual([]);
});

test("flag on: hit on a new place → 'Great first try!'; summary shows My growth", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  await startGlobeRun(page);
  await commitHit(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("growth-line");
  await expect(line).toBeVisible({ timeout: 10_000 });
  await expect(line).toContainText("Great first try!");

  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  const dialog = await endGameToSummary(page);
  const growth = dialog.getByTestId("growth-section");
  await expect(growth).toBeVisible();
  await expect(growth.getByRole("heading", { name: "My growth" })).toBeVisible();
  await expect(growth).toContainText("Places explored");
  await expect(growth).toContainText("Places mastered");
  await expect(growth).toContainText("Day streak");
  // No trend note yet: not enough regional data (honest silence, not a fake).
  await expect(growth).not.toContainText("landing closer");

  // Share text is unchanged: learning records never leave the device.
  await expect(dialog.getByText("Share score")).toBeVisible();
});

test("flag on: reload keeps the record; the growth line recomputes identically", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  await startGlobeRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  const lineText = await card.getByTestId("growth-line").textContent();
  expect(lineText).toContain("Good try — you'll get this one.");

  const storeBefore = await learningStore(page);
  expect(storeBefore).not.toBeNull();

  // Reload mid-reveal: the card rehydrates from the saved drop, and the
  // growth line recomputes from the persisted record (no React state needed).
  await page.reload();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 20_000 });
  const cardAfter = resultCard(page);
  await expect(cardAfter).toBeVisible({ timeout: 15_000 });
  const lineAfter = cardAfter.getByTestId("growth-line");
  await expect(lineAfter).toBeVisible({ timeout: 10_000 });
  await expect(lineAfter).toContainText("Good try — you'll get this one.");

  const storeAfter = await learningStore(page);
  expect(storeAfter).toEqual(storeBefore);
});

test("flags.json unreachable → default (false): no records, no growth UI, boot fine", async ({
  page,
  context,
}) => {
  await context.route(FLAGS_PATTERN, (route) => route.abort("failed"));

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startGlobeRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByTestId("growth-line")).toBeHidden();
  expect(await learningStoreRaw(page)).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

test("flag on: the track never touches the no-repeat dealing history (observational)", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  await startGlobeRun(page);
  for (let i = 0; i < 3; i++) {
    await commitMiss(page);
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }

  // The dealer's seen-history is intact and the learning track wrote only
  // its own key (unit tests prove the same for the pure module; this proves
  // it for the wired hook in the real browser). Every place the hook
  // recorded was also recorded by the dealer — the hook neither adds to
  // nor removes from the no-repeat history.
  const seen = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    const seenKey = keys.find((k) => k.startsWith("meridian:seen:v2:"));
    const learningKeys = keys.filter((k) => k.startsWith("meridian:learning"));
    const learningStoreRaw = localStorage.getItem("meridian:learning:v1");
    return {
      seenKey,
      seen: seenKey ? (JSON.parse(localStorage.getItem(seenKey)!) as string[]) : [],
      learningKeys,
      learnedIds: learningStoreRaw
        ? Object.keys(JSON.parse(learningStoreRaw).records as Record<string, unknown>)
        : [],
    };
  });
  expect(seen.seenKey).toBe("meridian:seen:v2:globe:globe:medium");
  expect(seen.seen.length).toBeGreaterThanOrEqual(3);
  expect(seen.learningKeys).toEqual([LEARNING_KEY]);
  for (const id of seen.learnedIds) {
    expect(seen.seen).toContain(id);
  }
});
