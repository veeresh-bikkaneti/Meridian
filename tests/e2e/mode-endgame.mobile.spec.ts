import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Mode End game on small phones (manifest 2026-10-28-endgame-editions,
 * ruling R7): the GeoDetective and Cold Trail "End game" buttons are
 * visible without scrolling, at least 44px tall, and do not overlap the
 * leave control — at BOTH 360×740 and 390×844. Runs in the "mobile"
 * project (viewport + touch come from there); each test sets its own
 * viewport per size and re-enters the mode for the second size.
 *
 * Rect-overlap assertions measure BOTH button rects in a SINGLE
 * page.evaluate() call (two sequential boundingBox() calls are not atomic).
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Open GeoDetective; `puzzle` pins the deal via the ?loop-puzzle= seam. */
async function openLoop(page: import("playwright/test").Page, puzzle?: string) {
  await page.goto(puzzle ? `${BASE}?loop-puzzle=${puzzle}` : BASE);
  // Second viewport iteration re-enters an in-progress case, so home
  // offers "Resume your case" instead of "Solve a mystery" — same screen.
  await page.getByRole("button", { name: /GeoDetective: (Solve a mystery|Resume your case)/ }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Open Cold Trail from the editions menu. */
async function openColdTrail(page: import("playwright/test").Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/**
 * Intersection area of two buttons, measured in a SINGLE page.evaluate()
 * call (two sequential boundingBox() calls are not atomic).
 */
async function singleEvaluateOverlap(
  page: import("playwright/test").Page,
  first: import("playwright/test").Locator,
  second: import("playwright/test").Locator,
): Promise<number> {
  const h1 = await first.elementHandle();
  const h2 = await second.elementHandle();
  return page.evaluate(([a, b]) => {
    if (!a || !b) return -1;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const w = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
    const h = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
    return w * h;
  }, [h1, h2]);
}

/** Shared visibility / size / in-viewport / no-overlap assertions. */
async function expectEndGameClear(
  page: import("playwright/test").Page,
  leaveName: string,
) {
  const endGame = page.getByRole("button", { name: "End game" });
  await expect(endGame).toBeVisible({ timeout: 15_000 });
  const box = await endGame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const vp = page.viewportSize();
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp!.height);
  const overlap = await singleEvaluateOverlap(
    page,
    endGame,
    page.getByRole("button", { name: leaveName }),
  );
  expect(overlap).toBe(0);
}

test("mobile: GeoDetective End game visible without scrolling at 360x740 and 390x844", async ({ page }) => {
  test.setTimeout(240_000);
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openLoop(page, "218");
    await expectEndGameClear(page, "Editions");
    await page.getByRole("button", { name: "Editions" }).click();
    await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  }
});

test("mobile: Cold Trail End game visible without scrolling at 360x740 and 390x844", async ({ page }) => {
  test.setTimeout(240_000);
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openColdTrail(page);
    await expectEndGameClear(page, "All games");
    await page.getByRole("button", { name: "All games" }).click();
    await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  }
});
