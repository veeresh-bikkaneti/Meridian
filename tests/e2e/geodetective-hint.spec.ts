import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective hint UI E2E (follow-up Item B, owner 2026-10-09).
 *
 * GeoDetective is locked for 5-7 (bands.ts), so the hint surface serves the
 * bands that can actually reach the loop, driven by the deal-time band
 * snapshot's hint policy:
 * - 8-10 ("one-per-round"): hint button visible; one hint per mystery —
 *   disables after use.
 * - 11-13 ("none"): NO hint button at all.
 *
 * The hint itself is the same mechanical quadrant nudge as the quiz loops
 * (hint-logic.ts) — coarse, never pinpoints. Hints never touch points.
 *
 * Deterministic mystery via the ?loop-puzzle= seam (see geodetective.spec.ts):
 * ?loop-puzzle=218 -> Ankara.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

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

/** Open GeoDetective on the pinned Ankara mystery. */
async function openLoop(page: import("playwright/test").Page) {
  await page.goto(`${BASE}?loop-puzzle=218`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

test("8-10: hint button visible, shows a directional hint, then disables", async ({
  page,
  context,
}) => {
  await seedProfile(context, "8-10");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible({ timeout: 15_000 });
  await expect(button).toBeEnabled();

  await button.click();
  const message = page.getByTestId("hint-message");
  await expect(message).toBeVisible({ timeout: 10_000 });
  // Mechanical quadrant nudge — one of the four coarse directions.
  await expect(message).toHaveText(/northern|southern|eastern|western/i);

  // One per mystery: the button disables after use.
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(/Hint used/i);
});

test("11-13: no hint button at all", async ({ page, context }) => {
  await seedProfile(context, "11-13");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  // The panel renders nothing for policy "none" — assert absence, then
  // give the page a beat to prove nothing appears late.
  await expect(page.getByTestId("hint-button")).toHaveCount(0);
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("hint-button")).toHaveCount(0);
});

test("8-10: hint button does not overlap the map or guess input", async ({
  page,
  context,
}) => {
  await seedProfile(context, "8-10");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible({ timeout: 15_000 });

  // AGENTS.md rule #1: floating controls must not intersect neighbors.
  const overlap = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="hint-button"]');
    const map = document.querySelector('[data-testid="loop-map"]');
    if (!btn || !map) return -1;
    const b = btn.getBoundingClientRect();
    const m = map.getBoundingClientRect();
    const x = Math.max(0, Math.min(b.right, m.right) - Math.max(b.left, m.left));
    const y = Math.max(0, Math.min(b.bottom, m.bottom) - Math.max(b.top, m.top));
    return x * y;
  });
  expect(overlap).toBe(0);
});
