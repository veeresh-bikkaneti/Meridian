import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  aimMarkerCenter,
  spotMarkerCenter,
  nextPlaceButton,
} from "./helpers";

/**
 * Wrong-answer reveal from a deep zoom under prefers-reduced-motion:
 * no animation — the miss is a synchronous jump cut to the pin+spot
 * framing, the card appears immediately, and gestures are live.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then(Number);

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
  const deepZoom = await zoomDeep(page, 10);
  expect(deepZoom).toBeGreaterThanOrEqual(10);
  const { committedAt } = await commitMiss(page);
  // No 2.2 s beat under reduced motion: the card lands with the jump cut.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - committedAt).toBeLessThan(5000);
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
