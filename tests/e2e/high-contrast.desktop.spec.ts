/**
 * High-contrast view E2E (Council manifest 2026-10-27-high-contrast-view,
 * Councilor B's contracts; built Pages artifact via serveBuiltArtifact).
 *
 * The feature: a settings toggle (home `high-contrast-toggle`, in-game
 * `high-contrast-toggle-game`) persisted under localStorage
 * `meridian.palette` ("high-contrast" / "standard" — selectPalette's
 * token language), applied as `data-palette="high-contrast"` on the
 * root element, whose styles.css block overrides the five --map-*
 * tokens with the HIGH_CONTRAST palette.
 *
 * Assertions are feature-level, never label-only (the 2026-10-20 Scout
 * lesson): the COMPUTED --map-land / --map-water values must actually
 * change to the HIGH_CONTRAST hexes, persistence must survive a real
 * reload, a mid-run swap must not navigate or lose the round, and a
 * corrupt stored value must fail closed to standard with the app
 * still booting and playing. No canvas pixel sampling (software
 * rendering varies across machines).
 */
import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, readPhase, APP_NO_IDLE } from "./helpers";

test.setTimeout(180_000);

const PALETTE_KEY = "meridian.palette";
const HC_LAND = "#f6f3ea";
const HC_WATER = "#0b0d10";

async function dataPalette(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute("data-palette"));
}

async function mapVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

async function storedPalette(page: Page): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY);
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("toggle on applies high contrast without navigation, toggle off restores standard", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const urlBefore = page.url();
  const landBefore = await mapVar(page, "--map-land");
  expect(landBefore).not.toBe(HC_LAND);
  expect(await dataPalette(page)).toBeNull();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
  expect(await mapVar(page, "--map-water")).toBe(HC_WATER);
  expect(await storedPalette(page)).toBe("high-contrast");
  expect(page.url()).toBe(urlBefore);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await dataPalette(page)).toBeNull();
  expect(await mapVar(page, "--map-land")).toBe(landBefore);
  expect(await storedPalette(page)).toBe("standard");
  expect(page.url()).toBe(urlBefore);
});

test("toggle pressed state is visible: computed background differs on and off", async ({ page }) => {
  // Panel BLOCK 3 (UX Designer): aria-pressed alone is invisible to the
  // sighted low-vision users this feature serves. The pressed treatment
  // (brass fill, the .atlas-seg pattern) must change the toggle's
  // COMPUTED background-color between states on the home placement.
  await page.goto(APP_NO_IDLE);
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const bgOff = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  const colorOff = await toggle.evaluate((el) => getComputedStyle(el).color);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const bgOn = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  const colorOn = await toggle.evaluate((el) => getComputedStyle(el).color);
  expect(bgOn).not.toBe(bgOff);
  expect(colorOn).not.toBe(colorOff);
  // The pin centre-dot seam (D9 condition (f)): standard dot is the
  // translucent value; under high contrast the computed var goes solid.
  expect(await mapVar(page, "--map-pin-dot")).toBe("#f6f3ea");
  expect(await mapVar(page, "--map-pin")).toBe("#b04a9e");
  expect(await mapVar(page, "--map-answer")).toBe("#a86c00");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const bgBack = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgBack).toBe(bgOff);
  expect(await mapVar(page, "--map-pin-dot")).toBe("rgba(0,0,0,0.38)");
});

test("high contrast persists across reload", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("high-contrast-toggle").click();
  expect(await storedPalette(page)).toBe("high-contrast");

  await page.reload();
  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
});

test("live swap in a run does not navigate or lose the round", async ({ page }) => {
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");
  const urlBefore = page.url();

  const toggle = page.getByTestId("high-contrast-toggle-game");
  await expect(toggle).toBeVisible();
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await dataPalette(page)).toBe("high-contrast");
  expect(await mapVar(page, "--map-land")).toBe(HC_LAND);
  expect(await storedPalette(page)).toBe("high-contrast");
  // Still in the same run: no navigation home, aim phase intact.
  expect(page.url()).toBe(urlBefore);
  expect(await readPhase(page)).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible();
});

test("corrupt stored value falls back to standard and the app still boots and plays", async ({
  page,
}) => {
  await page.addInitScript((k) => {
    try {
      localStorage.setItem(k, "banana");
    } catch {
      // Storage seeding is best-effort; the assertions below are the test.
    }
  }, PALETTE_KEY);
  await page.goto(APP_NO_IDLE);

  const toggle = page.getByTestId("high-contrast-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await dataPalette(page)).toBeNull();
  expect(await mapVar(page, "--map-land")).not.toBe(HC_LAND);

  // The game still starts and reaches the aim phase on the fallback.
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");
  expect(await dataPalette(page)).toBeNull();
});
