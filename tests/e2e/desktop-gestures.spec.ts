import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * Desktop mouse gestures on the built Pages artifact.
 *
 * Regression guard for the 2026-09-30 report: on a real desktop the mouse
 * wheel did not zoom and dragging did not spin the globe. Local automation
 * showed MapLibre's native handlers (scrollZoom, dragPan) armed and working,
 * so these specs lock the behavior in against future regressions rather than
 * re-diagnosing it.
 *
 * Measurement notes (learned the hard way):
 * - data-zoom is Math.round(getZoom()): a real zoom change can read as
 *   "2 -> 2". Every wheel assertion below drives ~1.5 zoom levels so the
 *   rounded value must move; never assert on a sub-level delta.
 * - data-center-lng/lat (4 decimals, written on moveend) is the drag
 *   signal — screenshot diffs are not a reliable movement assertion.
 * - Gestures stay disarmed through the intro beat; startGlobeRun waits for
 *   the settled aim phase before any input.
 *
 * The tile-failure card is deliberately pointer-events-auto on a
 * pointer-events-none root (see satellite-map.tsx): its Retry/Dismiss buttons
 * stay clickable while wheel/drag events bubble past it to the MapLibre
 * container. That contract is structural in the JSX; the failure path's
 * timing is environment-sensitive, so it is not forced in E2E (the reducer
 * itself is covered by the tile-status unit tests).
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = async (page: Page): Promise<number> =>
  Number(await mapEl(page).getAttribute("data-zoom"));
const readCenter = async (page: Page): Promise<{ lng: number; lat: number }> => ({
  lng: Number(await mapEl(page).getAttribute("data-center-lng")),
  lat: Number(await mapEl(page).getAttribute("data-center-lat")),
});

async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  if (!box) throw new Error("map canvas has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Dispatch several real-size wheel notches over the map. One Playwright
 * wheel() call is a single wheel event; a real mouse sends a burst, so this
 * sends a burst. Total delta ≈ ±2400 ≈ 1.5 zoom levels — comfortably more
 * than one rounded data-zoom step.
 */
async function wheelNotches(page: Page, x: number, y: number, deltaY: number): Promise<void> {
  await page.mouse.move(x, y);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(120);
  }
}

test("wheel up zooms in, wheel down zooms out (globe edition)", async ({ page }) => {
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);
  const { x, y } = await canvasCenter(page);
  const z0 = await readZoom(page);

  await wheelNotches(page, x, y, -300);
  await expect
    .poll(() => readZoom(page), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(z0 + 1);
  const zIn = await readZoom(page);

  await wheelNotches(page, x, y, 300);
  await expect
    .poll(() => readZoom(page), { timeout: 10_000 })
    .toBeLessThanOrEqual(zIn - 1);
});

test("left-drag spins the globe (map center moves)", async ({ page }) => {
  await startGlobeRun(page);
  await dismissTileOverlayIfPresent(page);
  const { x, y } = await canvasCenter(page);
  const c0 = await readCenter(page);

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x + i * 30, y, { steps: 2 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();

  // 300 px of drag at globe zoom moves the center tens of degrees; 5° is a
  // conservative floor far above any rounding or jitter.
  await expect
    .poll(async () => Math.abs((await readCenter(page)).lng - c0.lng), {
      timeout: 10_000,
    })
    .toBeGreaterThan(5);
});
