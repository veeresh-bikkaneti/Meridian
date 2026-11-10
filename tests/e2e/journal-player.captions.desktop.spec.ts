import { test, expect, type Page, type Locator } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — captions + transcript + desktop fold, 1280x800.
 *
 * The captions/layout build: desktop two-column journal entries
 * (>=681px), captions via <track kind="captions"> + CC toggle, a
 * tappable transcript panel with live highlight + tap-to-seek, and a
 * full-width progress row. Media bytes are the REAL 10 s Old Faithful
 * clip, fulfilled locally (see stubJournalMediaRealClip — Chromium in
 * this VM cannot reach github.io); the video src stays the real
 * meridian-media URL. Old Faithful's cues (from
 * public/videos/journal-transcripts.json, identical in its .vtt):
 * 0.10–2.35 "Hey kids…", 2.60–4.50 "Crowds wait…", voice-free gap
 * 4.50–6.60, 6.60–8.19 "Whoosh!…", 8.44–9.85 "And quiet again."
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 }, video: "on" });

const OLD_FAITHFUL_TIME = new Date(Date.UTC(2026, 9, 17, 16, 0, 0));
const CUE_TEXTS = [
  "Hey kids, have you heard about this place?",
  "Crowds wait for Old Faithful.",
  "Whoosh! That's how it goes up!",
  "And quiet again.",
];

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
});

async function loadOldFaithfulSet(page: Page): Promise<void> {
  await page.clock.install({ time: OLD_FAITHFUL_TIME });
  await loadHome(page, OLD_FAITHFUL_TIME);
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful", "rushmore", "gateway-arch"]);
}

/** Bounding box via getBoundingClientRect (never null when visible). */
async function rectOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number; bottom: number; right: number }> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  });
}

/** The video's text-track mode, or null when there is no track. */
async function trackMode(video: Locator): Promise<string | null> {
  return video.evaluate((v) => v.textTracks[0]?.mode ?? null);
}

/** Text of the currently active caption cue, or null when none is active. */
async function activeCueText(video: Locator): Promise<string | null> {
  return video.evaluate((v) => {
    const cues = v.textTracks[0]?.activeCues;
    if (!cues || cues.length === 0) return null;
    return (cues[0] as VTTCue).text;
  });
}

/** Index of the highlighted transcript line for Old Faithful, or -1. */
async function activeLineIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const lines = Array.from(
      document.querySelectorAll('[data-testid^="journal-player-transcript-line-old-faithful-"]'),
    );
    return lines.findIndex((el) => el.classList.contains("hv5-journal-transcript-line-active"));
  });
}

test("desktop fold: play badge, loading status, and ready controls all sit above y=800", async ({
  page,
}) => {
  // Delay the manifest so the loading state is observable, then answer
  // with the real bytes (same pattern as the fixes retry spec).
  const realManifest = readFileSync("public/videos/journal-manifest.json", "utf8");
  await page.route("**/videos/journal-manifest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ status: 200, contentType: "application/json", body: realManifest });
  });
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const id = ids[0]!;

  // Play badge: scroll the entry into view as a user would, then measure.
  const playButton = page.getByTestId(`journal-play-${id}`);
  await playButton.scrollIntoViewIfNeeded();
  await expect(playButton).toBeVisible();
  const badgeBox = await rectOf(playButton);
  console.log(`fold: play badge box ${JSON.stringify(badgeBox)}`);
  expect(badgeBox.bottom, "play badge bottom above the 800px fold").toBeLessThanOrEqual(800);

  // Loading status: visible while the delayed manifest is in flight.
  await playButton.click();
  const loading = page.getByTestId(`journal-loading-${id}`);
  await expect(loading).toBeVisible({ timeout: 10_000 });
  const loadingBox = await rectOf(loading);
  console.log(`fold: loading status box ${JSON.stringify(loadingBox)}`);
  expect(loadingBox.bottom, "loading status bottom above the 800px fold").toBeLessThanOrEqual(800);

  // Ready controls: every control + the time readout above the fold.
  const video = page.getByTestId(`journal-movie-${id}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  for (const testId of [
    `journal-player-toggle-${id}`,
    `journal-player-cc-${id}`,
    `journal-player-transcript-${id}`,
    `journal-player-mute-${id}`,
    `journal-player-close-${id}`,
    `journal-player-time-${id}`,
  ]) {
    const box = await rectOf(page.getByTestId(testId));
    console.log(`fold: ${testId} box ${JSON.stringify(box)}`);
    expect(box.bottom, `${testId} bottom above the 800px fold`).toBeLessThanOrEqual(800);
  }
  await page.unroute("**/videos/journal-manifest.json");
});

test("desktop two-column: art left, text rail right; controls sit in the art column", async ({
  page,
}) => {
  await loadOldFaithfulSet(page);
  const id = "old-faithful";
  const video = await openEntry(page, id);
  await expectPlaying(video);

  const entry = page.locator(".hv5-entry", { has: page.getByTestId(`journal-movie-${id}`) });
  const columns = await entry.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns, "entry grid has two columns at 1280px").toBe(2);

  const artBox = await rectOf(page.locator(".hv5-entry-art", { has: page.getByTestId(`journal-movie-${id}`) }));
  const textBox = await rectOf(page.locator(".hv5-entry-text").nth(0));
  // The entry whose art is open is the first note; locate its text rail
  // as the sibling inside the same article.
  const railBox = await entry.locator(".hv5-entry-text").boundingBox();
  console.log(`layout: art ${JSON.stringify(artBox)} text ${JSON.stringify(textBox)} rail ${JSON.stringify(railBox)}`);
  expect(artBox.right, "art column ends before the text rail starts").toBeLessThanOrEqual(railBox!.x);
  expect(artBox.y, "art and text overlap vertically (side by side)").toBeLessThan(railBox!.y + railBox!.height);
  expect(railBox!.y, "text and art overlap vertically (side by side)").toBeLessThan(artBox.y + artBox.height);

  // Controls location: the controls row + every button must lie inside
  // the art figure's box (art column), and the text rail must hold no
  // player controls at all.
  const controlsBox = await rectOf(page.locator(".hv5-journal-controls"));
  const progressBox = await rectOf(page.locator(".hv5-journal-progress-row"));
  console.log(`layout: controls ${JSON.stringify(controlsBox)} progress-row ${JSON.stringify(progressBox)}`);
  expect(controlsBox.x, "controls left edge inside the art column").toBeGreaterThanOrEqual(artBox.x - 1);
  expect(controlsBox.right, "controls right edge inside the art column").toBeLessThanOrEqual(artBox.right + 1);
  expect(progressBox.x, "progress row left edge inside the art column").toBeGreaterThanOrEqual(artBox.x - 1);
  expect(progressBox.right, "progress row right edge inside the art column").toBeLessThanOrEqual(artBox.right + 1);
  const railButtons = await entry.locator(".hv5-entry-text button").count();
  expect(railButtons, "no player controls in the text rail").toBe(0);
  for (const testId of [
    `journal-player-toggle-${id}`,
    `journal-player-cc-${id}`,
    `journal-player-transcript-${id}`,
    `journal-player-mute-${id}`,
    `journal-player-close-${id}`,
  ]) {
    const box = await rectOf(page.getByTestId(testId));
    console.log(`layout: ${testId} box ${JSON.stringify(box)}`);
    expect(box.x, `${testId} inside the art column`).toBeGreaterThanOrEqual(artBox.x - 1);
    expect(box.right, `${testId} inside the art column`).toBeLessThanOrEqual(artBox.right + 1);
  }
});

test("captions: CC on shows the track and a cue; CC off hides it", async ({ page }) => {
  await loadOldFaithfulSet(page);
  const id = "old-faithful";
  const video = await openEntry(page, id);
  await expectPlaying(video);

  // CC + Story text buttons exist: this entry is in the transcripts file.
  await expect(page.getByTestId(`journal-player-cc-${id}`)).toBeVisible();
  await expect(page.getByTestId(`journal-player-transcript-${id}`)).toBeVisible();

  // Track starts hidden (cues available, no on-video captions).
  await expect.poll(() => trackMode(video), { timeout: 10_000 }).toBe("hidden");

  // CC on: mode showing, and a real cue's text becomes active as the
  // 10 s clip plays (it loops, so the poll has repeated chances).
  await page.getByTestId(`journal-player-cc-${id}`).click();
  await expect(page.getByTestId(`journal-player-cc-${id}`)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => trackMode(video), { timeout: 10_000 }).toBe("showing");
  await expect
    .poll(() => activeCueText(video), { timeout: 20_000, intervals: [100, 250] })
    .not.toBeNull();
  const cueText = await activeCueText(video);
  console.log(`captions: active cue text ${JSON.stringify(cueText)}`);
  expect(CUE_TEXTS, "active cue is one of Old Faithful's four lines").toContain(cueText);

  // CC off: mode hidden again.
  await page.getByTestId(`journal-player-cc-${id}`).click();
  await expect(page.getByTestId(`journal-player-cc-${id}`)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => trackMode(video), { timeout: 10_000 }).toBe("hidden");
});

test("transcript panel: live highlight, no highlight in the voice-free gap, tap-to-seek", async ({
  page,
}) => {
  await loadOldFaithfulSet(page);
  const id = "old-faithful";
  const video = await openEntry(page, id);
  await expectPlaying(video);

  await page.getByTestId(`journal-player-transcript-${id}`).click();
  const panel = page.getByTestId(`journal-player-transcript-panel-${id}`);
  await expect(panel).toBeVisible();
  await expect(panel.locator("button")).toHaveCount(4);

  // Line 1 highlights while it is spoken (2.60–4.50).
  await expect.poll(() => activeLineIndex(page), { timeout: 20_000, intervals: [100, 250] }).toBe(1);

  // Voice-free gap (4.50–6.60): no line highlighted. One atomic read
  // of time + highlight state, so the check cannot straddle the gap.
  await expect
    .poll(
      async () => {
        const t = await video.evaluate((v) => v.currentTime);
        const active = await activeLineIndex(page);
        return t >= 4.7 && t <= 6.4 && active === -1 ? "gap-clean" : null;
      },
      { timeout: 20_000, intervals: [100, 250] },
    )
    .toBe("gap-clean");

  // Tap-to-seek, made loop-proof: pause IN the gap, so the video is
  // frozen far from either target. A backward tap (line 0, start 0.10)
  // must jump the time DOWN — natural playback can never do that —
  // and a forward tap (line 3, start 8.44) must jump it UP past 8.4
  // within 3 s, while natural playback from ~0.1 could reach at most
  // ~3 s in that window. Both jumps prove the seek; a stub that
  // cannot seek (seekable [0,0]) fails both, as the probe showed.
  await page.getByTestId(`journal-player-toggle-${id}`).click();
  await expect.poll(() => video.evaluate((v) => v.paused), { timeout: 10_000 }).toBe(true);
  const frozen = await video.evaluate((v) => v.currentTime);
  console.log(`transcript: paused in gap at ${frozen}`);
  expect(frozen, "paused inside the voice-free gap").toBeLessThan(7.0);

  await page.getByTestId(`journal-player-transcript-line-${id}-0`).click();
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 3_000, intervals: [100, 250] })
    .toBeLessThan(1.0);

  await page.getByTestId(`journal-player-transcript-line-${id}-3`).click();
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 3_000, intervals: [100, 250] })
    .toBeGreaterThanOrEqual(8.4);
  const afterSeek = await video.evaluate((v) => ({ t: v.currentTime, paused: v.paused }));
  console.log(`transcript: after tap-to-seek ${JSON.stringify(afterSeek)}`);
  expect(afterSeek.t, "seek landed at the tapped cue's start").toBeLessThan(9.9);
  expect(afterSeek.paused, "video plays after tap-to-seek").toBe(false);
  await expect.poll(() => activeLineIndex(page), { timeout: 15_000, intervals: [100, 250] }).toBe(3);
});
