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
 * Audible-playback black-box journey (recording-friendly): fresh visit,
 * sound on (the default) → globe run → story reveal → first gesture →
 * the narration REALLY plays: the audio element reports paused===false,
 * its currentTime advances past 3.5 s (outlasting BOTH the 4 s hang
 * watchdog and the 3 s stall check), the text-only fallback NEVER
 * appears, and no play() rejection degrades the line.
 *
 * This is the single continuous session the screen-recording rule wants:
 * runnable with `video: 'on'`, it shows the user-visible side (captions
 * revealing in sync) while the probe asserts the audio state headless
 * Chromium can't make audible. It is also the regression guard for the
 * stall-check anchoring fix — arming the stall check on play()-resolve
 * (instead of the playing event) false-positived healthy clips under
 * load (caught by storyteller.spec.ts » replay replays the line).
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
// 10 s silent clip — comfortable windows for the probe; the narration
// is still in flight when the test ends (no dismiss races).
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3";

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("audible journey: first gesture plays the narration, no watchdog false-positive", async ({
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
  await page.route(MP3_PATTERN, async (route) => {
    await route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" });
  });

  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });

  // First gesture — a real tap on the caption (the 600 ms tap guard keeps
  // the tap that starts audio from instantly dismissing it).
  await page.getByTestId("storyteller-caption-text").click();

  // The audio element is REALLY playing — not just React state.
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);
  // The clock advances past 3.5 s: sustained audible playback, outlasting
  // both the 4 s hang watchdog and the 3 s stall check.
  await expect
    .poll(async () => (await readAudioProbe(page))?.currentTime ?? -1, {
      timeout: 15_000,
    })
    .toBeGreaterThan(3.5);

  // Neither watchdog fired: the text-only fallback never renders on a
  // healthy playback, and no play() rejection degraded the line.
  await expect(page.getByTestId("storyteller-fallback")).toBeHidden({
    timeout: 10_000,
  });

  expectCleanConsole(errors);
});
