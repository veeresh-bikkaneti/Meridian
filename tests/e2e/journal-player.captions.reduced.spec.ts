import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPaused,
  expectPlaying,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — reduced motion + captions, 1440px.
 *
 * The tap is explicit consent, so the movie still plays on tap — but
 * it plays ONCE instead of looping, and the toggle offers "Play again"
 * at the end — while captions stay available (CC button present, track
 * flips to showing). Media bytes are the REAL 10 s Old Faithful clip,
 * fulfilled locally; the video src stays the real meridian-media URL.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  const time = new Date(Date.UTC(2026, 9, 17, 16, 0, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("reduced motion: plays once with no loop, captions available, replay offered", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful", "rushmore", "gateway-arch"]);
  const id = "old-faithful";
  const video = await openEntry(page, id);
  await expect(video).not.toHaveAttribute("loop", "");
  await expectPlaying(video);

  // Captions are available under reduced motion too.
  const cc = page.getByTestId(`journal-player-cc-${id}`);
  await expect(cc).toBeVisible();
  await cc.click();
  await expect
    .poll(() => video.evaluate((v) => v.textTracks[0]?.mode ?? null), { timeout: 10_000 })
    .toBe("showing");
  await expect
    .poll(() => video.evaluate((v) => v.textTracks[0]?.activeCues?.length ?? 0), {
      timeout: 20_000,
      intervals: [100, 250],
    })
    .toBeGreaterThan(0);

  // The 10 s clip ends (no loop): the toggle offers a replay.
  await expect(page.getByTestId(`journal-player-toggle-${id}`)).toHaveText("▶ Play again", {
    timeout: 20_000,
  });
  await expectPaused(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPlaying(video);
});
