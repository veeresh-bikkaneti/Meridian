import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  closeEntry,
  expectPaused,
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMedia,
  trackJournalRequests,
} from "./journal-player.helpers";

/**
 * Journal player E2E — desktop 1280px (owner's screenshot target).
 *
 * Tap the picture → the entry's movie plays in place (with narration);
 * pause / resume / close return the still. No movie bytes move before
 * the tap. Media bytes are fulfilled locally (see journal-player.helpers
 * — Chromium in this VM cannot reach github.io); the video src stays
 * the real meridian-media URL.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

/** One journal window: 30 minutes (B8 amendment). */
const WINDOW_MS = 1_800_000;

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("no movie bytes before the tap: no video, no media, no manifest request", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const section = page.getByTestId("journal-section");
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid^="journal-play-"]').first()).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
  await expect(page.locator("video")).toHaveCount(0);
});

test("tap the picture plays the movie; pause, resume, close return the still", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPaused(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPlaying(video);
  await closeEntry(page, id);
});

test("one entry plays at a time; a window rotation closes the playing movie", async ({
  page,
}) => {
  // B8: only one entry shows per 30-minute window, so "one movie at a
  // time" is structural now — the case that still needs a test is the
  // rotation: when the window rolls, the playing movie must close and
  // the next entry must show (the player resets on journalIndex change).
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  const first = ids[0]!;
  const firstVideo = await openEntry(page, first);
  await expectPlaying(firstVideo);

  // Focus must not be inside the card or the section, or rotation is
  // (correctly) deferred.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.clock.fastForward(WINDOW_MS);

  await expect(page.getByTestId(`journal-movie-${first}`)).toHaveCount(0);
  await expect(page.getByTestId(`journal-play-${first}`)).toHaveCount(0);
  const nextIds = await shownNoteIds(page);
  expect(nextIds.length).toBe(1);
  expect(nextIds[0]).not.toBe(first);
  const nextVideo = await openEntry(page, nextIds[0]!);
  await expectPlaying(nextVideo);
  await closeEntry(page, nextIds[0]!);
});

test("unreachable movie fails gracefully: message, still stays, close works", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  await page.route(`**/meridian-media/journal/${id}.mp4`, (route) => route.abort());
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`journal-play-${id}`).click();
  await expect(page.getByTestId(`journal-error-${id}`)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`journal-error-${id}`)).toHaveText(/isn.t ready yet/);
  await expect(page.locator(`img[src*="${id}.webp"]`)).toBeVisible();
  await expect(page.getByTestId(`journal-movie-${id}`)).toHaveCount(0);
  await page.getByTestId(`journal-player-close-${id}`).click();
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
});
