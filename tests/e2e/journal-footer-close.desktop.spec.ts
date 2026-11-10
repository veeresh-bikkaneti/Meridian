import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact, readPhase } from "./helpers";
import {
  closeEntry,
  expectPlaying,
  fixedInstant,
  loadHome,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

test.setTimeout(300_000);
test.use({ viewport: { width: 1280, height: 800 } });

/**
 * B5 regression (Reality Checker): the take-2 screen recording's video
 * frames showed the journal footer as "ENTRY 88 OF 106" after the
 * player closed, while the movie was playing the giza entry ("ENTRY 89").
 * Root cause, proven in the B5/B6 fix pass: a Playwright
 * screencast-capture artifact — the DOM never renders 88 (a
 * MutationObserver over the whole journey logged only "Entry 89",
 * and a page.screenshot at the same instant reads 89). The DOM is the
 * oracle here, not video frames. This spec asserts the DOM footer
 * number is identical before open and after close on the same entry.
 */

async function footerText(page: Page): Promise<string> {
  const text = await page.getByTestId("journal-footer").textContent();
  return text ?? "<no footer>";
}

test("footer number identical before open and after close", async ({ page }) => {
  await serveBuiltArtifact(page.context());
  await stubJournalMediaRealClip(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
  const first = ids[0]!;
  const before = await footerText(page);

  await page.clock.resume();
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await page.waitForTimeout(3_000);

  await page.getByTestId("end-game-button").click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  expect(await shownNoteIds(page)).toEqual(ids);
  expect(await footerText(page)).toBe(before);

  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  const video = page.getByTestId(`journal-movie-${first}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  expect(await footerText(page)).toBe(before);
  await page.waitForTimeout(2_000);
  await closeEntry(page, first);
  const after = await footerText(page);
  expect(after).toBe(before);
  await page.waitForTimeout(2_000);
  expect(await footerText(page)).toBe(before);
  console.log(`footer-stable: entry=${first} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
});
