import { test, expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * In-session band switch E2E (band-cluster fix set, 2026-11-04).
 *
 * Drives the REAL grown-up settings flow in one session — no
 * seeded band anywhere: the profile starts unset (which resolves
 * to the full-access 11–13 band for rendering), is set to 11–13
 * through the UI, then switched Trail Scout (8–10) → Little
 * Explorer (5–7) → back to 11–13, asserting at each switch:
 *
 * - the stored profile (localStorage `meridian.ageProfile.v1`);
 * - the confirmation toast NAMES the band just saved (owner
 *   ruling 2026-11-04 — before it, the toast was a bare
 *   "Saved ✅", so these toast assertions fail on unmodified
 *   main);
 * - the home surfaces swap in-session: for 8–10 the Review card
 *   film becomes the Trail Scout variant and is playing, and the
 *   GeoDetective card still opens the loop screen; for 5–7 the
 *   GeoDetective card is replaced by the locked tile, whose film
 *   LOOPS (owner ruling 2026-11-04 — before it the film played
 *   once and rested, so the loop assertions fail on unmodified
 *   main), and the tile's grown-up path still opens the gate;
 * - switching back to 11–13 restores the normal card + film.
 *
 * Why the first UI save exists: an unset profile's first save
 * takes the first-set path (no confirm dialog, the "enjoy the
 * trail" toast) by design. Setting 11–13 through the UI first is
 * what makes the Trail Scout switch a real change-confirm — the
 * surface under test — without seeding storage.
 *
 * Gate solving follows age-profile-gate.desktop.spec.ts (read
 * the multiplication question, type the product); media
 * assertions follow band-media-variants.desktop.spec.ts (scroll
 * the slot into view, the <video> mounts lazily).
 */

test.setTimeout(300_000);

const PROFILE_KEY = "meridian.ageProfile.v1";

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

/**
 * Pick a band card (picker order is the band table's: 0 = 5–7
 * Little Explorer, 1 = 8–10 Trail Scout, 2 = 11–13 GeoDetective),
 * Save, and confirm the switch. Asserts the band-naming toast.
 */
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

async function storedBand(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { band: string | null }).band : null;
  }, PROFILE_KEY);
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

test("band switches apply in-session: films swap, locked tile loops, toasts name the band", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Fresh profile: nothing stored; rendering resolves to 11–13.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), PROFILE_KEY)).toBeNull();

  // Establish an ACTIVE 11–13 profile through the real UI (first
  // save: no confirm dialog by design, the first-save toast).
  await openSettings(page);
  {
    const picker = page.getByTestId("age-picker");
    const cards = picker.locator(".agep-card");
    await cards.nth(2).click();
    await page.getByTestId("agep-save").click();
    await expect(page.getByTestId("agep-toast")).toHaveText("Saved — enjoy the trail. 🌿");
    await expect(picker).not.toBeVisible();
  }
  expect(await storedBand(page)).toBe("11-13");

  // ── (1) Switch to Trail Scout (8–10) ──────────────────────────
  await openSettings(page);
  await switchBand(page, 1, "Saved — Trail Scout (ages 8–10) ✅");
  expect(await storedBand(page)).toBe("8-10");

  // Home films swapped in-session: Review is the Trail Scout
  // variant and playing; Cold Trail stays the standard film.
  const reviewVideo = await mountFilm(page, "card-film-review");
  expect(await reviewVideo.getAttribute("src")).toContain("review-film-trail-scout");
  await expectPlaying(reviewVideo);
  const coldtrailVideo = await mountFilm(page, "card-film-coldtrail");
  expect(await coldtrailVideo.getAttribute("src")).not.toContain("little-explorer");
  await expectPlaying(coldtrailVideo);

  // Clicking the GeoDetective card opens the loop screen.
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // ── (2) Switch to Little Explorer (5–7) ───────────────────────
  await openSettings(page);
  await switchBand(page, 0, "Saved — Little Explorer (ages 5–7) ✅");
  expect(await storedBand(page)).toBe("5-7");

  // The GeoDetective card is replaced by the locked tile.
  const lockedTile = page.getByTestId("locked-loop-tile");
  await expect(lockedTile).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("card-film-geodetective")).toHaveCount(0);

  // The locked film is a LOOPING video: the loop attribute is set
  // and playback wraps past one duration instead of ending.
  const lockedVideo = await mountFilm(page, "locked-tile-film");
  expect(await lockedVideo.evaluate((v) => v.loop), "locked film loop attribute").toBe(true);
  await expectPlaying(lockedVideo);
  const duration = await lockedVideo.evaluate((v) => v.duration);
  expect(duration).toBeGreaterThan(0);
  await expect
    .poll(() => lockedVideo.evaluate((v) => v.currentTime), { timeout: 30_000 })
    .toBeGreaterThan(duration - 2.5);
  const nearEnd = await lockedVideo.evaluate((v) => v.currentTime);
  await expect
    .poll(() => lockedVideo.evaluate((v) => v.currentTime), { timeout: 20_000 })
    .toBeLessThan(nearEnd);
  expect(await lockedVideo.evaluate((v) => v.ended)).toBe(false);

  // The tile's "Grown-ups, open here" path still opens the gate.
  await lockedTile
    .getByRole("button", { name: "For grown-ups: open game settings" })
    .click();
  await expect(page.getByTestId("grownup-gate")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).not.toBeVisible();

  // ── (3) Switch back to 11–13 ──────────────────────────────────
  await openSettings(page);
  await switchBand(page, 2, "Saved — GeoDetective (ages 11–13) ✅");
  expect(await storedBand(page)).toBe("11-13");

  // The normal GeoDetective card + film return.
  await expect(page.getByTestId("locked-loop-tile")).toHaveCount(0);
  const geoVideo = await mountFilm(page, "card-film-geodetective");
  expect(await geoVideo.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(geoVideo);
});
