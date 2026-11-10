import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  closeEntry,
  expectPlaying,
  loadHome,
  openEntry,
  stubJournalMediaFixedClips,
} from "./journal-player.helpers";
import { FIXED_ENTRIES, activeCueText } from "./journal-player.facts.data";

/**
 * Screen-recording walkthrough — the 5 corrected journal facts, desktop
 * 1280x800, in one continuous take (video: "on"). The recording is
 * copied to ~/workspace/journal-player-facts-play/facts-desktop.webm.
 * Video-only, no audio (Playwright video has no audio track).
 *
 * Order: alamo → cadillac → joslyn → niagara → homestead. Each entry:
 * load its set, open it, captions on, hold while the corrected cue-2
 * line is the active caption, close. Media bytes are the REBUILT mp4s
 * from meridian-media fix/journal-facts-5 (@ 70b2e95), fulfilled locally
 * (see stubJournalMediaFixedClips); the video src stays the REAL
 * meridian-media URL.
 */
test.setTimeout(300_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaFixedClips(page);
});

test("recorded walkthrough: all 5 corrected entries play their fixed lines", async ({
  page,
}) => {
  for (const [i, entry] of FIXED_ENTRIES.entries()) {
    if (i === 0) {
      await page.clock.install({ time: entry.time });
    } else {
      await page.clock.setFixedTime(entry.time);
    }
    await loadHome(page, entry.time);

    const video = await openEntry(page, entry.id);
    await expectPlaying(video);
    await page.getByTestId(`journal-player-cc-${entry.id}`).click();
    await expect(page.getByTestId(`journal-player-cc-${entry.id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Wait until the corrected line is the active caption, then hold so
    // it reads on camera.
    await expect
      .poll(() => activeCueText(video), { timeout: 25_000, intervals: [100, 250] })
      .toBe(entry.cue.text);
    console.log(`record: ${entry.id} corrected caption on camera ${JSON.stringify(entry.cue.text)}`);
    await page.waitForTimeout(1_800);
    await closeEntry(page, entry.id);
    await page.waitForTimeout(800);
  }
});
