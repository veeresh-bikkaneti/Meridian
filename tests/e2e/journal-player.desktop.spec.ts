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
  expect(ids.length).toBe(3);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPaused(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPlaying(video);
  await closeEntry(page, id);
});

test("three entries play in turn; opening one closes the other", async ({ page }) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const [first, second, third] = ids as [string, string, string];
  const firstVideo = await openEntry(page, first);
  await expectPlaying(firstVideo);
  await openEntry(page, second);
  await expect(page.getByTestId(`journal-movie-${first}`)).toHaveCount(0);
  await expect(page.getByTestId(`journal-play-${first}`)).toBeVisible();
  const secondVideo = page.getByTestId(`journal-movie-${second}`);
  await expectPlaying(secondVideo);
  await openEntry(page, third);
  await expect(page.getByTestId(`journal-movie-${second}`)).toHaveCount(0);
  await expectPlaying(page.getByTestId(`journal-movie-${third}`));
  await closeEntry(page, third);
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
