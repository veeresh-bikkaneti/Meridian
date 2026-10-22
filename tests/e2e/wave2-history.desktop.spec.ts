import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  readRun,
  dropButton,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * WI-8 (Branch 2): browser Back walks the app's screens.
 *
 * The app is a single-route SPA — screens are state, not routes — so
 * GameApp pushes same-URL history entries for home → picker → round →
 * result and popstate drives the state back (src/lib/screen-history.ts).
 * These tests assert the player's experience: Back from the picker,
 * from inside a round, and from the result summary steps back through
 * the game and NEVER leaves the app (the URL never changes and no
 * blank/exit page appears); refresh-resume is unchanged.
 *
 * Base coverage: the repo harness serves the built Pages artifact at
 * the /Meridian/ base (serveBuiltArtifact) — the same topology as CI.
 * The history layer never reads or writes the URL (state-only
 * pushState/replaceState with no URL argument), so its behavior is
 * identical at the Workers build's / base by construction; the two
 * builds differ only in Vite's asset base.
 */

const APP = "http://127.0.0.1:4123/Meridian/";

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Suppress Grandpa's tour + the tutorial invite so the home is quiet. */
async function seedQuietHome(page: Page) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.context().addInitScript((t: string) => {
    try {
      localStorage.setItem("meridian.grandpaTour.lastDate", t);
      localStorage.setItem("meridian.tutorialSeen", "1");
    } catch {
      /* private mode — ignore */
    }
  }, today);
}

async function openCountryList(page: Page) {
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
}

async function startFranceRun(page: Page) {
  await page.getByRole("button", { name: "France" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

async function expectHome(page: Page) {
  await expect(page.locator(".hv5-h1")).toBeVisible();
  expect(page.url()).toBe(APP);
}

/** Place a pin: the map's intro flight can swallow an early click, so
 *  try a few spots over the country until Drop pin arms. */
async function placePin(page: Page) {
  for (const [x, y] of [
    [700, 380],
    [500, 400],
    [760, 430],
  ]) {
    await page.mouse.click(x, y);
    try {
      await expect(dropButton(page)).toBeEnabled({ timeout: 3_000 });
      return;
    } catch {
      /* try the next spot */
    }
  }
  throw new Error("pin never armed Drop pin");
}

test("Back walks picker drill-down, round, and result — and never exits", async ({ page }) => {
  await seedQuietHome(page);
  await page.goto(APP);
  await expectHome(page);

  // Picker + drill-down: home → countries → United States (admin1).
  await openCountryList(page);
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();

  // Back steps up one picker level, then home. The app never exits.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  expect(page.url()).toBe(APP);
  await page.goBack();
  await expectHome(page);

  // Round: home → countries → France starts a run immediately.
  await openCountryList(page);
  await startFranceRun(page);

  // Back from inside the round lands on the picker, run dropped.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  expect(page.url()).toBe(APP);
  await expect.poll(() => readRun(page)).toBeNull();

  // Result: re-enter, play one place, End game → summary.
  await startFranceRun(page);
  await placePin(page);
  await dropButton(page).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toMatch(/^(story|done)$/);
  await page.getByRole("button", { name: "Next place" }).click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible();

  // Back from the result lands on the picker (the finished round is
  // consumed — it is never resurrected), then home.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeHidden();
  expect(page.url()).toBe(APP);
  await page.goBack();
  await expectHome(page);
});

test("refresh-resume is unchanged, and Back from a resumed round stays in the game", async ({
  page,
}) => {
  await seedQuietHome(page);
  await page.goto(APP);
  await openCountryList(page);
  await startFranceRun(page);

  // Refresh mid-round: the run resumes from sessionStorage as before.
  await page.reload();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // The boot rebuild restored the stack under the resumed round:
  // Back lands on the picker instead of leaving the game.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  expect(page.url()).toBe(APP);
  await page.goBack();
  await expectHome(page);
});
