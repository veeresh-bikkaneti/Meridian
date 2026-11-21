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
  const inlineNav = page.locator(
    "header.site-header nav.site-header-nav:not(.site-header-panel)",
  );
  const menuButton = page.locator("header.site-header .site-header-menu-button");
  const panel = page.locator("header.site-header nav.site-header-panel");
  // Below the 1024px breakpoint the inline nav is hidden: a phone user
  // opens the Menu and sees the same 7 items in the panel.
  await expect(inlineNav).toBeHidden();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(panel).toBeVisible();
  // The panel also carries the exit control; the nav items are the
  // .site-header-nav-link elements, 7 of them, same as the inline nav.
  const items = panel.locator(".site-header-nav-link");
  await expect(items).toHaveCount(7);
  // getBoundingClientRect via evaluate: locator.boundingBox() flaked to
  // null on the nav buttons once (transient, during the header's
  // entrance state — the probe re-measured the same elements fine).
  for (let i = 0; i < 7; i++) {
    const item = items.nth(i);
    await expect(item).toBeVisible();
    const r = await item.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right };
    });
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
  }
  const button = panel.getByRole("button", { name: "GET INVOLVED" });
  await expect(button).toBeVisible();
  const btnRect = await button.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { right: b.right };
  });
  expect(btnRect.right).toBeLessThanOrEqual(390);
  // No horizontal scrolling in the panel: everything is laid out, not clipped.
  const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
  // Leave the header resting closed for the tests after this one.
  await menuButton.click();
  await expect(panel).toHaveCount(0);
});

test("tap the video pauses with a flash; mute toggle works by tap", async ({ page }) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(1);
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
