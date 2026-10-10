import { test, expect } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun } from "./helpers";

/**
 * Hint button E2E (follow-up Item A — hints are a REAL feature).
 *
 * - 5-7 ("free"): hint button visible and enabled; tapping shows a
 *   directional hint; multiple hints allowed.
 * - 8-10 ("one-per-round"): button visible and enabled initially;
 *   disables after one use on the place.
 * - 11-13 ("none"): NO hint button at all (Clean Round stays earnable).
 * - 5-7 mascot offer: after 2 misses, an opt-in offer appears.
 */

const PROFILE_KEY = "meridian.ageProfile.v1";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Seed an active age profile before page load. */
async function seedProfile(
  context: import("playwright/test").BrowserContext,
  band: "5-7" | "8-10" | "11-13",
) {
  await context.addInitScript((b: string) => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: b,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 1,
      }),
    );
  }, band);
}

/** Seed a 5-7 profile, size the viewport, and start a globe run. */
async function startSizedRun(
  page: import("playwright/test").Page,
  context: import("playwright/test").BrowserContext,
  w: number,
  h: number,
) {
  await seedProfile(context, "5-7");
  await page.setViewportSize({ width: w, height: h });
  await startGlobeRun(page);
}

/**
 * Bounding-box intersection area (px²) between the open question bubble
 * and one hint-cluster element. Follows the dismiss-overlap.mobile.spec.ts
 * pattern: 0px² at both mobile widths is the gate.
 */
async function hintOverlapArea(
  page: import("playwright/test").Page,
  hintTestId: "hint-button" | "hint-message" | "hint-offer",
  w: number,
  h: number,
): Promise<number> {
  const bubble = page.locator(".bubble-shell");
  await bubble.waitFor({ state: "visible", timeout: 30_000 });
  // Let the bubble's enter transition settle so the box is final.
  await page.waitForTimeout(600);
  const hint = page.getByTestId(hintTestId);
  const b = await bubble.boundingBox();
  const t = await hint.boundingBox();
  if (!b || !t) throw new Error(`missing box @${w}x${h} (${hintTestId})`);
  const ix = Math.max(0, Math.min(b.x + b.width, t.x + t.width) - Math.max(b.x, t.x));
  const iy = Math.max(0, Math.min(b.y + b.height, t.y + t.height) - Math.max(b.y, t.y));
  console.log(
    `@${w}x${h} ${hintTestId}: bubble=(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)}x${b.height.toFixed(1)}) ` +
      `hint=(${t.x.toFixed(1)},${t.y.toFixed(1)},${t.width.toFixed(1)}x${t.height.toFixed(1)}) ` +
      `overlap=${(ix * iy).toFixed(1)}px²`,
  );
  return ix * iy;
}

/**
 * Miss twice: drop a pin far from the target, twice, continuing each time.
 * The click point must land on open map: clear of the bottom-left
 * attribution pill (bottom-2 left-2, 44px tall) and of the hint cluster.
 */
async function doTwoMisses(
  page: import("playwright/test").Page,
  click: { x: number; y: number } = { x: 50, y: 700 },
) {
  for (let i = 0; i < 2; i++) {
    // Click a corner of the map — far from any likely target.
    await page.mouse.click(click.x, click.y);
    const drop = page.getByRole("button", { name: /drop pin/i });
    await expect(drop).toBeEnabled({ timeout: 10_000 });
    await drop.click();
    // Wait for the miss to resolve (phase "done"), then continue.
    await page.getByRole("button", { name: "Next place" }).click({ timeout: 20_000 });
  }
}

test("5-7: hint button visible, tap shows a directional hint", async ({
  page,
  context,
}) => {
  await seedProfile(context, "5-7");
  await startGlobeRun(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  await button.click();
  const message = page.getByTestId("hint-message");
  await expect(message).toBeVisible();
  // Directional nudge — one of the four quadrants, never the answer.
  await expect(message).toContainText(/northern|southern|eastern|western/);

  // Free policy: button stays enabled for another hint.
  await expect(button).toBeEnabled();
});

test("8-10: hint button disables after one use", async ({ page, context }) => {
  await seedProfile(context, "8-10");
  await startGlobeRun(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  await button.click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(/hint used/i);
});

test("11-13: no hint button at all", async ({ page, context }) => {
  await seedProfile(context, "11-13");
  await startGlobeRun(page);

  await expect(page.getByTestId("hint-button")).toHaveCount(0);
  await expect(page.getByTestId("hint-panel")).toHaveCount(0);
});

test("5-7: mascot offer appears after 2 misses", async ({ page, context }) => {
  await seedProfile(context, "5-7");
  await startGlobeRun(page);

  // Miss twice: drop a pin far from the target, twice. The miss flow
  // ends the place ("done" phase); continue to the next place each time.
  await doTwoMisses(page);

  // After 2 misses, the mascot offer should appear (opt-in).
  const offer = page.getByTestId("hint-offer");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toContainText(/want a hint/i);

  // Accepting the offer shows the hint.
  await offer.getByRole("button", { name: /yes please/i }).click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
});

/**
 * Overlap gate (#113 BLOCK): the hint cluster must never intersect the
 * open question bubble — 0px² at 360×740 and 390×844, in the button,
 * revealed-message, and mascot-offer states.
 */
test("360x740: hint button and message never overlap the open bubble", async ({
  page,
  context,
}) => {
  await startSizedRun(page, context, 360, 740);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  expect(await hintOverlapArea(page, "hint-button", 360, 740)).toBe(0);

  await button.click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
  expect(await hintOverlapArea(page, "hint-message", 360, 740)).toBe(0);
});

test("390x844: hint button and message never overlap the open bubble", async ({
  page,
  context,
}) => {
  await startSizedRun(page, context, 390, 844);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  expect(await hintOverlapArea(page, "hint-button", 390, 844)).toBe(0);

  await button.click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
  expect(await hintOverlapArea(page, "hint-message", 390, 844)).toBe(0);
});

test("360x740: mascot offer never overlaps the open bubble", async ({
  page,
  context,
}) => {
  await startSizedRun(page, context, 360, 740);
  // (50, 700) would land on the bottom-left attribution pill at this
  // height — click higher, still a map corner far from any target.
  await doTwoMisses(page, { x: 50, y: 600 });

  const offer = page.getByTestId("hint-offer");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  expect(await hintOverlapArea(page, "hint-offer", 360, 740)).toBe(0);
});

test("390x844: mascot offer never overlaps the open bubble", async ({
  page,
  context,
}) => {
  await startSizedRun(page, context, 390, 844);
  await doTwoMisses(page);

  const offer = page.getByTestId("hint-offer");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  expect(await hintOverlapArea(page, "hint-offer", 390, 844)).toBe(0);
});
