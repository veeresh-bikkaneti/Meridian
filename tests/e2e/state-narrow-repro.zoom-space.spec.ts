import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  freshBoot,
  pickBand,
  readPhase,
  waitForSpotSettle,
  readQuestion,
  commitPin,
  dismissTileOverlayIfPresent,
  APP_NO_IDLE,
} from "./helpers";

/**
 * BUG REPRO: State Nebraska run — the map never zooms in to the edition.
 * Owner report (2026-10-17, live site): whole continent visible, Nebraska
 * gold-highlighted, zoom stuck around the projection-morph band instead of
 * narrowing to the state framing. This spec starts a real State/Nebraska run,
 * lets the intro settle, and reads the camera zoom + a screenshot as the
 * black-box verdict.
 */

test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function startStateNebraska(page: Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Choose a state" })).toBeVisible();
  await page.getByRole("button", { name: "Choose a state" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

test("state Nebraska intro narrows the camera to the state framing", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startStateNebraska(page);
  const question = await readQuestion(page);
  console.log("QUESTION:", question);

  // Let the intro (spin + narrow-in flyTo) fully settle.
  const spot = await waitForSpotSettle(page);
  console.log("SPOT SETTLED AT:", spot);

  const camera = await page.evaluate(() => {
    const wrapper = document.querySelector(".satellite-map");
    const dataZoom = wrapper?.getAttribute("data-zoom");
    // Nebraskas's approximate bbox for a viewport sanity check.
    const canvas = document.querySelector(".maplibregl-canvas") as HTMLCanvasElement | null;
    return {
      dataZoom,
      ariaHidden: wrapper?.getAttribute("aria-hidden"),
      canvasCssW: canvas?.clientWidth ?? null,
      canvasCssH: canvas?.clientHeight ?? null,
    };
  });
  console.log("CAMERA:", JSON.stringify(camera));

  await page.screenshot({ path: "state-nebraska-narrow.png" });

  // Nebraska (~8.7° wide) on a 390px phone with 15% padding should settle
  // around zoom 5-6. The owner's live report showed the whole continent
  // (zoom ~3). Anything below 4 is the bug.
  const zoom = Number(camera.dataZoom);
  expect(Number.isFinite(zoom), `data-zoom readable, got ${camera.dataZoom}`).toBe(true);
  expect(zoom).toBeGreaterThanOrEqual(4);
  expect(zoom).toBeLessThanOrEqual(6); // Nebraska settles ~4-5; above 6 is a desync flag
});

async function readZoom(page: Page): Promise<number> {
  const v = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  return Number(v);
}

test("state Nebraska: after a big miss + continue, the camera returns to the state framing", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startStateNebraska(page);
  await readQuestion(page);
  await waitForSpotSettle(page);

  // Zoom out with the +/- control so a far-away tap point is on screen,
  // then tap far from the truth for a guaranteed big miss (>500 km).
  const zoomOut = page.getByRole("button", { name: /zoom out/i });
  await zoomOut.click();
  await zoomOut.click();
  await page.waitForTimeout(900);
  const zoomAfterOut = await readZoom(page);
  console.log("ZOOM AFTER MANUAL OUT:", zoomAfterOut);

  // Tap a screen point away from the map center: big miss.
  const { phase } = await commitPin(page, 60, 700);
  console.log("PHASE AFTER COMMIT:", phase);

  // Wait for the gap-view reveal beat to settle, then continue.
  await page.waitForTimeout(3500);
  const zoomAfterReveal = await readZoom(page);
  console.log("ZOOM AFTER REVEAL:", zoomAfterReveal);
  await page.screenshot({ path: "state-nebraska-gapview.png" });

  const next = page.getByRole("button", { name: /next place/i });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await next.click();
  await expect
    .poll(() => readPhase(page), { timeout: 30_000 })
    .toBe("aim");
  await waitForSpotSettle(page);
  await page.waitForTimeout(1500);

  const zoomAfterReturn = await readZoom(page);
  console.log("ZOOM AFTER RETURN:", zoomAfterReturn);
  await page.screenshot({ path: "state-nebraska-after-return.png" });

  // The return beat must ease back to the region framing (zoom ~4-5),
  // never strand the next question at the zoomed-out gap framing.
  expect(zoomAfterReturn).toBeGreaterThanOrEqual(4);
  expect(zoomAfterReturn).toBeLessThanOrEqual(6);
});

test("state Nebraska: manual zoom-out during aim leaves the camera where the player left it", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startStateNebraska(page);
  await readQuestion(page);
  await waitForSpotSettle(page);

  const zoomOut = page.getByRole("button", { name: /zoom out/i });
  await zoomOut.click();
  await zoomOut.click();
  await page.waitForTimeout(1200);

  const zoom = await readZoom(page);
  console.log("ZOOM AFTER MANUAL OUT (no commit):", zoom);
  await page.screenshot({ path: "state-nebraska-manual-out.png" });

  // Wait — nothing auto-returns the camera during aim. Document the state.
  await page.waitForTimeout(3000);
  const zoomLater = await readZoom(page);
  console.log("ZOOM 3s LATER:", zoomLater);
  expect(zoomLater).toBe(zoom);
});
