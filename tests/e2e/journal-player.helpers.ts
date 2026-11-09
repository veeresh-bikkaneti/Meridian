import { expect, type Locator, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Shared journey for the Journal player E2E specs.
 *
 * Media stub: Chromium in this VM cannot reach github.io
 * (net::ERR_TUNNEL_CONNECTION_FAILED, probe-verified 2026-11-09) while
 * curl reaches it fine — so the movie requests are fulfilled locally
 * with a 2 s h264+AAC fixture. The video src stays the REAL
 * meridian-media URL; only the bytes are local, so every src /
 * preload / poster assertion still tests the real values. The real
 * URLs are proven separately by the 106-URL HEAD check (106/106
 * resolve, video/mp4).
 */

export const APP = "http://127.0.0.1:4123/Meridian/";
const WINDOW_MS = 7_200_000;
const SET_COUNT = 36;

const FIXTURE_MP4 = readFileSync(path.resolve("tests/e2e/fixtures/journal-player-test.mp4"));

export async function stubJournalMedia(page: Page): Promise<void> {
  await page.route("**/meridian-media/journal/*.mp4", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: FIXTURE_MP4 }),
  );
}

/**
 * Same route as stubJournalMedia, but fulfilled with the REAL 10 s Old
 * Faithful clip (5,664,273 bytes) instead of the 2 s fixture — the
 * fixes specs and the screen recording show the real movie bytes. The
 * video src stays the REAL meridian-media URL; only the bytes are
 * local. Read lazily so specs that never use it never touch the file.
 */
export async function stubJournalMediaRealClip(page: Page): Promise<void> {
  const realClip = readFileSync(
    path.resolve(
      process.env.HOME ?? "",
      "workspace/journal-player-play/real-clip/old-faithful.mp4",
    ),
  );
  await page.route("**/meridian-media/journal/*.mp4", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: realClip }),
  );
}

/** A fixed instant in a pure-triple window (index < 33), with its index. */
export function fixedInstant(): { time: Date; index: number } {
  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  let index = Math.floor(t / WINDOW_MS) % SET_COUNT;
  while (index >= 33) {
    t += WINDOW_MS;
    index = Math.floor(t / WINDOW_MS) % SET_COUNT;
  }
  return { time: new Date(t), index };
}

export async function loadHome(page: Page, time: Date): Promise<void> {
  const today = time.toISOString().slice(0, 10);
  await page.context().addInitScript(
    (seeds: Record<string, string>) => {
      try {
        for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      } catch {
        /* private mode — ignore */
      }
    },
    {
      "meridian.grandpaTour.lastDate": today,
      "meridian.tutorialSeen": "1",
    },
  );
  await page.goto(APP);
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  await page.clock.runFor(1_000);
}

/** Media + manifest requests seen so far (proves load-on-tap). */
export function trackJournalRequests(page: Page): { media: string[]; manifest: string[] } {
  const media: string[] = [];
  const manifest: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("meridian-media/journal/")) media.push(url);
    if (url.includes("videos/journal-manifest.json")) manifest.push(url);
  });
  return { media, manifest };
}

/** Ids of the notes currently showing, in order. */
export async function shownNoteIds(page: Page): Promise<string[]> {
  const buttons = page.locator('[data-testid^="journal-play-"]');
  const count = await buttons.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const testId = await buttons.nth(i).getAttribute("data-testid");
    if (testId) ids.push(testId.replace("journal-play-", ""));
  }
  return ids;
}

/** The video is actually playing: not paused, and currentTime advances. */
export async function expectPlaying(video: Locator): Promise<void> {
  await expect.poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 }).toBe(false);
  const t1 = await video.evaluate((v) => v.currentTime);
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(t1);
}

export async function expectPaused(video: Locator): Promise<void> {
  await expect.poll(() => video.evaluate((v) => v.paused), { timeout: 10_000 }).toBe(true);
}

/** Tap the picture: the video mounts with the real movie URL. */
export async function openEntry(page: Page, id: string): Promise<Locator> {
  const playButton = page.getByTestId(`journal-play-${id}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveAttribute("src", new RegExp(`meridian-media/journal/${id}\\.mp4$`));
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("poster", new RegExp(`${id}\\.webp$`));
  return video;
}

/** Close: the still picture and its play button return, the video is gone. */
export async function closeEntry(page: Page, id: string): Promise<void> {
  await page.getByTestId(`journal-player-close-${id}`).click();
  await expect(page.getByTestId(`journal-play-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-movie-${id}`)).toHaveCount(0);
}
