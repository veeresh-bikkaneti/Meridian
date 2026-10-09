import { test, expect } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun } from "./helpers";

/**
 * Hint button E2E (follow-up Item A — hints are a REAL feature).
 *
 * - 5-7 ("free"): hint button visible and enabled; tapping shows a
 *   directional hint; multiple hints allowed.
 * - 8-10 ("one-per-round"): button visible and enabled initially;
 *   disables after one use on the place.
 * - 11-13 ("none"): NO hint button at all (Clean Round stays earnable).
 * - 5-7 mascot offer: after 2 misses, an opt-in offer appears.
 */

const PROFILE_KEY = "meridian.ageProfile.v1";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Seed an active age profile before page load. */
async function seedProfile(
  context: import("playwright/test").BrowserContext,
  band: "5-7" | "8-10" | "11-13",
) {
  await context.addInitScript((b: string) => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: b,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 1,
      }),
    );
  }, band);
}

test("5-7: hint button visible, tap shows a directional hint", async ({
  page,
  context,
}) => {
  await seedProfile(context, "5-7");
  await startGlobeRun(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  await button.click();
  const message = page.getByTestId("hint-message");
  await expect(message).toBeVisible();
  // Directional nudge — one of the four quadrants, never the answer.
  await expect(message).toContainText(/northern|southern|eastern|western/);

  // Free policy: button stays enabled for another hint.
  await expect(button).toBeEnabled();
});

test("8-10: hint button disables after one use", async ({ page, context }) => {
  await seedProfile(context, "8-10");
  await startGlobeRun(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  await button.click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(/hint used/i);
});

test("11-13: no hint button at all", async ({ page, context }) => {
  await seedProfile(context, "11-13");
  await startGlobeRun(page);

  await expect(page.getByTestId("hint-button")).toHaveCount(0);
  await expect(page.getByTestId("hint-panel")).toHaveCount(0);
});

test("5-7: mascot offer appears after 2 misses", async ({ page, context }) => {
  await seedProfile(context, "5-7");
  await startGlobeRun(page);

  // Miss twice: drop a pin far from the target, twice. The miss flow
  // ends the place ("done" phase); continue to the next place each time.
  for (let i = 0; i < 2; i++) {
    // Click a corner of the map — far from any likely target.
    await page.mouse.click(50, 700);
    const drop = page.getByRole("button", { name: /drop pin/i });
    await expect(drop).toBeEnabled({ timeout: 10_000 });
    await drop.click();
    // Wait for the miss to resolve (phase "done"), then continue.
    await page.getByRole("button", { name: "Next place" }).click({ timeout: 20_000 });
  }

  // After 2 misses, the mascot offer should appear (opt-in).
  const offer = page.getByTestId("hint-offer");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toContainText(/want a hint/i);

  // Accepting the offer shows the hint.
  await offer.getByRole("button", { name: /yes please/i }).click();
  await expect(page.getByTestId("hint-message")).toBeVisible();
});
