import { test, expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Film error-path E2E (PR #350 panel-cure round, 2026-11-04).
 *
 * The round-1 pins for the error latch were source-strings only
 * and no E2E ever injected a video error. This spec does, using
 * page routes that abort the GeoDetective film request (route
 * registered after serveBuiltArtifact, so it wins; "allow" falls
 * back to the artifact handler). GeoDetective is the deliberate
 * target: its media is CONSTANT across bands, which is exactly
 * the slot class the panel's B2 block was about.
 *
 * Test 1 — retry + off-screen pause of the CURRENT element:
 *   (a) the film request fails ONCE → the one bounded retry
 *       succeeds → the film mounts and plays (exactly 2 requests);
 *   (c) after that retry REMOUNT, scrolling the slot off-screen
 *       pauses the CURRENT video element. On the round-1 tip the
 *       threshold-0 observer had captured the pre-retry element,
 *       so the remounted film kept playing off-screen and this
 *       test fails at the paused assertion (panel B1).
 *
 * Test 2 — a latched constant-media slot revives on band switch:
 *   (b) the film request fails ALWAYS → the slot latches to the
 *       still (2 requests: try + retry) → switch band 11–13 →
 *       8–10 with the route now allowing → the SAME slot revives
 *       and plays. On the round-1 tip the latch reset was keyed
 *       only on media change, so the slot stays latched and this
 *       test fails at the revival (panel B2); on unmodified main
 *       it fails too (the latch never reset there at all — and
 *       the band-naming toast assertion trips even earlier).
 *
 * Gate solving / settings flow follow band-switch-in-session.
 */

test.setTimeout(300_000);

const PROFILE_KEY = "meridian.ageProfile.v1";
const GEO_FILM_ROUTE = "**/*geodetective-film*.mp4";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes: true } }),
      contentType: "application/json; charset=utf-8",
    });
  });
});

/** Solve the grown-up gate in the UI and land on the age picker. */
async function solveGate(page: Page): Promise<void> {
  const gate = page.getByTestId("grownup-gate");
  await expect(gate).toBeVisible({ timeout: 20_000 });
  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/What is (\d+) × (\d+)\?/);
  expect(m, "gate question shape").not.toBeNull();
  const answer = String(Number(m![1]) * Number(m![2]));
  await page.getByTestId("gate-answer").click();
  for (const d of answer) await page.keyboard.press(d);
  await page.getByTestId("gate-check").click();
  await expect(page.getByTestId("age-picker")).toBeVisible({ timeout: 20_000 });
}

/** Open the settings from the home footer link and solve the gate. */
async function openSettings(page: Page): Promise<void> {
  const footerLink = page.getByTestId("grownups-link");
  await footerLink.scrollIntoViewIfNeeded();
  await footerLink.click();
  await solveGate(page);
}

/** Establish an ACTIVE 11–13 profile through the real UI (first save). */
async function firstSetGeoDetective(page: Page): Promise<void> {
  await openSettings(page);
  const picker = page.getByTestId("age-picker");
  const cards = picker.locator(".agep-card");
  await cards.nth(2).click();
  await page.getByTestId("agep-save").click();
  await expect(page.getByTestId("agep-toast")).toHaveText("Saved — enjoy the trail. 🌿");
  await expect(picker).not.toBeVisible();
}

/** Pick a band card, Save, confirm the switch, assert the band-naming toast. */
async function switchBand(page: Page, cardIndex: number, expectedToast: string): Promise<void> {
  const picker = page.getByTestId("age-picker");
  const cards = picker.locator(".agep-card");
  await expect(cards).toHaveCount(3);
  await cards.nth(cardIndex).click();
  await expect(cards.nth(cardIndex)).toHaveClass(/agep-card-checked/);
  await page.getByTestId("agep-save").click();
  await expect(page.getByTestId("agep-confirm-change")).toBeVisible();
  await page.getByTestId("agep-confirm-switch").click();
  const toast = page.getByTestId("agep-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(expectedToast);
  await expect(picker).not.toBeVisible();
}

/** Scroll a card-film slot into view and wait for its <video> to mount. */
async function mountFilm(page: Page, testId: string): Promise<Locator> {
  const film = page.getByTestId(testId);
  await film.scrollIntoViewIfNeeded();
  const video = film.locator("video");
  await expect(video).toBeVisible({ timeout: 20_000 });
  return video;
}

/** The film is actually playing: not paused, and currentTime advances. */
async function expectPlaying(video: Locator): Promise<void> {
  await expect
    .poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 })
    .toBe(false);
  const t1 = await video.evaluate((v) => v.currentTime);
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(t1);
}

test("film error path: one failed load retries and plays; the remounted film pauses off-screen", async ({
  page,
  context,
}) => {
  // Fail the GeoDetective film's FIRST request; allow the rest
  // through to the built artifact.
  let geoRequests = 0;
  await context.route(GEO_FILM_ROUTE, async (route) => {
    geoRequests += 1;
    if (geoRequests === 1) await route.abort("failed");
    else await route.fallback();
  });

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate((key) => window.localStorage.getItem(key), PROFILE_KEY)).toBeNull();

  // (a) First load fails, the bounded retry succeeds, film plays.
  const video = await mountFilm(page, "card-film-geodetective");
  expect(await video.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(video);
  expect(geoRequests, "exactly one retry was needed").toBe(2);

  // (c) Scroll the slot fully off-screen: the CURRENT (remounted)
  // element must pause — the observer resolves it at event time.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 })
    .toBe(true);
});

test("film error path: a latched constant-media slot revives on band switch", async ({
  page,
  context,
}) => {
  // Fail the GeoDetective film ALWAYS until the switch flips this.
  let geoBlocked = true;
  let geoRequests = 0;
  await context.route(GEO_FILM_ROUTE, async (route) => {
    geoRequests += 1;
    if (geoBlocked) await route.abort("failed");
    else await route.fallback();
  });

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Establish an active 11–13 profile through the real UI while
  // the film keeps failing.
  await firstSetGeoDetective(page);

  // The slot latches to the still: try + one retry, then no video.
  const slot = page.getByTestId("card-film-geodetective");
  await slot.scrollIntoViewIfNeeded();
  await expect.poll(() => geoRequests, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await expect(slot.locator("video")).toHaveCount(0);
  await expect(slot.locator("img")).toBeVisible();

  // Allow the film again and switch band 11–13 → 8–10. The media
  // does NOT change (GeoDetective is constant across bands) — the
  // band change itself must revive the slot.
  geoBlocked = false;
  await openSettings(page);
  await switchBand(page, 1, "Saved — Trail Scout (ages 8–10) ✅");

  const video = await mountFilm(page, "card-film-geodetective");
  expect(await video.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(video);
});
