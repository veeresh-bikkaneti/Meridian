import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPlaying,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — coverage honesty.
 *
 * With the transcripts file answering `{}` (no entry has a transcript),
 * the movie still plays but NO CC button and NO Story-text button
 * appear, and no <track> is rendered. The intercept is registered
 * after serveBuiltArtifact, so it wins dispatch for the transcripts
 * URL only; the manifest and the movie are served normally.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  await page.route("**/videos/journal-transcripts.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  // First instant showing old-faithful alone (B8: one entry per 30-min window).
  const time = new Date(Date.UTC(2026, 9, 16, 0, 30, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("no transcript in the file: movie plays, but no CC and no Story-text button", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful"]);
  const id = "old-faithful";
  const video = await openEntry(page, id);
  await expectPlaying(video);

  await expect(page.getByTestId(`journal-player-cc-${id}`)).toHaveCount(0);
  await expect(page.getByTestId(`journal-player-transcript-${id}`)).toHaveCount(0);
  await expect(video.locator("track")).toHaveCount(0);

  // The movie itself is unaffected: the ordinary controls are all there.
  await expect(page.getByTestId(`journal-player-toggle-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-player-mute-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-player-close-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-player-time-${id}`)).toBeVisible();
});
