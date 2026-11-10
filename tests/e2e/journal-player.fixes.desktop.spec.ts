import { test, expect, type Page, type Locator } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";
import {
  closeEntry,
  expectPaused,
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — Impeccable follow-up fixes, desktop 1280px.
 *
 * Mute toggle, tap-to-pause + flash, focus in/out (Close and Escape),
 * manifest-error retry, skip link, and the 1280px nav. Media bytes are
 * the REAL 10 s Old Faithful clip, fulfilled locally (see
 * stubJournalMediaRealClip — Chromium in this VM cannot reach
 * github.io); the video src stays the real meridian-media URL.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

/** data-testid of the currently focused element, or null. */
async function activeTestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid"),
  );
}

/**
 * Viewport-relative box via getBoundingClientRect. locator.boundingBox()
 * flaked to null on the nav buttons once (transient, during the header's
 * entrance state — the probe re-measured the same elements fine), so
 * geometry assertions read the rect directly instead.
 */
async function rectOf(locator: Locator): Promise<{ left: number; right: number; height: number }> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, height: r.height };
  });
}

test("play badge names the length and warns of sound", async ({ page }) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const playButton = page.getByTestId(`journal-play-${ids[0]!}`);
  await expect(playButton).toContainText("Watch the movie · 10 sec");
  await expect(playButton).toHaveAttribute(
    "aria-label",
    /Watch the .* movie, 10 seconds with sound/,
  );
});

test("mute toggle: on mutes the video, off unmutes it, playback unaffected", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);
  const mute = page.getByTestId(`journal-player-mute-${id}`);
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await expect(mute).toHaveAttribute("aria-label", "Mute movie");
  // 44px tap-target floor.
  const box = await mute.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await mute.click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(true);
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveAttribute("aria-label", "Unmute movie");
  await mute.click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await expectPlaying(video);
  await closeEntry(page, id);
});

test("tapping the video pauses with a flash, tapping again resumes", async ({ page }) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);
  const flash = page.getByTestId(`journal-player-pause-flash-${id}`);
  await expect(flash).toHaveCount(0);
  await video.click();
  await expectPaused(video);
  await expect(flash).toBeVisible();
  // The flash hides ~600ms after the tap (fake clock: advance it).
  await page.clock.runFor(700);
  await expect(flash).toHaveCount(0);
  await video.click();
  await expectPlaying(video);
  // The control-row toggle still works after video taps.
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expectPaused(video);
  await closeEntry(page, id);
});

test("keyboard: Tab/Enter opens with focus in the player; Close returns focus to play", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  const playButton = page.getByTestId(`journal-play-${id}`);
  await playButton.scrollIntoViewIfNeeded();
  // Tab from the top of the page until the play button is focused.
  for (let i = 0; i < 120; i++) {
    if ((await activeTestId(page)) === `journal-play-${id}`) break;
    await page.keyboard.press("Tab");
  }
  await expect.poll(() => activeTestId(page)).toBe(`journal-play-${id}`);
  await page.keyboard.press("Enter");
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  // Focus moved INTO the player: on the video itself.
  await expect.poll(() => activeTestId(page)).toBe(`journal-movie-${id}`);
  // Tab through the controls in DOM order — toggle, CC, Story text,
  // mute, Close (the captions build added the CC and Story text
  // buttons between toggle and mute) — then Enter closes.
  await page.keyboard.press("Tab");
  await expect.poll(() => activeTestId(page)).toBe(`journal-player-toggle-${id}`);
  await page.keyboard.press("Tab");
  await expect.poll(() => activeTestId(page)).toBe(`journal-player-cc-${id}`);
  await page.keyboard.press("Tab");
  await expect.poll(() => activeTestId(page)).toBe(`journal-player-transcript-${id}`);
  await page.keyboard.press("Tab");
  await expect.poll(() => activeTestId(page)).toBe(`journal-player-mute-${id}`);
  await page.keyboard.press("Tab");
  await expect.poll(() => activeTestId(page)).toBe(`journal-player-close-${id}`);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe(`journal-play-${id}`);
});

test("keyboard: Escape closes and returns focus to the play button", async ({ page }) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);
  await expect.poll(() => activeTestId(page)).toBe(`journal-movie-${id}`);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-movie-${id}`)).toHaveCount(0);
  await expect.poll(() => activeTestId(page)).toBe(`journal-play-${id}`);
});

test("manifest 500 shows Try again; retry with the manifest back reaches playing", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  // The retry's second fetch must be answered here, not via
  // route.continue(): continue() sends the request to the real network
  // (nothing listens on 4123 — the artifact is served from disk), so
  // the fetch fails and the error state persists. Fulfilling with the
  // real manifest bytes proves the retry path itself.
  const realManifest = readFileSync("public/videos/journal-manifest.json", "utf8");
  let manifestCalls = 0;
  await page.route("**/videos/journal-manifest.json", async (route) => {
    manifestCalls += 1;
    if (manifestCalls === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: realManifest });
    }
  });
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`journal-play-${id}`).click();
  await expect(page.getByTestId(`journal-error-${id}`)).toBeVisible({ timeout: 10_000 });
  expect(manifestCalls).toBe(1);
  const retry = page.getByTestId(`journal-player-retry-${id}`);
  await expect(retry).toBeVisible();
  await retry.click();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  expect(manifestCalls).toBe(2);
  await page.unroute("**/videos/journal-manifest.json");
  await closeEntry(page, id);
});

test("skip link: first Tab focuses it and shows it; Enter jumps focus to the journal", async ({
  page,
}) => {
  const skipLink = page.locator(".hv5-skip-link");
  await expect(skipLink).toHaveCount(1);
  await expect(skipLink).toHaveText("Skip to journal");
  // Hidden until focused: off the top of the page.
  const before = await skipLink.boundingBox();
  expect(before!.y).toBeLessThan(0);
  await page.keyboard.press("Tab");
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.className))
    .toContain("hv5-skip-link");
  // Focused: visible at the top of the page.
  const focused = await skipLink.boundingBox();
  expect(focused!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe("home-journal");
});

test("nav at 1280px: single row, GET INVOLVED inside the viewport, no strip scroll", async ({
  page,
}) => {
  const nav = page.locator(".hv5-nav nav");
  const button = page.getByRole("button", { name: "GET INVOLVED" });
  await expect(button).toBeVisible();
  const navRect = await rectOf(nav);
  expect(navRect.height).toBeLessThan(70);
  const btnRect = await rectOf(button);
  expect(btnRect.right).toBeLessThanOrEqual(1280);
  expect(btnRect.left).toBeGreaterThanOrEqual(0);
  const overflow = await nav.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
});
