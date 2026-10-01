import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
  aimMarkerCenter,
  spotMarkerCenter,
  commitPin,
  commitMiss,
  commitHit,
  spotViewportPoint,
  tapHitsMap,
  nextPlaceButton,
  clickNextPlace,
  resultCard,
} from "./helpers";

/**
 * Educational gap-view reveal (desktop, animated).
 *
 * - Miss: one ease to the pin+spot framing (the gap view). The result card
 *   appears only when the beat completes (~2.2 s) — never instantly — and
 *   leads with the miss distance, a 2-line explanatory subscript, the place
 *   story, and the source.
 * - Hit: light confirmation — no camera move; the card appears promptly.
 * - A tap on the map canvas during the miss beat skips to the end state.
 *
 * Determinism: the app exposes `__spotScreen()` on the map wrapper (DOM
 * contract, like data-zoom), projecting the current place's true spot to
 * wrapper-relative pixels through the live camera. The hit test taps the
 * exact spot; the miss tests tap (500, 400) and retry on the ~1% chance it
 * lands a hit.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});


test("miss: the gap view frames pin + spot; card leads with distance, subscript, story, source", async ({
  page,
}) => {
  await startGlobeRun(page);
  const aimZoom = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  const { committedAt } = await commitMiss(page);

  const nextPlace = nextPlaceButton(page);
  // The card waits for the gap-view beat's end state (~2.2 s ease) — it must
  // not appear instantly on commit. Exception: if tiles fail mid-reveal the
  // beat is skipped by design and the card shows at once; that is not a
  // product bug, so distinguish it via the tile status.
  await expect(nextPlace).toBeVisible({ timeout: 15_000 });
  const cardDelayMs = Date.now() - committedAt;
  if (cardDelayMs < 1500) {
    const tileStatus = await page
      .locator(".satellite-map")
      .getAttribute("data-tile-status");
    expect(
      tileStatus,
      "card appeared instantly over healthy tiles — the beat did not run",
    ).not.toBe("ready");
  } else {
    expect(cardDelayMs).toBeGreaterThanOrEqual(1500);
  }

  const card = resultCard(page);
  // Distance headline ("12.3 km off" / "850 m off").
  await expect(card.getByText(/(m|km) off/)).toBeVisible();
  // 2-line explanatory subscript: legend + story lede.
  const subscript = card.getByTestId("miss-subscript");
  await expect(subscript).toBeVisible();
  await expect(subscript).toContainText("White pin is your guess");
  // The place story and its source.
  await expect(card.getByRole("link")).toBeVisible();

  // The gap view: both the guess pin and the true spot are framed in the
  // viewport (a near or far miss — the camera moved to fit both).
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

  // Continuing returns the camera to the region framing — the next
  // question must not start at the gap-view framing.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 20_000,
    })
    .toBe(aimZoom);
});

test("miss: a tap on the map skips the beat to the end state", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitMiss(page);

  // Wait for the beat to be confirmed running: the "Showing your pin..."
  // announcement fires with the beat's intents, and the card must not be
  // visible yet (if the card is already up, the beat completed
  // synchronously — a near miss — and there is nothing to skip).
  const announcement = page.locator("text=Showing your pin and the true spot.");
  await expect(announcement).toBeAttached({ timeout: 10_000 });
  const cardAlreadyUp = await nextPlaceButton(page).count();
  if (cardAlreadyUp > 0) {
    // Synchronous beat (near miss or tile failure): nothing to skip.
    // The main miss test covers the card content.
    return;
  }

  // Tap the canvas (not a button, not the question bubble) mid-beat to skip.
  // (1200, 450) is right-side canvas, clear of chrome.
  expect(await tapHitsMap(page, 1200, 450)).toBe(true);
  const tappedAt = Date.now();
  await page.mouse.click(1200, 450);

  // The skip jumps synchronously to the end state — the card lands promptly
  // after the tap, well before the ~2.2 s beat would finish on its own.
  // (Measured from the tap, not the commit: commit processing alone can
  // take ~1 s, and tile/WebGL jank in CI can stretch the beat.)
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - tappedAt).toBeLessThan(2000);
});

test("hit: light confirmation — the card appears promptly, the camera never moves", async ({
  page,
}) => {
  await startGlobeRun(page);
  const zoomBefore = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  const { committedAt } = await commitHit(page);

  // No beat to wait for: the hit completes synchronously, so the card
  // lands promptly.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });
  expect(Date.now() - committedAt).toBeLessThan(4000);

  // The camera never moved — the hit confirms over the pin's own view.
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 5_000,
    })
    .toBe(zoomBefore);
});
