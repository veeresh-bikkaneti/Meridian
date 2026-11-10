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
} from "./journal-player.helpers";

/**
 * Journal player E2E — reduced motion.
 * The tap is explicit consent, so the movie still plays on tap — but
 * it plays ONCE instead of looping, and the toggle offers "Play again"
 * at the end.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("reduced motion: movie plays once on tap, no loop, replay offered", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expect(video).not.toHaveAttribute("loop", "");
  await expectPlaying(video);
  // The 2 s stub clip ends (no loop): the toggle offers a replay.
  await expect(page.getByTestId(`journal-player-toggle-${id}`)).toHaveText("▶ Play again", {
    timeout: 15_000,
  });
  await expectPaused(video);
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPlaying(video);
  await closeEntry(page, id);
});
