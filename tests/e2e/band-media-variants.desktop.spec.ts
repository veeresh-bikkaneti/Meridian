import { test, expect } from "playwright/test";
import type { BrowserContext, Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Band-variant card media E2E (band-motion port, Units 2–3).
 *
 * The home page picks two of its five card films by age band,
 * through the pure selectors in src/assets/home-v5/card-media.ts:
 * Little Explorer ("5-7") gets the softer Cold Trail film, Trail
 * Scout ("8-10") gets the regenerated Review film, and every
 * other band — including an unset profile, which resolves to
 * "11-13" — gets the standard films.
 *
 * Per-band lazy loading is the point under test, so each case
 * watches the network: the band's own variant .mp4 must be
 * requested once its card nears the viewport, and the film it
 * replaces must never be requested at all. The standard film of
 * the OTHER affected card serves as the positive control — it
 * proves the slot mounted and would have fetched a variant had
 * the wiring picked one.
 *
 * The profile lives in localStorage key meridian.ageProfile.v1,
 * seeded before navigation (the age-profile-gate spec's pattern).
 * Film URLs are matched by file-name token; the built artifact
 * appends a content hash, so matching is by substring, with the
 * variant token checked before the standard one it contains.
 */

test.setTimeout(180_000);

const PROFILE_KEY = "meridian.ageProfile.v1";

async function setupContext(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes: true } }),
      contentType: "application/json; charset=utf-8",
    });
  });
}

async function seedBand(context: BrowserContext, band: "5-7" | "8-10" | "11-13") {
  await context.addInitScript(
    ({ key, b }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: b,
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 1,
        }),
      );
    },
    { key: PROFILE_KEY, b: band },
  );
}

function watchMp4s(context: BrowserContext): string[] {
  const urls: string[] = [];
  context.on("request", (req) => {
    const url = req.url();
    if (url.endsWith(".mp4")) urls.push(url);
  });
  return urls;
}

const isLeColdtrail = (u: string) => u.includes("coldtrail-film-little-explorer");
const isStdColdtrail = (u: string) => u.includes("coldtrail-film") && !u.includes("little-explorer");
const isTsReview = (u: string) => u.includes("review-film-trail-scout");
const isStdReview = (u: string) => u.includes("review-film") && !u.includes("trail-scout");

/** Scroll a card-film slot into view and wait for its <video> to mount. */
async function mountFilm(page: Page, testId: string): Promise<string> {
  const film = page.getByTestId(testId);
  await film.scrollIntoViewIfNeeded();
  const video = film.locator("video");
  await expect(video).toBeVisible({ timeout: 20_000 });
  const src = await video.getAttribute("src");
  expect(src, `${testId} video src`).toBeTruthy();
  return src!;
}

test.beforeEach(async ({ context }) => {
  await setupContext(context);
});

test("5-7 (Little Explorer): Cold Trail fetches the LE variant, never the standard; Review stays standard", async ({
  context,
  page,
}) => {
  await seedBand(context, "5-7");
  const mp4s = watchMp4s(context);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  const ctSrc = await mountFilm(page, "card-film-coldtrail");
  expect(ctSrc).toContain("coldtrail-film-little-explorer");
  const rvSrc = await mountFilm(page, "card-film-review");
  expect(rvSrc).toContain("review-film");
  expect(rvSrc).not.toContain("trail-scout");

  await expect.poll(() => mp4s.some(isLeColdtrail), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => mp4s.some(isStdReview), { timeout: 10_000 }).toBe(true);
  expect(mp4s.filter(isStdColdtrail), "standard Cold Trail must never be fetched for 5-7").toEqual([]);
  expect(mp4s.filter(isTsReview), "Trail Scout Review must never be fetched for 5-7").toEqual([]);
});

test("8-10 (Trail Scout): Review fetches the TS variant, never the standard; Cold Trail stays standard", async ({
  context,
  page,
}) => {
  await seedBand(context, "8-10");
  const mp4s = watchMp4s(context);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  const ctSrc = await mountFilm(page, "card-film-coldtrail");
  expect(ctSrc).toContain("coldtrail-film");
  expect(ctSrc).not.toContain("little-explorer");
  const rvSrc = await mountFilm(page, "card-film-review");
  expect(rvSrc).toContain("review-film-trail-scout");

  await expect.poll(() => mp4s.some(isTsReview), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => mp4s.some(isStdColdtrail), { timeout: 10_000 }).toBe(true);
  expect(mp4s.filter(isLeColdtrail), "LE Cold Trail must never be fetched for 8-10").toEqual([]);
  expect(mp4s.filter(isStdReview), "standard Review must never be fetched for 8-10").toEqual([]);
});

test("11-13: neither variant is fetched; both standard films load", async ({ context, page }) => {
  await seedBand(context, "11-13");
  const mp4s = watchMp4s(context);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  const ctSrc = await mountFilm(page, "card-film-coldtrail");
  expect(ctSrc).not.toContain("little-explorer");
  const rvSrc = await mountFilm(page, "card-film-review");
  expect(rvSrc).not.toContain("trail-scout");

  await expect.poll(() => mp4s.some(isStdColdtrail), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => mp4s.some(isStdReview), { timeout: 10_000 }).toBe(true);
  expect(mp4s.filter(isLeColdtrail), "LE variant must never be fetched for 11-13").toEqual([]);
  expect(mp4s.filter(isTsReview), "TS variant must never be fetched for 11-13").toEqual([]);
});

test("unset profile (resolves to 11-13): neither variant is fetched; both standard films load", async ({
  context,
  page,
}) => {
  const mp4s = watchMp4s(context);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  const ctSrc = await mountFilm(page, "card-film-coldtrail");
  expect(ctSrc).not.toContain("little-explorer");
  const rvSrc = await mountFilm(page, "card-film-review");
  expect(rvSrc).not.toContain("trail-scout");

  await expect.poll(() => mp4s.some(isStdColdtrail), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => mp4s.some(isStdReview), { timeout: 10_000 }).toBe(true);
  expect(mp4s.filter(isLeColdtrail), "LE variant must never be fetched when unset").toEqual([]);
  expect(mp4s.filter(isTsReview), "TS variant must never be fetched when unset").toEqual([]);
});
