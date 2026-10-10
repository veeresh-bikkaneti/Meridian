import { test, expect } from "playwright/test";
import { serveBuiltArtifact, sourceFeatures } from "./helpers";

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
  // Taps are clustered so the three rings genuinely triple-overlap
  // (disjoint rings are covered by the dedicated disjoint test below).
  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 300, y: 250 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  // minFeatures=2 (preview ring + its km label): waits out the passive-
  // effect repaint so the assertion can't race the paint.
  const ringFeatures = await sourceFeatures(page, "loop-rings", 2);
  const previews = ringFeatures.filter((f) => f.properties.preview === true);
  expect(previews.length).toBeGreaterThan(0);
  // Lock ring 1.
  await page.getByTestId("confirm-ring-btn").click();
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);

  // Rings 2 and 3 (clustered with ring 1 for genuine triple-overlap).
  await placeAndLockRing(page, { x: 315, y: 240 });
  await placeAndLockRing(page, { x: 285, y: 265 });
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(0);

  // All three locked: the status line invites the interception tap.
  // (Scoped to the hint live region: the map section shows the same
  // sentence as plain text, which getByText would match twice.)
  await expect(page.getByTestId("map-hint")).toContainText("All 3 rings are down");

  // F11 overlap lens: all 3 locked → the triple-intersection paints.
  const overlapFeatures = await sourceFeatures(page, "loop-overlap", 1);
  expect(overlapFeatures.length).toBeGreaterThan(0);
  // One-time pulse pings at the overlap centroid, then goes away.
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(0, { timeout: 10_000 });

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
  // Focus returns to the card's Place button (WCAG 2.4.3) — the rAF-deferred
  // focus must land on the committed idle tree, not <body>.
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-testid") === "place-ring-btn",
    { timeout: 5_000 },
  );
});

test("keyboard-only: Enter plants the first draft ring, arrows nudge it", async ({ page }) => {
  await openColdTrail(page);

  // Arm placement via keyboard: focus the Place button, press Enter.
  await page.getByTestId("place-ring-btn").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  // Focus moves to the map (WCAG 2.4.3).
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-testid") === "loop-map",
    { timeout: 5_000 },
  );

  // No draft yet: Enter plants it at the map center (P0 fix — keyboard
  // users could never plant the first ring before this).
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("map-hint")).toContainText("Ring planted");

  // Arrows nudge the planted draft: the hint announces the move.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("map-hint")).toContainText("Ring moved north", { timeout: 10_000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("map-hint")).toContainText("Ring moved", { timeout: 10_000 });

  // The draft renders as a preview ring (dashed = not locked yet).
  const ringFeatures = await sourceFeatures(page, "loop-rings", 2);
  const previews = ringFeatures.filter((f) => f.properties.preview === true);
  expect(previews.length).toBeGreaterThan(0);

  // Lock it via keyboard: tab to "Yes, keep it" and press Enter.
  await page.getByTestId("confirm-ring-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
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
  // Card 1 is back to idle and card 3 never left it (2 Place buttons); the
  // placing card shows "✖ Cancel placement" instead (approved state
  // machine: the placing card never shows a Place button). No ring locked.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);
  await expect(page.getByTestId("cancel-placement-btn")).toHaveCount(1);
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

  const markFeatures = await sourceFeatures(page, "loop-marks", 3);
  const witnesses = markFeatures.filter((f) => f.properties.kind === "witness");
  const xs = markFeatures.filter((f) => f.properties.kind === "x");
  // Three locked rings → three witness dots at the player centers; the
  // interception "x" only exists post-reveal.
  expect(witnesses).toHaveLength(3);
  expect(xs).toHaveLength(0);

  // The coordinate-level assertion (no rendered coordinate equals any true
  // anchor) is the placement.test.ts I1 unit test; here we pin the layer
  // wiring: no solid-ring feature is secretly a draft, no extra marks.
  // minFeatures=6 (3 locked rings + 3 km labels): waits out the paint.
  const ringFeatures = await sourceFeatures(page, "loop-rings", 6);
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

test("placement mode: map canvas shows crosshair cursor", async ({ page }) => {
  await openColdTrail(page);

  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");

  // The crosshair must be on MapLibre's canvas element itself:
  // a container-level cursor class is defeated by .maplibregl-canvas's
  // own cursor rule (grab).
  const cursor = await page
    .getByTestId("loop-map")
    .locator("canvas")
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("crosshair");

  // Leaving placement restores the default cursor.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-hint")).not.toContainText("Tap where you think the ring goes");
  const cursorAfter = await page
    .getByTestId("loop-map")
    .locator("canvas")
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursorAfter).not.toBe("crosshair");
});

test("disjoint rings: no centroid dot, hint says they don't cross", async ({ page }) => {
  await openColdTrail(page);

  // Plant 3 rings far apart so they share no common area. Positions stay
  // well inside the map viewport.
  await placeAndLockRing(page, { x: 80, y: 120 });
  await placeAndLockRing(page, { x: 300, y: 120 });
  await placeAndLockRing(page, { x: 190, y: 280 });

  // Honest copy: no "tap where they cross" when there is no crossing.
  await expect(page.getByTestId("map-hint")).toContainText("don't cross");

  // Wait for the paint (3 witness dots are painted in the same pass).
  const markFeatures = await sourceFeatures(page, "loop-marks", 3);
  expect(markFeatures.filter((f) => f.properties.kind === "witness")).toHaveLength(3);

  // No centroid dot and no polygon for disjoint rings — a marker at the
  // centroid would read as a fake "answer" point.
  const overlapFeatures = await sourceFeatures(page, "loop-overlap", 0);
  expect(overlapFeatures.filter((f) => f.properties.kind === "overlap-centroid")).toHaveLength(0);
  expect(overlapFeatures.filter((f) => f.properties.kind === "overlap")).toHaveLength(0);

  // No pulse fires at a fake center either.
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(0);
});
