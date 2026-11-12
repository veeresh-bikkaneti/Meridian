import { test, expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * In-session band switch E2E (band-cluster fix set, 2026-11-04;
 * moved to the 7-10 / 10-18 / 18+ groups).
 *
 * Drives the REAL grown-up settings flow in one session — no
 * seeded band anywhere: the profile starts unset (which resolves
 * to the full-access 10-18 group for rendering), is set to 10-18
 * through the UI, then switched 7-10 -> 18+ -> back to 10-18,
 * asserting at each switch:
 *
 * - the stored profile (localStorage `meridian.ageProfile.v1`);
 * - the confirmation toast NAMES the group just saved (owner
 *   ruling 2026-11-04; the label already reads "Ages 7-10" and
 *   18+ shows no made-up ceiling);
 * - the home surfaces swap in-session: for 7-10 the Review card
 *   film becomes the Trail Scout variant and is playing, and the
 *   GeoDetective card still opens the loop screen; for 18+ the
 *   Review film returns to the standard one and the GeoDetective
 *   card is still present (no group locks GeoDetective now, so the
 *   locked-tile loop assertions that belonged to the old 5-7 band
 *   were removed: that tile cannot be reached from this flow);
 * - switching back to 10-18 restores the normal card + film.
 *
 * Why the first UI save exists: an unset profile's first save
 * takes the first-set path (no confirm dialog, the "enjoy the
 * trail" toast) by design. Setting 10-18 through the UI first is
 * what makes the 7-10 switch a real change-confirm — the
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
 * Pick a group card (picker order is the band table's: 0 = 7-10,
 * 1 = 10-18, 2 = 18+),
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

test("band switches apply in-session: films swap, toasts name the group", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Fresh profile: nothing stored; rendering resolves to 10-18.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), PROFILE_KEY)).toBeNull();

  // Establish an ACTIVE 10-18 profile through the real UI (first
  // save: no confirm dialog by design, the first-save toast).
  await openSettings(page);
  {
    const picker = page.getByTestId("age-picker");
    const cards = picker.locator(".agep-card");
    await cards.nth(1).click();
    await page.getByTestId("agep-save").click();
    await expect(page.getByTestId("agep-toast")).toHaveText("Saved — enjoy the trail. 🌿");
    await expect(picker).not.toBeVisible();
  }
  expect(await storedBand(page)).toBe("10-18");

  // ── (1) Switch to 7-10 ──────────────────────────
  await openSettings(page);
  await switchBand(page, 0, "Saved — Ages 7-10 ✅");
  expect(await storedBand(page)).toBe("7-10");

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

  // ── (2) Switch to 18+ ─────────────────────────────────────────
  await openSettings(page);
  await switchBand(page, 2, "Saved — Ages 18+ ✅");
  expect(await storedBand(page)).toBe("18+");

  // The standard Review film returns; GeoDetective is not locked.
  const reviewVideo18 = await mountFilm(page, "card-film-review");
  expect(await reviewVideo18.getAttribute("src")).not.toContain("trail-scout");
  await expect(page.getByTestId("locked-loop-tile")).toHaveCount(0);
  await expect(page.getByTestId("card-film-geodetective")).toHaveCount(1);

  // ── (3) Switch back to 10-18 ──────────────────────────────────
  await openSettings(page);
  await switchBand(page, 1, "Saved — Ages 10-18 ✅");
  expect(await storedBand(page)).toBe("10-18");

  // The normal GeoDetective card + film return.
  await expect(page.getByTestId("locked-loop-tile")).toHaveCount(0);
  const geoVideo = await mountFilm(page, "card-film-geodetective");
  expect(await geoVideo.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(geoVideo);
});
