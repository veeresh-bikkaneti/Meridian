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
 * Fix A — black-box journey on desktop: sound on at mount (the one-shot
 * is armed) → the user mutes via the real in-game toggle → a gesture
 * lands while muted → the narration must NOT start AND the one-shot must
 * NOT be consumed (the pre-fix code burned the only attempt here —
 * captions advancing forever with audioState stuck "idle" and no path
 * back). Then unmute via the real toggle → a real tap → the narration
 * REALLY starts (the audio element reports paused===false).
 *
 * The mute/unmute go through the real SoundToggle (localStorage +
 * meridian:sound-change), fired with dispatchEvent("click") so the
 * toggling action itself — a real click's pointerdown would legitimately
 * consume the one-shot — doesn't pollute the gesture under test. The
 * muted gesture is a synthetic window pointerdown (the exact event the
 * one-shot consumes; no click, so the caption's tap-to-dismiss can't
 * fire); the post-unmute gesture is a real trusted tap on the caption —
 * the one-shot consumes it on the way down and the 600 ms tap guard keeps
 * it from instantly dismissing.
 *
 * FAIL-pre: without the fix, the muted gesture consumes the one-shot, so
 * the post-unmute tap starts nothing and the probe stays null.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
// 10 s silent clip — the narration is still in flight when the test ends
// (no dismiss races).
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3";

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("muted gesture neither starts narration nor burns the one-shot", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  // installAudioProbe also disables the service worker (its cache-first
  // precache would hide the mp3 request from the route below).
  await installAudioProbe(context);
  await page.route(MP3_PATTERN, (route) =>
    route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" }),
  );

  // Sound on (the default): the one-shot arms at mount.
  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });

  // Mute via the real toggle (click event only — a real click's
  // pointerdown would itself be the "first gesture", which is correct
  // app behavior but not the gesture under test).
  await page.getByTestId("sound-toggle-game").dispatchEvent("click");

  // A gesture lands while muted: the narration must NOT start…
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  await page.waitForTimeout(1200);
  expect(await readAudioProbe(page), "no audio element while muted").toBeNull();

  // …and the one-shot must NOT be consumed: unmute via the real toggle,
  // then a real tap starts the narration.
  await page.getByTestId("sound-toggle-game").dispatchEvent("click");
  await page.getByTestId("storyteller-caption-text").click();

  // The audio element is REALLY playing — not just React state.
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);

  expectCleanConsole(errors);
});
