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
 * Screen-recording walkthrough — captions build on desktop 1280x800,
 * in one continuous take (video: "on"). The recording is copied to
 * ~/workspace/journal-player-captions-play/captions-desktop.webm.
 *
 * Order: two-column entry (art left, text rail right) → open Old
 * Faithful → captions on with a cue active → Story-text panel opens
 * with the spoken line highlighted → tap a later line (seek) → the
 * full-width progress row advances → close.
 * Media bytes are the REAL 10 s Old Faithful clip, fulfilled locally.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  const time = new Date(Date.UTC(2026, 9, 17, 16, 0, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("recorded walkthrough: two-column, captions, transcript highlight + tap-to-seek on desktop", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful", "rushmore", "gateway-arch"]);
  const id = "old-faithful";

  // 1. Two-column entry in view: hold so the layout reads on camera.
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);

  // 2. Open Old Faithful; the movie plays.
  const video = await openEntry(page, id);
  await expectPlaying(video);
  await page.waitForTimeout(1_000);

  // 3. Captions on: wait until a cue is actually active.
  await page.getByTestId(`journal-player-cc-${id}`).click();
  await expect
    .poll(() => video.evaluate((v) => v.textTracks[0]?.activeCues?.length ?? 0), {
      timeout: 20_000,
      intervals: [100, 250],
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1_500);

  // 4. Story-text panel: the spoken line highlights as playback goes on.
  await page.getByTestId(`journal-player-transcript-${id}`).click();
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
  await page.getByTestId(`journal-player-transcript-line-${id}-2`).click();
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 5_000, intervals: [100] })
    .toBeGreaterThanOrEqual(6.5);
  await page.waitForTimeout(2_000);

  // 6. Close returns the still.
  await page.getByTestId(`journal-player-close-${id}`).click();
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await page.waitForTimeout(1_000);
});
