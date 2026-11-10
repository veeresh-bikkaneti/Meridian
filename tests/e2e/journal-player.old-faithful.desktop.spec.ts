import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  closeEntry,
  expectPaused,
  expectPlaying,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMedia,
} from "./journal-player.helpers";

/**
 * Journal player E2E — Old Faithful (the pilot entry), desktop 1280px.
 *
 * The main player specs run on a fixed triple set (index 6); this spec
 * pins the pilot entry itself on its own set (index 20: Old Faithful,
 * Rushmore, Gateway Arch) so the recording shows the entry the mockup
 * was built around. Same journey: tap → play → pause → resume → close.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  // First instant showing old-faithful alone (B8: one entry per 30-min window).
  const time = new Date(Date.UTC(2026, 9, 16, 0, 30, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("Old Faithful plays: tap the picture, pause, resume, close return the still", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful"]);
  const video = await openEntry(page, "old-faithful");
  await expectPlaying(video);
  await page.getByTestId("journal-player-toggle-old-faithful").click();
  await expectPaused(video);
  await page.getByTestId("journal-player-toggle-old-faithful").click();
  await expectPlaying(video);
  await closeEntry(page, "old-faithful");
});
