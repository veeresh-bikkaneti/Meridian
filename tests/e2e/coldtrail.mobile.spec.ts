import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Cold Trail placement mode on the acceptance device: 390×844, touch.
 * (Runs in the "mobile" project — viewport + hasTouch come from there.)
 *
 * Pins the kid-critical beats on a phone: the whole place→adjust→lock loop
 * works with touch taps, and every placement control is a ≥44px target.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openColdTrail(page: import("playwright/test").Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "❄️ Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

test("mobile: full placement loop with touch taps", async ({ page }) => {
  await openColdTrail(page);

  const taps = [
    { x: 150, y: 250 },
    { x: 220, y: 300 },
    { x: 120, y: 350 },
  ];
  for (const tap of taps) {
    await page.getByTestId("place-ring-btn").first().click();
    await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
    await page.getByTestId("loop-map").click({ position: tap });
    await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("confirm-ring-btn").click();
  }
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(0);
  // Scoped to the hint live region: the map section shows the same sentence
  // as plain text, which getByText would match twice (strict-mode).
  await expect(page.getByTestId("map-hint")).toContainText("All 3 rings are down");

  // Intercept tap → confirm → reveal, all by touch.
  await page.getByTestId("loop-map").click({ position: { x: 180, y: 300 } });
  await expect(page.getByTestId("intercept-confirm")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("intercept-confirm-btn").click();
  await expect(page.getByTestId("coldtrail-reveal")).toContainText("The hideout was", {
    timeout: 10_000,
  });
});

test("mobile: placement controls are ≥44px touch targets", async ({ page }) => {
  await openColdTrail(page);

  const placeBtn = page.getByTestId("place-ring-btn").first();
  const placeBox = await placeBtn.boundingBox();
  expect(placeBox?.height).toBeGreaterThanOrEqual(44);

  await placeBtn.click();
  await page.getByTestId("loop-map").click({ position: { x: 150, y: 250 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });

  for (const testId of ["confirm-ring-btn", "change-spot-btn"]) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  // Touch path has no Esc: the banner Cancel is the exit — it must be a
  // 44px target too.
  const bannerBox = await page.getByTestId("cancel-placement-banner-btn").boundingBox();
  expect(bannerBox?.height).toBeGreaterThanOrEqual(44);
});

test("mobile: cancel placement via the banner button", async ({ page }) => {
  await openColdTrail(page);

  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 150, y: 250 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });

  // Touch path has no Esc — the banner Cancel is the primary exit.
  await page.getByTestId("cancel-placement-banner-btn").click();
  await expect(page.getByTestId("map-hint")).toContainText("Placement canceled");
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  // Same WCAG 2.4.3 contract as the Escape path: focus returns to the
  // card's Place button, not <body>.
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-testid") === "place-ring-btn",
    { timeout: 5_000 },
  );
});
