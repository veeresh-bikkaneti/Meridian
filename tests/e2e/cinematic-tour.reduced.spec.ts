import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Cinematic answer-reveal tour under prefers-reduced-motion: no animation,
 * no timers — the tour is synchronous jump cuts, so the result card appears
 * immediately on commit (no ~7 s wait).
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("tour: reduced motion is jump cuts — the card appears immediately", async ({
  page,
}) => {
  await startGlobeRun(page);
  // Healthy tiles: the reduced-motion tour (not the tile-failure fallback)
  // is what must show the card immediately.
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  await page.mouse.click(500, 400);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).not.toBe("aim");

  // No animated beats: the card lands promptly (the animated tour would
  // take ~7 s: 2.2 s settle + 1.2 s announce + 4 s dive).
  const nextPlace = page.getByRole("button", { name: "Next place" });
  await expect(nextPlace).toBeVisible({ timeout: 5_000 });

  // The jump cut lands at rooftop level, and no pulse ever animates.
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 5_000,
    })
    .toBe("14");
  await expect(page.locator(".meridian-tour-pulse")).toBeHidden();

  // Continuing jump-cuts back to the region framing.
  await nextPlace.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
});
