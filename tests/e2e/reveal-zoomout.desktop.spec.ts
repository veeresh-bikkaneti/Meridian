import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitMiss,
  commitHit,
  aimMarkerCenter,
  spotMarkerCenter,
  nextPlaceButton,
} from "./helpers";

/**
 * Wrong-answer reveal from a deep zoom (Veeresh 2026-10-03).
 *
 * The player zooms in to place the pin precisely, then misses. The gap-view
 * reveal must pull back to frame BOTH pins (the educational zoom-out), and
 * the player must be able to zoom/pan manually once the result card is up.
 * Regression: the gap-view rewrite left gestures disabled at every reveal
 * terminal, trapping the player at the pin.
 *
 * - Miss from deep zoom (globe/country/state): camera pulls back, both
 *   markers framed, a real wheel burst zooms further (gestures live).
 * - Hit: camera does not move (dive-in behavior unchanged), gestures live.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then(Number);

/** Click "Zoom in" until data-zoom >= target (each click ≈ +1). */
async function zoomDeep(page: Page, target = 10): Promise<number> {
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  for (let i = 0; i < 20; i++) {
    const z = await readZoom(page);
    if (z >= target) return z;
    await zoomIn.click();
    await page.waitForTimeout(400);
  }
  throw new Error(`zoomDeep: never reached ${target}`);
}

/**
 * Real wheel burst over the map (from desktop-gestures.spec.ts): one
 * Playwright wheel() is a single event; a burst of 8 ≈ 1.5 zoom levels.
 * Uses the top-left corner so the result card never swallows the events.
 */
async function wheelNotches(page: Page, deltaY: number): Promise<void> {
  await page.mouse.move(100, 100);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(120);
  }
}

/** Both the guess pin and the true spot are inside the 1440x900 viewport. */
async function expectBothMarkersFramed(page: Page): Promise<void> {
  const pin = await aimMarkerCenter(page);
  const spot = await spotMarkerCenter(page);
  expect(pin).not.toBeNull();
  expect(spot).not.toBeNull();
  for (const pt of [pin!, spot!]) {
    expect(pt.x).toBeGreaterThanOrEqual(0);
    expect(pt.x).toBeLessThanOrEqual(1440);
    expect(pt.y).toBeGreaterThanOrEqual(0);
    expect(pt.y).toBeLessThanOrEqual(900);
  }
}

async function startCountryRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page
    .getByRole("button", { name: "Play entire United States" })
    .click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

async function startStateRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a state" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

/** Shared miss-from-deep-zoom body: pull-back + framing + live gestures. */
async function missFromDeepZoom(page: Page): Promise<void> {
  const deepZoom = await zoomDeep(page, 10);
  expect(deepZoom).toBeGreaterThanOrEqual(10);
  await commitMiss(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  // The gap view pulled back from the deep zoom to fit both pins.
  const revealZoom = await readZoom(page);
  expect(revealZoom).toBeLessThan(deepZoom);
  await expectBothMarkersFramed(page);
  // Gestures are live after the reveal: a real wheel burst zooms further out.
  await wheelNotches(page, 300);
  await expect
    .poll(() => readZoom(page), { timeout: 10_000 })
    .toBeLessThan(revealZoom);
}

test("globe miss from deep zoom: reveal pulls back, both pins framed, wheel works", async ({
  page,
}) => {
  await startGlobeRun(page);
  await missFromDeepZoom(page);
});

test("country miss from deep zoom: reveal pulls back, both pins framed, wheel works", async ({
  page,
}) => {
  await startCountryRun(page);
  await missFromDeepZoom(page);
});

test("state miss from deep zoom: reveal pulls back, both pins framed, wheel works", async ({
  page,
}) => {
  await startStateRun(page);
  await missFromDeepZoom(page);
});

test("hit: camera does not move and gestures stay live", async ({ page }) => {
  await startGlobeRun(page);
  const zoomBefore = await readZoom(page);
  await commitHit(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  // No camera move on a hit (dive-in behavior unchanged).
  expect(await readZoom(page)).toBe(zoomBefore);
  // Gestures live after the hit too.
  await wheelNotches(page, 300);
  await expect
    .poll(() => readZoom(page), { timeout: 10_000 })
    .toBeLessThan(zoomBefore);
});
