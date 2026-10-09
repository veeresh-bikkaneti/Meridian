import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Cold Trail vertical-slice deploy-gate E2E (WS1 "Every Place Findable").
 *
 * New flow: "Place ring on map" enters placement mode (crosshair + hint, no
 * ring yet) → tapping the map plants an ephemeral draft ring → "Yes, keep
 * it" locks the PLAYER-chosen center → repeat ×3 → tap the map for the
 * interception guess → confirm → score reveal. Pre-reveal, the map renders
 * only player-chosen coordinates (witness dots at locked player centers,
 * never at the true anchors — see the placement.test.ts I1 unit test for
 * the coordinate-level assertion).
 *
 * The built Pages artifact is served from disk (see helpers.ts); Esri tiles
 * are stubbed, so ring painting is not asserted — the flow is.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Open Cold Trail from the editions menu. */
async function openColdTrail(page: import("playwright/test").Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "❄️ Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  // All three witness reports render.
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Read the live GeoJSON features of a LoopMap source via the __loopMap seam. */
async function sourceFeatures(
  page: import("playwright/test").Page,
  sourceId: string,
): Promise<Array<{ properties: Record<string, unknown>; geometry: { coordinates: unknown } }>> {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap?: { getSource: (id: string) => unknown };
      };
      return !!el?.__loopMap?.getSource(id);
    },
    sourceId,
    { timeout: 30_000 },
  );
  return page.evaluate((id) => {
    const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
      __loopMap: { getSource: (id: string) => { getData: () => { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: unknown } }> } } };
    };
    return el.__loopMap.getSource(id).getData().features;
  }, sourceId);
}

/** Place + lock one ring: button → map tap → "Yes, keep it". */
async function placeAndLockRing(
  page: import("playwright/test").Page,
  tap: { x: number; y: number },
) {
  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  await page.getByTestId("loop-map").click({ position: tap });
  // Draft planted: the adjusting copy appears and the confirm button enables.
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("confirm-ring-btn").click();
}

test("full slice: place 3 rings → tap → confirm → score reveal", async ({ page }) => {
  await openColdTrail(page);

  // Tapping the map before any ring is placed raises the hint, not the sheet.
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("intercept-confirm")).toHaveCount(0);
  await expect(page.getByTestId("map-hint")).toContainText("Place all 3 rings first");

  // Ring 1: place → tap → the draft renders as a preview (dashed) ring.
  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  const ringFeatures = await sourceFeatures(page, "loop-rings");
  const previews = ringFeatures.filter((f) => f.properties.preview === true);
  expect(previews.length).toBeGreaterThan(0);
  // Lock ring 1.
  await page.getByTestId("confirm-ring-btn").click();
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);

  // Rings 2 and 3.
  await placeAndLockRing(page, { x: 300, y: 250 });
  await placeAndLockRing(page, { x: 400, y: 300 });
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(0);

  // All three locked: the status line invites the interception tap.
  await expect(page.getByText("All 3 rings are down")).toBeVisible();

  // Tap the map: the intercept confirm sheet opens.
  await page.getByTestId("loop-map").click({ position: { x: 350, y: 280 } });
  await expect(page.getByTestId("intercept-confirm")).toBeVisible({ timeout: 10_000 });

  // Confirm: the score reveal names the hideout and the km miss.
  await page.getByTestId("intercept-confirm-btn").click();
  const reveal = page.getByTestId("coldtrail-reveal");
  await expect(reveal).toBeVisible({ timeout: 10_000 });
  await expect(reveal).toContainText("The hideout was");
  await expect(reveal).toContainText("km");

  // Next case deals a fresh case (rings reset).
  await page.getByTestId("next-case-btn").click();
  await expect(page.getByTestId("sighting-card")).toHaveCount(3);
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  await expect(page.getByTestId("coldtrail-reveal")).toHaveCount(0);
});

test("Escape cancels placement mode without locking", async ({ page }) => {
  await openColdTrail(page);

  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-hint")).toContainText("Placement canceled");
  // Back to idle: all three cards offer "Place ring on map" again.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  await expect(page.getByTestId("confirm-ring-btn")).toHaveCount(0);
});

test("switching cards mid-placement discards the draft", async ({ page }) => {
  await openColdTrail(page);

  // Start placing ring 1 and plant a draft.
  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });

  // Tap another card's Place button: implicit switch (draft discarded).
  await page.getByTestId("place-ring-btn").nth(1).click();
  await expect(page.getByTestId("map-hint")).toContainText("Your ring draft was set aside");
  // Card 1 is back to idle; no ring was locked.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  await expect(page.getByTestId("confirm-ring-btn")).toHaveCount(0);
});

test("Move re-locks a ring at the new spot", async ({ page }) => {
  await openColdTrail(page);

  await placeAndLockRing(page, { x: 200, y: 200 });
  await expect(page.getByTestId("move-ring-btn")).toBeVisible();

  // Move re-enters adjusting with the draft at the locked center.
  await page.getByTestId("move-ring-btn").click();
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  // Tap-to-move re-positions, then re-lock.
  await page.getByTestId("loop-map").click({ position: { x: 320, y: 220 } });
  await page.getByTestId("confirm-ring-btn").click();
  // Still exactly one ring locked — Move never duplicates or unlocks.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);
  await expect(page.getByTestId("move-ring-btn")).toHaveCount(1);
});

test("anti-leak: pre-reveal marks are witness dots at player centers only", async ({ page }) => {
  await openColdTrail(page);

  await placeAndLockRing(page, { x: 200, y: 200 });
  await placeAndLockRing(page, { x: 300, y: 250 });
  await placeAndLockRing(page, { x: 400, y: 300 });

  const markFeatures = await sourceFeatures(page, "loop-marks");
  const witnesses = markFeatures.filter((f) => f.properties.kind === "witness");
  const xs = markFeatures.filter((f) => f.properties.kind === "x");
  // Three locked rings → three witness dots at the player centers; the
  // interception "x" only exists post-reveal.
  expect(witnesses).toHaveLength(3);
  expect(xs).toHaveLength(0);

  // The coordinate-level assertion (no rendered coordinate equals any true
  // anchor) is the placement.test.ts I1 unit test; here we pin the layer
  // wiring: no solid-ring feature is secretly a draft, no extra marks.
  const ringFeatures = await sourceFeatures(page, "loop-rings");
  expect(ringFeatures.filter((f) => f.properties.preview === true)).toHaveLength(0);
});

test("paid informant tightens one ring for a star", async ({ page }) => {
  await openColdTrail(page);
  const stars = page.getByTestId("coldtrail-stars");
  await expect(stars).toContainText("⭐ 2");

  await placeAndLockRing(page, { x: 200, y: 200 });
  await page.getByTestId("informant-btn").first().click();
  await expect(stars).toContainText("⭐ 1");
  await expect(page.getByTestId("map-hint")).toContainText("informant tightened");
});
