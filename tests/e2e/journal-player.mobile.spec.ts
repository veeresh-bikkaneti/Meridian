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
 * Journal player E2E — phone 390px, touch.
 * Same journey as desktop: tap the picture → movie plays; pause /
 * resume / close return the still. No movie bytes before the tap.
 */
test.setTimeout(180_000);
test.use({ video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("tap the picture plays the movie; pause, resume, close return the still", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const section = page.getByTestId("journal-section");
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  const id = ids[0]!;
  const playButton = page.getByTestId(`journal-play-${id}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.tap();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveAttribute("src", new RegExp(`meridian-media/journal/${id}\\.mp4$`));
  await expectPlaying(video);
  await page.getByTestId(`journal-player-toggle-${id}`).tap();
  await expectPaused(video);
  await page.getByTestId(`journal-player-toggle-${id}`).tap();
  await expectPlaying(video);
  await closeEntry(page, id);
});
