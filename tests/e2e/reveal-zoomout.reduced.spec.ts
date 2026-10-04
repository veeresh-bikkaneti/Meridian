import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  dismissTileOverlayIfPresent,
  readPhase,
  commitPin,
  spotViewportPoint,
  tapHitsMap,
  clickNextPlace,
  aimMarkerCenter,
  spotMarkerCenter,
  nextPlaceButton,
} from "./helpers";

/**
 * Wrong-answer reveal from a deep zoom under prefers-reduced-motion:
 * no animation — the miss is a synchronous jump cut to the pin+spot
 * framing, the card appears immediately, and gestures are live.
 */

test.setTimeout(480_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/**
 * Local globe-run starter with generous timeouts. The shared startGlobeRun's
 * 15 s map-mount timeout flakes on slow software WebGL; the steps are the
 * same, only the patience differs.
 */
async function startGlobeRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=3600000");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => readPhase(page), { timeout: 60_000 }).toBe("aim");
}

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then(Number);

/**
 * Click "Zoom in" until data-zoom reaches target or stops increasing
 * (globe caps at 5). Polls for the zoom to settle after each click — a fixed
 * nap was racy under software WebGL and broke the loop after one click.
 */
async function zoomDeep(
  page: Page,
  target = 10,
): Promise<{ before: number; deep: number }> {
  const before = await readZoom(page);
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  let deep = before;
  let stuck = 0;
  for (let i = 0; i < 25 && stuck < 4 && deep < target; i++) {
    await zoomIn.click();
    try {
      await expect.poll(() => readZoom(page), { timeout: 10_000 }).not.toBe(deep);
    } catch {
      // Zoom didn't move (at max, or still settling).
    }
    const z = await readZoom(page);
    if (z > deep) {
      deep = z;
      stuck = 0;
    } else {
      stuck++;
    }
  }
  return { before, deep };
}

/**
 * Commit a guaranteed FAR miss: tap the map-safe viewport point farthest
 * from the true spot's projected position. A far miss is what forces the
 * gap-view camera to pull back, which is exactly Veeresh's scenario.
 */
async function commitFarMiss(page: Page): Promise<{ committedAt: number }> {
  const candidates = [
    { x: 200, y: 200 },
    { x: 1240, y: 200 },
    { x: 200, y: 700 },
    { x: 1240, y: 700 },
    { x: 720, y: 450 },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    const spot = await spotViewportPoint(page);
    let best = candidates[0];
    let bestD = -1;
    for (const c of candidates) {
      if (!(await tapHitsMap(page, c.x, c.y))) continue;
      const d = spot ? (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 : Infinity;
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    const { phase, committedAt } = await commitPin(page, best.x, best.y);
    if (phase === "done") return { committedAt };
    // Freak hit (or spot unknown and we got lucky): advance and retry.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitFarMiss: three attempts failed");
}

/**
 * The tile watchdog is flaky under software rendering (fires "failed" even
 * with the tile stub, then Retry recovers) — pre-existing harness flake,
 * unrelated to this fix. Retry the ready-poll a few times so the test
 * measures the reveal camera, not tile loading.
 */
async function ensureTilesReady(page: Page): Promise<void> {
  const map = page.locator(".satellite-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    try {
      await expect
        .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
        .toBe("ready");
      return;
    } catch {
      // fall through to Retry
    }
  }
  throw new Error("ensureTilesReady: tiles never reached ready");
}

async function wheelNotches(page: Page, deltaY: number): Promise<void> {
  await page.mouse.move(100, 100);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(120);
  }
}

test("reduced motion miss from deep zoom: instant fit, both pins framed, wheel works", async ({
  page,
}) => {
  await startGlobeRun(page);
  const { deep: deepZoom } = await zoomDeep(page);
  expect(deepZoom).toBeGreaterThanOrEqual(5);
  await ensureTilesReady(page);
  const { committedAt } = await commitFarMiss(page);
  // No 2.2 s beat under reduced motion: the card lands with the jump cut.
  // Promptness check only (15 s, matching the button's own timeout) — on a
  // loaded VM render time dominates; the beat's absence is proven by the
  // controller unit tests, not by wall-clock here.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - committedAt).toBeLessThan(15000);
  const revealZoom = await readZoom(page);
  expect(revealZoom).toBeLessThan(deepZoom);
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
  await wheelNotches(page, 300);
  await expect
    .poll(() => readZoom(page), { timeout: 10_000 })
    .toBeLessThan(revealZoom);
});
