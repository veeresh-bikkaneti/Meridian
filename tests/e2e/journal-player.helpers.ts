import { expect, type BrowserContext, type Page, type Route } from "playwright/test";
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

/**
 * Range-aware mp4 fulfillment.
 *
 * Production (GitHub Pages / Fastly) answers byte-range requests on
 * the journal clips with 206 Partial Content (verified 2026-11-09
 * with curl: `Range: bytes=0-99` → 206). The clips are NOT faststart
 * — moov sits at the END of the file (old-faithful.mp4: moov at
 * 5656737 of 5664273 bytes) — so Chromium can only build a seek
 * index by fetching the moov tail over ranges. A plain 200 + full
 * body (what the stub used to do) leaves `video.seekable` at [0, 0]
 * and silently ignores every `currentTime = X` assignment, which
 * broke tap-to-seek in the harness while it works in production.
 * This fulfiller restores the production condition: Range requests
 * get a 206 with the sliced bytes, plain requests get a 200 that
 * advertises Accept-Ranges.
 */
async function fulfillMp4(route: Route, bytes: Buffer): Promise<void> {
  const range = route.request().headers()["range"];
  const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (m) {
    const start = parseInt(m[1]!, 10);
    const end = m[2] ? Math.min(parseInt(m[2], 10), bytes.length - 1) : bytes.length - 1;
    if (Number.isFinite(start) && start >= 0 && start <= end) {
      await route.fulfill({
        status: 206,
        contentType: "video/mp4",
        headers: {
          "accept-ranges": "bytes",
          "content-range": `bytes ${start}-${end}/${bytes.length}`,
        },
        body: bytes.subarray(start, end + 1),
      });
      return;
    }
  }
  await route.fulfill({
    status: 200,
    contentType: "video/mp4",
    headers: { "accept-ranges": "bytes" },
    body: bytes,
  });
}

export async function stubJournalMedia(page: Page): Promise<void> {
  await page.route("**/meridian-media/journal/*.mp4", (route) =>
    fulfillMp4(route, FIXTURE_MP4),
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
    fulfillMp4(route, realClip),
  );
}

/**
 * Same route as stubJournalMedia, but each of the 5 Historian-block
 * entries (alamo, cadillac, joslyn, niagara, homestead) is fulfilled
 * with its REBUILT mp4 from meridian-media branch fix/journal-facts-5
 * (@ 70b2e95), extracted WITHOUT switching the media clone's branch
 * (`git show origin/fix/journal-facts-5:journal/<id>.mp4`) into
 * ~/workspace/journal-player-facts-play/real-clips/. Other entries in
 * the same set get the 2 s fixture (never opened). The video src stays
 * the REAL meridian-media URL; only the bytes are local — Chromium in
 * this VM cannot reach github.io, and the live Pages site still serves
 * the OLD clips, so local fulfillment is the only way to test the fix.
 */
export async function stubJournalMediaFixedClips(page: Page): Promise<void> {
  const dir = path.resolve(
    process.env.HOME ?? "",
    "workspace/journal-player-facts-play/real-clips",
  );
  const clips = new Map<string, Buffer>();
  for (const id of ["alamo", "cadillac", "joslyn", "niagara", "homestead"]) {
    clips.set(id, readFileSync(path.join(dir, `${id}.mp4`)));
  }
  await page.route("**/meridian-media/journal/*.mp4", (route) => {
    const m = /\/journal\/([^/]+)\.mp4$/.exec(route.request().url());
    const bytes = (m && clips.get(m[1])) ?? FIXTURE_MP4;
    return fulfillMp4(route, bytes);
  });
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
