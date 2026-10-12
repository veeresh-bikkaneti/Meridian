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
