import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Cold Trail vertical-slice deploy-gate E2E.
 *
 * One case = 3 sightings → place 3 rings → tap the interception guess →
 * confirm → score reveal. The deck is build-time generated and bundled,
 * so case #1 is always first on a fresh profile (store starts at index 0).
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

test("full slice: 3 rings → tap → confirm → score reveal", async ({ page }) => {
  await openColdTrail(page);

  // Tapping the map before all rings are placed raises the hint, not the sheet.
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("intercept-confirm")).toHaveCount(0);
  await expect(page.getByTestId("map-hint")).toContainText("Place all 3 rings first");

  // Place all three rings (each button unmounts once its ring is placed).
  const placeButtons = page.getByTestId("place-ring-btn");
  await expect(placeButtons).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await placeButtons.first().click();
  }
  await expect(placeButtons).toHaveCount(0);

  // Tap the map: the intercept confirm sheet opens.
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
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

test("paid informant tightens one ring for a star", async ({ page }) => {
  await openColdTrail(page);
  const stars = page.getByTestId("coldtrail-stars");
  await expect(stars).toContainText("⭐ 2");

  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("informant-btn").first().click();
  await expect(stars).toContainText("⭐ 1");
  await expect(page.getByTestId("map-hint")).toContainText("informant tightened");
});
