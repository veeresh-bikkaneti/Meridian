import { test, expect, type Page } from "playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact, readPhase } from "./helpers";
import {
  closeEntry,
  expectPlaying,
  fixedInstant,
  loadHome,
  shownNoteIds,
  stubJournalMediaRealClip,
  trackJournalRequests,
} from "./journal-player.helpers";

test.setTimeout(300_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

/**
 * Screen-recording walkthrough — journal prefetch, desktop 1280x800, in
 * one continuous take (video: "on"). The recording is copied to
 * ~/workspace/journal-prefetch-record/prefetch-desktop-raw.webm, then
 * the clip's own audio is muxed onto it (see
 * ~/workspace/journal-prefetch-record/mux.sh) and the OUTPUT is
 * audio-probed before delivery — Playwright video has no audio track.
 *
 * Journey: home journal (no movie bytes) → globe round starts →
 * prefetch warms the first entries in the background → a few seconds
 * of gameplay on the map → End game → Done → home → tap the first
 * (prefetched) entry → the real Old Faithful movie plays instantly →
 * close. Media bytes are the REAL 10 s Old Faithful clip, fulfilled
 * locally (stubJournalMediaRealClip); the video src stays the REAL
 * meridian-media URL. A timestamped request timeline is written to
 * ~/workspace/journal-prefetch-record/timeline.json — the network-trace
 * proof that prefetch requests happened during gameplay, before the tap.
 */
const OUT_DIR = path.resolve(
  process.env.HOME ?? "",
  "workspace/journal-prefetch-record",
);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
});

test("recorded walkthrough: gameplay prefetches, tap plays instantly", async ({
  page,
}) => {
  const recStartWall = Date.now();
  const timeline: Array<{ t: number; kind: string; url: string }> = [];
  const stamp = (kind: string, url: string) =>
    timeline.push({ t: Date.now() - recStartWall, kind, url });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("meridian-media/journal/")) stamp("media", url);
    if (url.includes("videos/journal-manifest.json")) stamp("manifest", url);
  });

  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  stamp("note", `set=${ids.join(",")}`);

  // Start the round: the clock resumes (gameplay timers need real time)
  // from the fixed instant, so the 2 h journal window cannot cross.
  await page.clock.resume();
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  stamp("note", "round started (phase aim)");
  // Wait for the prefetch warms to land, then hold on the map so the
  // recording shows real gameplay while the warm happens.
  await expect
    .poll(() => timeline.filter((e) => e.kind === "media").length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(3_000);

  // End the round and return home.
  await page.getByTestId("end-game-button").click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  stamp("note", "back home");
  expect(await shownNoteIds(page)).toEqual(ids);

  // Tap the first (prefetched) entry: the movie should play at once.
  const first = ids[0]!;
  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  const tapWall = Date.now();
  await playButton.click();
  stamp("note", "tapped first entry");
  const video = page.getByTestId(`journal-movie-${first}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  // Playback-start estimate for the audio mux: the video's own clock
  // (currentTime) against the real wall clock. (NOT performance.now():
  // the mocked clock makes performance.timeOrigin a mocked epoch, so
  // mixing it with real Date.now() collapses the delay to 0 — observed
  // on the first take.) The evaluate reads currentTime just before
  // evalWall, so playback started ~currentTime earlier.
  const evalWall = Date.now();
  const playStart = await page.evaluate(() => {
    const v = document.querySelector("video");
    if (!v) return null;
    return { currentTime: v.currentTime };
  });
  expect(playStart).not.toBeNull();
  const audioDelayMs = Math.max(
    0,
    Math.round(evalWall - playStart!.currentTime * 1000 - recStartWall),
  );
  console.log(
    `record: tap->playing wall=${Date.now() - tapWall}ms audioDelayMs=${audioDelayMs} currentTime=${playStart!.currentTime.toFixed(2)}`,
  );
  stamp("note", `movie playing audioDelayMs=${audioDelayMs}`);
  // Let most of the 10 s movie play on camera, then close.
  await page.waitForTimeout(8_000);
  await closeEntry(page, first);
  stamp("note", "closed player");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, "timeline.json"),
    JSON.stringify(
      { recStartWall, audioDelayMs, ids, timeline },
      null,
      2,
    ),
  );
  console.log(`record: timeline written (${timeline.length} events)`);
});
