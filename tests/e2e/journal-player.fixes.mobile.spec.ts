import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  closeEntry,
  expectPaused,
  expectPlaying,
  fixedInstant,
  loadHome,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — Impeccable follow-up fixes, phone 390px, touch.
 *
 * GET INVOLVED inside the 390px viewport with no nav strip scroll, and
 * the mute / tap-to-pause fixes by tap. Media bytes are the REAL 10 s
 * Old Faithful clip, fulfilled locally (see stubJournalMediaRealClip).
 */
test.setTimeout(180_000);
test.use({ video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("GET INVOLVED sits inside the 390px viewport with no nav strip scroll", async ({
  page,
}) => {
  const nav = page.locator(".hv5-nav nav");
  const items = page.locator(".hv5-nav nav button, .hv5-nav nav a");
  await expect(items).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    const box = await items.nth(i).boundingBox();
    expect(box!.left).toBeGreaterThanOrEqual(0);
    expect(box!.right).toBeLessThanOrEqual(390);
  }
  const button = page.getByRole("button", { name: "GET INVOLVED" });
  await expect(button).toBeVisible();
  const btnBox = await button.boundingBox();
  expect(btnBox!.right).toBeLessThanOrEqual(390);
  // No horizontal scrolling in the strip: everything is laid out, not clipped.
  const overflow = await nav.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
});

test("tap the video pauses with a flash; mute toggle works by tap", async ({ page }) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const id = ids[0]!;
  const playButton = page.getByTestId(`journal-play-${id}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.tap();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  const flash = page.getByTestId(`journal-player-pause-flash-${id}`);
  await expect(flash).toHaveCount(0);
  await video.tap();
  await expectPaused(video);
  await expect(flash).toBeVisible();
  await page.clock.runFor(700);
  await expect(flash).toHaveCount(0);
  await video.tap();
  await expectPlaying(video);
  const mute = page.getByTestId(`journal-player-mute-${id}`);
  await mute.tap();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(true);
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await mute.tap();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);
  await closeEntry(page, id);
});
