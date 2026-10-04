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

/**
 * Warmup: the shared startGlobeRun's 15 s map-mount timeout flakes on a cold
 * browser (first software-WebGL map init). Mount once with retries so the
 * real test runs warm.
 */
test("warmup: first map mount", async ({ page }) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await startGlobeRun(page);
      return;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then(Number);

async function zoomDeep(page: Page): Promise<{ before: number; deep: number }> {
  const before = await readZoom(page);
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  let deep = before;
  for (let i = 0; i < 15; i++) {
    await zoomIn.click();
    await page.waitForTimeout(400);
    const z = await readZoom(page);
    if (z <= deep) break; // maxZoom reached (globe caps at 5)
    deep = z;
  }
  return { before, deep };
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
