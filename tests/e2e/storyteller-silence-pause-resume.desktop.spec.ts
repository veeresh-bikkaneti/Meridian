import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  installAudioProbe,
  readAudioProbe,
} from "./helpers";

/**
 * TEST cell — fix PR "narration silent in production" (branch
 * fix/narration-silent-prod).
 *
 * Fix C — black-box journey on desktop: the narration clip hangs
 * mid-buffer (its play() promise never settles) → the user pauses
 * mid-buffer → the card must land in a recoverable "paused" state
 * (the element really paused, the text-only fallback does NOT render,
 * the replay control is visible) instead of stranding "playing" on the
 * dead element. Resume via the replay button → a fresh attempt plays
 * for real (paused===false, the media clock advances).
 *
 * The card figure is banner-only (owner ruling 2026-10-09), so the pause
 * itself is driven through the probed audio element — the AbortError it
 * produces walks the app's real catch path (isPlayAbort →
 * resolvePlayAbort → "paused"). Everything the user sees and taps after
 * that (fallback absence, replay button, resumed playback) is asserted
 * through the UI.
 *
 * FAIL-pre: without the fix, pausing mid-buffer treats the AbortError as
 * a failure — the text-only fallback renders and no resume path exists.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
// 10 s silent clip — the resumed narration is still in flight when the
// test ends (no dismiss races).
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3";

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("pause mid-buffer recovers to paused; replay resumes playback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  // installAudioProbe also disables the service worker (its cache-first
  // precache would hide the mp3 request from the route below).
  await installAudioProbe(page.context());
  // The first narration attempt hangs mid-buffer (play() never settles);
  // the replay's fresh attempt gets the real clip.
  let mp3Requests = 0;
  await page.route(MP3_PATTERN, (route) => {
    mp3Requests += 1;
    if (mp3Requests === 1) return new Promise<never>(() => {});
    return route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" });
  });

  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });

  // Start the narration with a real tap (the 600 ms tap guard keeps the
  // tap that starts audio from instantly dismissing it). The clip hangs:
  // play() stays pending, well short of the 4 s hang watchdog.
  await page.getByTestId("storyteller-caption-text").click();
  await page.waitForTimeout(1000);

  // Pause mid-buffer through the audio element itself (the card figure is
  // banner-only, so no figure-tap pause exists on cards). Aborting the
  // pending play() is the pause working — not an audio failure.
  await page.evaluate(() => {
    const w = window as unknown as { __audioProbe?: HTMLAudioElement[] };
    w.__audioProbe?.at(-1)?.pause();
  });

  // Recoverable "paused": the element really is paused…
  expect((await readAudioProbe(page))?.paused, "element paused").toBe(true);
  // …the text-only fallback does NOT render (nothing failed)…
  await expect(page.getByTestId("storyteller-fallback")).toBeHidden({
    timeout: 10_000,
  });
  // …and the replay control — the resume path — is visible.
  await expect(page.getByTestId("storyteller-replay")).toBeVisible({
    timeout: 10_000,
  });

  // Resume via the replay button: a fresh attempt plays for real.
  await page.getByTestId("storyteller-replay").click();
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);
  await expect
    .poll(async () => (await readAudioProbe(page))?.currentTime ?? -1, {
      timeout: 15_000,
    })
    .toBeGreaterThan(1);

  expectCleanConsole(errors);
});
