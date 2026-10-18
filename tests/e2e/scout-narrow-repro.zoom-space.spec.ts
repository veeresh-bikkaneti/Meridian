import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  freshBoot,
  pickBand,
  readPhase,
  waitForSpotSettle,
  readQuestion,
  startCountryRun,
  spotViewportPoint,
  APP_NO_IDLE,
} from "./helpers";
import { seedManualMode, readMapMode } from "./scout-helpers";

/**
 * BUG REGRESSION (owner 2026-10-17): in Scout Map mode (the stripped-down
 * map for low-end devices), starting a State/Country edition did NOT zoom
 * into the region, and the + zoom button did nothing (the intro targeted a
 * settle zoom above the mode's maxZoom, so the camera clamped mid-flight).
 * Fixed by raising the scout flat cap to 8 and clamping the intro target
 * to the mode cap (settleZoomCap).
 */

test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await seedManualMode(context, "scout");
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
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

async function readZoom(page: Page): Promise<number> {
  return Number(await page.locator(".satellite-map").getAttribute("data-zoom"));
}

async function readMaxZoom(page: Page): Promise<number> {
  return Number(await page.locator(".satellite-map").getAttribute("data-max-zoom"));
}

/** Poll data-zoom until it changes from `from` (or timeout): the zoom
 *  buttons animate, so a fixed sleep races the easing. */
async function waitForZoomChange(page: Page, from: number): Promise<number> {
  let zoom = from;
  await expect
    .poll(async () => {
      zoom = await readZoom(page);
      return zoom;
    }, { timeout: 10_000 })
    .not.toBe(from);
  return zoom;
}

test("scout mode: state Nebraska intro zooms into the state", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startStateNebraska(page);
  const mode = await readMapMode(page);
  console.log("MAP MODE:", mode);
  const question = await readQuestion(page);
  console.log("QUESTION:", question);
  await waitForSpotSettle(page);

  const zoom = await readZoom(page);
  const maxZoom = await readMaxZoom(page);
  console.log("SCOUT INTRO ZOOM:", zoom, "MAX:", maxZoom);
  await page.screenshot({ path: "scout-nebraska-intro.png" });

  // The intro must frame the state the way full mode does (Nebraska
  // settles ~4-5 on a phone) — never strand the camera at a continent
  // view — and the mode cap must be the raised one.
  // Honesty note: Scout forces reduced motion, so the intro is a jump-to
  // and data-zoom is written from the intent target, not the camera. These
  // intro zoom assertions are therefore cap-consistency checks; the
  // mid-flight-clamp desync is caught by data-max-zoom (8, not 3) and by
  // the zoom-in button test below, which drives the real camera.
  expect(mode).toBe("scout");
  expect(maxZoom).toBe(8);
  expect(zoom).toBeGreaterThanOrEqual(4);
  expect(zoom).toBeLessThanOrEqual(maxZoom);
});

test("scout mode: country France intro zooms into the country", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startCountryRun(page, "France");
  expect(await readMapMode(page)).toBe("scout");
  await readQuestion(page);
  await waitForSpotSettle(page);

  const zoom = await readZoom(page);
  console.log("SCOUT FRANCE INTRO ZOOM:", zoom);
  await page.screenshot({ path: "scout-france-intro.png" });

  // France settles ~4-5 on a phone; must be framed, not continent-wide.
  expect(zoom).toBeGreaterThanOrEqual(4);
  expect(zoom).toBeLessThanOrEqual(await readMaxZoom(page));
});

test("scout mode: globe reveal framing never exceeds the globe cap", async ({
  page,
}: {
  page: Page;
}) => {
  // Peer-review catch (PR #172): the reveal beat framed pin+spot with
  // maxZoom 4, but scout-globe's camera caps at 2 — the same mid-jump
  // clamp + desync + dead-+ failure as the intro bug. revealZoomCap
  // clamps it to the mode cap.
  await freshBoot(page);
  await pickBand(page, "Easy");
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Globe" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  expect(await readMapMode(page)).toBe("scout");

  // Tap NEAR the true spot so the pin+spot framing wants to zoom IN past
  // the scout-globe cap: on the old code (reveal maxZoom 4) the target
  // exceeds the camera cap of 2 (mid-jump clamp + desync); fixed code
  // clamps the framing to 2. Candidate offsets are probed for a point the
  // tap actually hits on the map canvas (not the question bubble or a
  // transient pill) — a blind tap there flaps, as tapHitsMap documents.
  const { tapHitsMap } = await import("./helpers");
  const spot = await spotViewportPoint(page);
  console.log("SPOT:", spot);
  let tapped = false;
  if (spot) {
    for (const [dx, dy] of [[40, 40], [-40, 40], [40, -40], [-40, -40], [60, 0], [0, 60]] as const) {
      const tx = spot.x + dx;
      const ty = spot.y + dy;
      if (tx < 8 || tx > 382 || ty < 120 || ty > 800) continue;
      if (await tapHitsMap(page, tx, ty)) {
        await page.mouse.click(tx, ty);
        tapped = true;
        console.log("TAPPED AT:", tx, ty);
        break;
      }
    }
  }
  expect(tapped, "found a near-spot tap point on the map canvas").toBe(true);
  const drop = page.getByRole("button", { name: /drop|place/i });
  await expect(drop).toBeEnabled({ timeout: 15_000 });
  await drop.click();
  await expect
    .poll(() => readPhase(page), { timeout: 30_000 })
    .toMatch(/^(story|done)$/);

  const zoom = await readZoom(page);
  const maxZoom = await readMaxZoom(page);
  console.log("SCOUT GLOBE REVEAL ZOOM:", zoom, "MAX:", maxZoom);
  expect(maxZoom).toBe(2);
  expect(zoom).toBeLessThanOrEqual(2);
  await page.screenshot({ path: "scout-globe-reveal.png" });
});

test("scout mode: zoom-in works from the settled intro zoom (the reported failure)", async ({
  page,
}: {
  page: Page;
}) => {
  await freshBoot(page);
  await pickBand(page, "Easy");
  await startStateNebraska(page);
  await readQuestion(page);
  await waitForSpotSettle(page);

  const maxZoom = await readMaxZoom(page);
  const settled = await readZoom(page);
  console.log("SETTLED:", settled, "MAX:", maxZoom);
  expect(maxZoom).toBe(8);

  // The reported failure: + did nothing because the camera sat AT the old
  // cap. Zoom in FIRST — on the broken code this is a no-op (3→3).
  const zoomIn = page.getByRole("button", { name: /zoom in/i });
  const zoomOut = page.getByRole("button", { name: /zoom out/i });
  await zoomIn.click();
  const afterIn = await waitForZoomChange(page, settled);
  console.log("ZOOM AFTER IN:", afterIn);
  expect(afterIn).toBeGreaterThan(settled);

  // Drive to the cap: repeated zoom-in must reach exactly the cap and stop.
  let z = afterIn;
  for (let i = 0; i < 8 && z < maxZoom; i++) {
    await zoomIn.click();
    z = await waitForZoomChange(page, z);
  }
  console.log("ZOOM AT CAP:", z);
  expect(z).toBe(maxZoom);

  // And zoom-out still works from the cap.
  await zoomOut.click();
  const afterOut = await waitForZoomChange(page, z);
  console.log("ZOOM AFTER OUT:", afterOut);
  expect(afterOut).toBeLessThan(z);
  await page.screenshot({ path: "scout-nebraska-zoombuttons.png" });

  // Scout must never pull the admin-1 boundary band: even at the cap, no
  // lazy admin-1 geometry may load on weak devices. ne-50m-admin-1 is the
  // unambiguous marker chunk — only the admin-1 band lazy-loads it.
  // (states-10m is deliberately NOT matched: region-index shares that
  // chunk for the intro's region lookup, so it legitimately loads in
  // Scout; the band's incremental cost is ne-50m-admin-1 + the iso
  // chunks, all gated by bandForMode.)
  const admin1Loaded = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return entries.some((e) => /ne-50m-admin-1/i.test(e.name));
  });
  console.log("ADMIN1 CHUNK LOADED IN SCOUT:", admin1Loaded);
  expect(admin1Loaded).toBe(false);
});
