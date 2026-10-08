import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — reduced motion (1440×900, prefers-reduced-motion: reduce).
 *
 * Veeresh 2026-10-07: Comet hosts from the banner — in-flow, right of the
 * "Meridian" h1 in `.atlas-banner-row` (80px desktop). The greeting bubble
 * opens DOWNWARD (tail up), and the auto-greeting stays quiet while the
 * first-run tutorial invite is up (`suppressAuto`).
 *
 * Covers: banner position + bubble direction, cursor tracking disabled
 * (static pose), the greeting text appears instantly (no word-by-word),
 * the mascot stays tappable, no console errors. Audio timing is unchanged
 * by reduced motion.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

async function loadHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("comet-mascot")).toBeVisible({ timeout: 20_000 });
  return errors;
}

/**
 * Dismiss the first-run tutorial invite when present. While it is up,
 * `suppressAuto` keeps the auto-greeting quiet; dismissing it lets the
 * greeting start (once), so greeting-dependent tests call this first.
 */
async function dismissInvite(page: Page): Promise<void> {
  const invite = page.getByTestId("tutorial-invite");
  if ((await invite.count()) > 0) {
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(invite).toHaveCount(0);
  }
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("banner position is in-flow with the bubble opening below", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  const wrap = page.getByTestId("comet-wrap");
  const banner = page.locator(".atlas-banner-row");
  const h1 = page.locator("h1.atlas-title");

  const mBox = await mascot.boundingBox();
  const bBox = await banner.boundingBox();
  const hBox = await h1.boundingBox();
  expect(mBox, "mascot has a box").not.toBeNull();
  expect(bBox, "banner row has a box").not.toBeNull();
  expect(hBox, "h1 has a box").not.toBeNull();

  // 72–88px desktop.
  expect(mBox!.width).toBeGreaterThanOrEqual(72);
  expect(mBox!.width).toBeLessThanOrEqual(88);
  // In-flow, not fixed: the old bottom-right wrapper is retired.
  expect(await wrap.evaluate((el) => getComputedStyle(el).position)).toBe("relative");
  // Right of the h1's right edge, inside the banner row.
  expect(mBox!.x).toBeGreaterThanOrEqual(hBox!.x + hBox!.width);
  expect(mBox!.y).toBeGreaterThanOrEqual(bBox!.y - 2);
  expect(mBox!.y + mBox!.height).toBeLessThanOrEqual(bBox!.y + bBox!.height + 2);

  // Bubble direction: dismiss the invite so the greeting can start, then
  // the bubble must open BELOW the emblem (tail up), not upward.
  // Re-measure the mascot after the dismiss — the invite is in-flow, so
  // the banner shifts up when it unmounts and the earlier box is stale.
  await dismissInvite(page);
  const mBox2 = await mascot.boundingBox();
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  const gBox = await bubble.boundingBox();
  expect(gBox!.y).toBeGreaterThanOrEqual(mBox2!.y + mBox2!.height - 2);
  expectCleanConsole(errors);
});

test("reduced motion disables cursor tracking", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "off");
  const pupils = page.getByTestId("comet-pupils");
  await expect.poll(async () => pupils.getAttribute("style")).toContain("translate(0px, 0px)");
  // Sweep the pointer across the viewport: the pose must not move.
  await page.mouse.move(60, 60);
  await page.waitForTimeout(400);
  await page.mouse.move(1300, 200);
  await page.waitForTimeout(400);
  await expect.poll(async () => pupils.getAttribute("style")).toContain("translate(0px, 0px)");
  expectCleanConsole(errors);
});

test("reduced motion shows the full greeting text instantly", async ({ page }) => {
  const errors = await loadHome(page);
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  // No word-by-word: every word is shown on the first paint.
  const hidden = await page.locator(".comet-greeting-word:not(.shown)").count();
  expect(hidden).toBe(0);
  const text = await page.getByTestId("comet-greeting-text").getAttribute("aria-label");
  expect(text).toBeTruthy();
  expect(text!.length).toBeGreaterThan(20);
  expectCleanConsole(errors);
});

test("mascot stays tappable under reduced motion", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await mascot.click();
  // Instant reaction swap, no squash animation — the state still cycles.
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});
