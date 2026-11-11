import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective hint UI E2E (follow-up Item B, owner 2026-10-09).
 *
 * The hint surface is driven by the deal-time band snapshot's hint policy
 * (7-10 "free", 10-18 "one-per-round", 18+ "none"); these specs pin the
 * one-per-round and none policies:
 * - 10-18 ("one-per-round"): hint button visible; one hint per mystery —
 *   disables after use.
 * - 18+ ("none"): NO hint button at all.
 * - No profile set (the default): hints ON (owner 2026-10-20) — the deal
 *   snapshot carries "one-per-round", so the bulb shows like 10-18.
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
  band: "7-10" | "10-18" | "18+",
) {
  await context.addInitScript((b: string) => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: b,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 2,
      }),
    );
  }, band);
}

/** Open GeoDetective on the pinned Ankara mystery. */
async function openLoop(page: import("playwright/test").Page) {
  await page.goto(`${BASE}?loop-puzzle=218`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

test("10-18: hint button visible, shows a directional hint, then disables", async ({
  page,
  context,
}) => {
  await seedProfile(context, "10-18");
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

test("10-18: hint stays used after a mid-mystery reload (#185, B7)", async ({
  page,
  context,
}) => {
  await seedProfile(context, "10-18");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible({ timeout: 15_000 });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(/Hint used/i);

  // Reload mid-mystery: B7 lands on Home (no auto-open from the saved
  // flag); tapping the resume variant reopens the mystery, and the
  // persisted puzzle carries hintsUsed = 1. Pre-#185 the local counter
  // remounted at zero and the button came back enabled — a second hint
  // for a one-per-round player.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "GeoDetective: Resume your case" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "GeoDetective: Resume your case" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  const afterReload = page.getByTestId("hint-button");
  await expect(afterReload).toBeVisible({ timeout: 15_000 });
  await expect(afterReload).toBeDisabled();
  await expect(afterReload).toHaveAccessibleName(/Hint used/i);
});

test("10-18: a reload BEFORE any hint keeps the button enabled (#185 negative control, B7)", async ({
  page,
  context,
}) => {
  await seedProfile(context, "10-18");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible({ timeout: 15_000 });
  await expect(button).toBeEnabled();

  // Hydration must restore the persisted count — zero here — not a
  // sticky "used". Guards against an over-eager fix that disables the
  // button after any reload. B7: the reload lands on Home; the button
  // is checked after tapping back into the resumed mystery.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "GeoDetective: Resume your case" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "GeoDetective: Resume your case" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  const afterReload = page.getByTestId("hint-button");
  await expect(afterReload).toBeVisible({ timeout: 15_000 });
  await expect(afterReload).toBeEnabled();
});

test("18+: no hint button at all", async ({ page, context }) => {
  await seedProfile(context, "18+");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  // The panel renders nothing for policy "none" — assert absence, then
  // give the page a beat to prove nothing appears late.
  await expect(page.getByTestId("hint-button")).toHaveCount(0);
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("hint-button")).toHaveCount(0);
});

test("no profile (default): hint button visible, shows a directional hint, then disables", async ({
  page,
}) => {
  // Owner, 2026-10-20: hints on by default. NO seedProfile call — the
  // deal snapshot minted for an unset profile carries "one-per-round",
  // and LoopScreen reads the mystery's own dealBandConfig snapshot, so
  // the bulb shows here exactly like the quiz loops.
  await page.setViewportSize({ width: 390, height: 844 });
  await openLoop(page);

  const button = page.getByTestId("hint-button");
  await expect(button).toBeVisible({ timeout: 15_000 });
  await expect(button).toBeEnabled();

  await button.click();
  const message = page.getByTestId("hint-message");
  await expect(message).toBeVisible({ timeout: 10_000 });
  await expect(message).toHaveText(/northern|southern|eastern|western/i);

  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(/Hint used/i);
});

for (const [w, h] of [[360, 740], [390, 844]] as const) {
  test(`${w}x${h}: hint button does not overlap the map or guess input`, async ({
    page,
    context,
  }) => {
    await seedProfile(context, "10-18");
    await page.setViewportSize({ width: w, height: h });
    await openLoop(page);

    const button = page.getByTestId("hint-button");
    await expect(button).toBeVisible({ timeout: 15_000 });
    // #113 BLOCK: the guess-input assertion was vacuous (no such testid
    // existed). Both neighbors must be present and non-overlapping.
    await expect(page.getByTestId("loop-map")).toBeVisible();
    await expect(page.getByTestId("loop-guess-input")).toBeVisible();

    // AGENTS.md rule #1: floating controls must not intersect neighbors.
    const overlap = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="hint-button"]');
      const map = document.querySelector('[data-testid="loop-map"]');
      const guess = document.querySelector('[data-testid="loop-guess-input"]');
      if (!btn || !map || !guess) return -1;
      const b = btn.getBoundingClientRect();
      const boxes = [map, guess].map((el) => (el as Element).getBoundingClientRect());
      let total = 0;
      for (const r of boxes) {
        const x = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left));
        const y = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top));
        total += x * y;
      }
      return total;
    });
    expect(overlap).toBe(0);
  });
}
