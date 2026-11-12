import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPaused,
  expectPlaying,
  fixedInstant,
  loadHome,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Screen-recording walkthrough — the fixes on phone 390px, touch, in
 * one continuous take (video: "on"). The recording is copied to
 * ~/workspace/journal-player-fixes-play/fixes-mobile.webm.
 *
 * Order: nav (wrapped row, GET INVOLVED inside the viewport) → retry
 * (manifest 500 → error → Try again → playing) → mute on/off by tap →
 * tap-to-pause + flash → resume → Close by tap. Media bytes are the
 * REAL 10 s Old Faithful clip, fulfilled locally.
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

test("recorded walkthrough: fixes on mobile", async ({ page }) => {
  // Retry path: the first manifest fetch fails, later ones get the real file.
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

  // 1. Nav: wrapped, GET INVOLVED inside the 390px viewport.
  await expect(page.getByRole("button", { name: "GET INVOLVED" })).toBeVisible();
  await page.waitForTimeout(1_500);

  // 2. Retry: tap the first entry → error state → Try again → playing.
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.getByTestId(`journal-play-${id}`).tap();
  await expect(page.getByTestId(`journal-error-${id}`)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  await page.getByTestId(`journal-player-retry-${id}`).tap();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  await page.waitForTimeout(2_000);

  // 3. Mute on, hold, off — by tap.
  await page.getByTestId(`journal-player-mute-${id}`).tap();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(true);
  await page.waitForTimeout(1_200);
  await page.getByTestId(`journal-player-mute-${id}`).tap();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);

  // 4. Tap-to-pause: tap the video → paused + flash, hold, resume.
  await video.tap();
  await expectPaused(video);
  await expect(page.getByTestId(`journal-player-pause-flash-${id}`)).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.clock.runFor(700); // let the ~600ms flash hide under the fake clock
  await video.tap();
  await expectPlaying(video);
  await page.waitForTimeout(1_000);

  // 5. Close by tap.
  await page.getByTestId(`journal-player-close-${id}`).tap();
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await page.waitForTimeout(1_200);
});
