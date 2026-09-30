import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Cinematic answer-reveal tour (desktop, animated): the reveal auto-plays
 * three beats — region flash + spot pulse, then a ~4 s Google-Earth-style
 * dive to rooftop level — and the result card appears only when the tour
 * reaches its end state. A tap on the map skips the choreography.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Commit a pin; the reveal beat + tour play out. */
async function commitPin(page: import("playwright/test").Page) {
  // The tile watchdog can fire on slow machines, and the cinematic tour
  // only plays over healthy tiles (tile failure shows the card at once).
  // Dismiss the overlay as a user would, then wait for tiles to be ready.
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  await page.mouse.click(500, 400);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).not.toBe("aim");
}

const nextPlaceButton = (page: import("playwright/test").Page) =>
  page.getByRole("button", { name: "Next place" });

const mapZoom = (page: import("playwright/test").Page) =>
  page.locator(".satellite-map").getAttribute("data-zoom");

test("tour auto-plays the three beats in order, card lands on the rooftop view", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitPin(page);

  // The result card must NOT appear immediately on commit — it waits for
  // the tour's end state. (The reveal beat alone runs ~2.2 s.)
  await expect(nextPlaceButton(page)).toBeHidden({ timeout: 2_000 });

  // Beats 1+2: the spot pulse marker throbs while the camera holds.
  const pulse = page.locator(".meridian-tour-pulse");
  await expect(pulse).toBeVisible({ timeout: 15_000 });

  // Beat 3: the dive completes at rooftop level (data-zoom is written on
  // zoomend, so it flips to 14 when the fly-to lands).
  await expect
    .poll(() => mapZoom(page), { timeout: 20_000 })
    .toBe("14");

  // Tour end: the pulse is cleared and the result card appears over the
  // close view.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });
  await expect(pulse).toBeHidden();

  // Continuing returns the camera to the region framing — the next
  // question must not start at rooftop zoom.
  await nextPlaceButton(page).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect
    .poll(() => mapZoom(page), { timeout: 20_000 })
    .not.toBe("14");
});

test("tour: a tap on the map skips to the end state", async ({ page }) => {
  await startGlobeRun(page);
  await commitPin(page);

  // Wait until the tour is actually playing (pulse visible), then tap the
  // canvas — not a button — to skip.
  const pulse = page.locator(".meridian-tour-pulse");
  await expect(pulse).toBeVisible({ timeout: 15_000 });
  await page.mouse.click(200, 200);

  // The skip jumps straight to the end state: rooftop view + card, well
  // before the full ~7 s choreography would finish.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 8_000 });
  await expect.poll(() => mapZoom(page), { timeout: 8_000 }).toBe("14");
  await expect(pulse).toBeHidden();
});
