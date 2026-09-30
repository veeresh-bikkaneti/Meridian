import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  readRun,
  dismissTileOverlayIfPresent,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * F8 edition drill-down picker: Globe -> Country -> State, each level
 * playable, plus the fail-closed dealing policy behind it.
 *
 * - Choose screen offers Globe and Country (no USA-default State card).
 * - Country list lists only countries with a playable pool (no dead ends).
 * - The USA drills into its states; other countries start immediately.
 * - The USA state screen offers "Play entire United States" on top.
 * - Back navigation returns one level at a time.
 * - Every started run deals from the selected subset (edition + regionId).
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openCountryList(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
}

async function openUsStateList(page: Page): Promise<void> {
  await openCountryList(page);
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
}

/** Run identity from sessionStorage: what the dealer is actually working with. */
async function readRunIdentity(page: Page): Promise<{ edition: string; regionId: string }> {
  const run = await readRun(page);
  const identity = run as unknown as { edition: string; regionId: string };
  return { edition: identity.edition, regionId: identity.regionId };
}

/** Wait for a started run: map mounted and phase "aim". */
async function expectRunStarted(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

test("country list shows all playable countries; the USA drills into states", async ({
  page,
}) => {
  await openCountryList(page);
  // All 13 countries have playable pools — no dead ends in the list.
  for (const name of [
    "Australia",
    "Brazil",
    "Canada",
    "China",
    "Egypt",
    "France",
    "Germany",
    "India",
    "Italy",
    "Japan",
    "Mexico",
    "United Kingdom",
    "United States",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  // The USA drills into its states instead of starting a run.
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play entire United States" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Nebraska" })).toBeVisible();
  await expect(page.getByRole("button", { name: "California" })).toBeVisible();
});

test("Play entire United States starts a country run for the whole USA", async ({
  page,
}) => {
  await openUsStateList(page);
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expectRunStarted(page);
  expect(await readRunIdentity(page)).toEqual({
    edition: "country",
    regionId: "united-states",
  });
});

test("a state run deals from that state's pool only", async ({ page }) => {
  await openUsStateList(page);
  await page.getByRole("button", { name: "Nebraska" }).click();
  await expectRunStarted(page);
  expect(await readRunIdentity(page)).toEqual({
    edition: "state",
    regionId: "nebraska",
  });
  // The question bubble is up for the Nebraska run.
  await expect(
    page.locator('p.sr-only[aria-live="polite"]'),
  ).toContainText(/^Find .+\.$/, { timeout: 10_000 });
});

test("a country without states starts a country run immediately", async ({ page }) => {
  await openCountryList(page);
  await page.getByRole("button", { name: "India" }).click();
  await expectRunStarted(page);
  expect(await readRunIdentity(page)).toEqual({
    edition: "country",
    regionId: "india",
  });
});

test("globe still starts a globe run straight from Choose", async ({ page }) => {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectRunStarted(page);
  expect(await readRunIdentity(page)).toEqual({
    edition: "globe",
    regionId: "globe",
  });
});

test("back navigation returns one level at a time", async ({ page }) => {
  await openUsStateList(page);
  // State list -> country list.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  // Country list -> choose screen.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(
    page.getByRole("button", { name: "Choose a country" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
});
