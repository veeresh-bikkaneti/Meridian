import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  installAudioProbe,
} from "./helpers";

/**
 * TEST cell — fix PR "narration silent in production" (branch
 * fix/narration-silent-prod).
 *
 * Fix B (stall trip) — black-box journey on desktop: the narration clip's
 * response STARTS (headers + first bytes arrive) then hangs forever — the
 * iOS stall shape. play() never settles, so the 4 s hang watchdog must
 * fail loud: the text-only fallback renders WITH the one-time retry hint.
 * Without the fix, audioState stays "playing" forever — no fallback ever
 * appears and the captions advance in silence (the owner's exact symptom).
 *
 * The stall is staged at the media-source level: Chromium in this VM
 * cannot reach a raw socket server (the egress proxy blackholes
 * loopback), so the Audio override feeds 600 bytes into an MSE
 * SourceBuffer and then never appends more and never calls endOfStream.
 * The response demonstrably started (bytes arrived) and then hung —
 * play() stays pending with only "waiting" events.
 *
 * Asserts what the user experiences — the visible caption with the retry
 * hint — never DOM internals alone.
 *
 * FAIL-pre: without the fix there is no watchdog — the fallback never
 * renders.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3";
const FALLBACK_TEXT = "The words are right here — read along with me.";
// BLOCK 1 (scrum 2026-10-11): the hint names the replay button — the only
// control rendered in the failed state (the speaker button is hidden).
const RETRY_HINT = "Tap the replay button to try again.";

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("a clip that starts then stalls fails loud with the retry hint", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  // installAudioProbe also disables the service worker (its cache-first
  // precache would hide the mp3 request from the route below). The stall
  // rig registers after it, so it wraps the probed Audio constructor and
  // the probe still sees every element.
  await installAudioProbe(context);
  await context.addInitScript(() => {
    const w = window as unknown as {
      Audio: new (src?: string) => HTMLAudioElement;
      __audioProbe: HTMLAudioElement[];
    };
    const ProbedAudio = w.Audio;
    function StallAudio(this: unknown, src?: string): HTMLAudioElement {
      const el = new ProbedAudio(src);
      if (src && src.includes("/audio/storyteller/")) {
        const ms = new MediaSource();
        el.src = URL.createObjectURL(ms);
        ms.addEventListener(
          "sourceopen",
          () => {
            void (async () => {
              try {
                const buf = await (await fetch(src)).arrayBuffer();
                // Headers + first bytes, then the response hangs: never
                // append more, never endOfStream — play() stays pending.
                ms.addSourceBuffer("audio/mpeg").appendBuffer(buf.slice(0, 600));
              } catch {
                // Never break the app under test.
              }
            })();
          },
          { once: true },
        );
      }
      return el;
    }
    StallAudio.prototype = ProbedAudio.prototype;
    w.Audio = StallAudio as unknown as new (src?: string) => HTMLAudioElement;
  });
  // The rig's in-page fetch needs the real clip bytes.
  await page.route(MP3_PATTERN, (route) =>
    route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" }),
  );

  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });

  // First gesture — a real tap on the caption (the tap that starts audio
  // must not instantly dismiss it: the 600 ms tap guard covers that).
  await page.getByTestId("storyteller-caption-text").click();

  // The watchdog fires at 4s: the fallback renders WITH the retry hint
  // (play-side stall, not a network error — retrying may help).
  const fallback = page.getByTestId("storyteller-fallback");
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText(FALLBACK_TEXT);
  await expect(fallback).toContainText(RETRY_HINT);

  expectCleanConsole(errors);
});
