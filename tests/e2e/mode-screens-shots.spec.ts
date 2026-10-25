import { test, expect, type Page } from "playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  startCountryRun,
} from "./helpers";

/**
 * WI-12 mode-screen screenshot captures (State, Country, GeoDetective,
 * Cold Trail) at 320 / 375 / 768 / 1280 px widths.
 *
 * Env-gated: runs ONLY when MODE_SHOTS=1, otherwise every test skips.
 * PNGs (viewport screenshots, never full page) land in SHOTS_DIR
 * (absolute path) as <screen>-<width>.png — 16 files for a full set.
 * The same spec captures the BEFORE set (unmodified base) and the
 * AFTER set (branch build); navigation flows reuse the existing
 * specs' patterns verbatim (edition-drilldown / helpers /
 * geodetective / coldtrail).
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const SHOTS_DIR = process.env.SHOTS_DIR ?? "";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

/** State: home -> "Choose a state" drill-down -> Nebraska run, aim phase. */
async function openStateRun(page: Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Choose a state" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** Country: helpers.startCountryRun with one fixed country. */
async function openCountryRun(page: Page): Promise<void> {
  await page.goto(BASE);
  await startCountryRun(page, "France");
}

/** GeoDetective: deterministic puzzle via the ?loop-puzzle= seam. */
async function openGeoDetective(page: Page): Promise<void> {
  await page.goto(`${BASE}?loop-puzzle=218`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Cold Trail: editions menu -> trail screen with 3 sighting cards + map. */
async function openColdTrail(page: Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "❄️ Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

const SCREENS: Record<string, (page: Page) => Promise<void>> = {
  state: openStateRun,
  country: openCountryRun,
  geodetective: openGeoDetective,
  coldtrail: openColdTrail,
};

test.describe("WI-12 mode screens screenshots", () => {
  test.skip(
    process.env.MODE_SHOTS !== "1",
    "screenshot captures run only with MODE_SHOTS=1",
  );

  test.beforeEach(async ({ context }) => {
    await serveBuiltArtifact(context);
  });

  for (const [screen, open] of Object.entries(SCREENS)) {
    for (const vp of VIEWPORTS) {
      test(`${screen} @ ${vp.width}x${vp.height}`, async ({ page }) => {
        if (!SHOTS_DIR) throw new Error("SHOTS_DIR (absolute path) is required");
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await open(page);
        // Brief settle so the capture is the screen at rest, not a
        // mid-transition frame. Identical for BEFORE and AFTER sets.
        await page.waitForTimeout(1_000);
        await page.screenshot({
          path: path.join(SHOTS_DIR, `${screen}-${vp.width}.png`),
        });
      });
    }
  }
});
