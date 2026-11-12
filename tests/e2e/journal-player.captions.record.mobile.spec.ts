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
 * Screen-recording walkthrough — captions build on mobile 390px, in
 * one continuous take (video: "on"). The recording is copied to
 * ~/workspace/journal-player-captions-play/captions-mobile.webm.
 *
 * Order: stacked entry → tap Old Faithful → movie plays with the
 * full-width progress row → captions on → Story-text panel with the
 * spoken line highlighted → tap a later line (seek) → close.
 * Media bytes are the REAL 10 s Old Faithful clip, fulfilled locally.
 */
test.setTimeout(180_000);
test.use({ video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  // First instant showing old-faithful alone (B8: one entry per 30-min window).
  const time = new Date(Date.UTC(2026, 9, 16, 0, 30, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("recorded walkthrough: full-width progress, captions, transcript tap-to-seek on mobile", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful"]);
  const id = "old-faithful";

  // 1. Stacked entry in view: hold so the layout reads on camera.
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);

  // 2. Tap the picture; the movie plays with the full-width progress row.
  await page.getByTestId(`journal-play-${id}`).tap();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  const progressBox = await page.locator(".hv5-journal-progress").boundingBox();
  expect(progressBox!.width).toBeGreaterThanOrEqual(200);
  await page.waitForTimeout(1_500);

  // 3. Captions on: wait until a cue is actually active.
  await page.getByTestId(`journal-player-cc-${id}`).tap();
  await expect
    .poll(() => video.evaluate((v) => v.textTracks[0]?.activeCues?.length ?? 0), {
      timeout: 20_000,
      intervals: [100, 250],
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1_500);

  // 4. Story-text panel: the spoken line highlights as playback goes on.
  await page.getByTestId(`journal-player-transcript-${id}`).tap();
  await expect(page.getByTestId(`journal-player-transcript-panel-${id}`)).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelectorAll(".hv5-journal-transcript-line-active").length,
        ),
      { timeout: 20_000, intervals: [100, 250] },
    )
    .toBe(1);
  await page.waitForTimeout(1_200);

  // 5. Tap-to-seek: tap the "Whoosh!" line (cue 2, starts 6.60).
  await page.getByTestId(`journal-player-transcript-line-${id}-2`).tap();
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 5_000, intervals: [100] })
    .toBeGreaterThanOrEqual(6.5);
  await page.waitForTimeout(2_000);

  // 6. Close returns the still.
  await page.getByTestId(`journal-player-close-${id}`).tap();
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await page.waitForTimeout(1_000);
});
