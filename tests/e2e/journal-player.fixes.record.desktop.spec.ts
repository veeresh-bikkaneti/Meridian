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
 * Screen-recording walkthrough — all six Impeccable follow-up fixes on
 * desktop 1280px, in one continuous take (video: "on"). The recording
 * is copied to ~/workspace/journal-player-fixes-play/fixes-desktop.webm.
 *
 * Order: nav (GET INVOLVED visible) → skip link (Tab, hold, Enter) →
 * retry (manifest 500 → error → Try again → playing) → mute on/off →
 * tap-to-pause + flash → resume → Escape closes with focus back on
 * play → keyboard reopen → Tab through the controls → Close by Enter.
 * Media bytes are the REAL 10 s Old Faithful clip, fulfilled locally.
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

test("recorded walkthrough: all six fixes on desktop", async ({ page }) => {
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

  // 1. Nav: GET INVOLVED visible in the single row.
  await expect(page.getByRole("button", { name: "GET INVOLVED" })).toBeVisible();
  await page.waitForTimeout(1_500);

  // 2. Skip link: first Tab focuses it (visible pill), Enter jumps to the journal.
  await page.keyboard.press("Tab");
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.className))
    .toContain("hv5-skip-link");
  await page.waitForTimeout(1_200);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("home-journal");
  await page.waitForTimeout(1_200);

  // 3. Retry: open the first entry → error state → Try again → playing.
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  await page.getByTestId(`journal-play-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.getByTestId(`journal-play-${id}`).click();
  await expect(page.getByTestId(`journal-error-${id}`)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  await page.getByTestId(`journal-player-retry-${id}`).click();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  await page.waitForTimeout(2_000);

  // 4. Mute on, hold, off.
  await page.getByTestId(`journal-player-mute-${id}`).click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(true);
  await page.waitForTimeout(1_200);
  await page.getByTestId(`journal-player-mute-${id}`).click();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);

  // 5. Tap-to-pause: click the video → paused + flash, hold, resume.
  await video.click();
  await expectPaused(video);
  await expect(page.getByTestId(`journal-player-pause-flash-${id}`)).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.clock.runFor(700); // let the ~600ms flash hide under the fake clock
  await video.click();
  await expectPlaying(video);
  await page.waitForTimeout(1_000);

  // 6. Escape closes; focus returns to the play button.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await page.waitForTimeout(1_200);

  // 7. Keyboard reopen (Enter on the focused play button) → focus on the video.
  await page.keyboard.press("Enter");
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  await page.waitForTimeout(1_000);

  // 8. Tab through toggle → mute → Close, Enter closes.
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await page.waitForTimeout(1_200);
});
