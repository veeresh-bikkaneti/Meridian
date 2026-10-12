import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  installAudioProbe,
  readAudioProbe,
} from "./helpers";

/**
 * TEST cell — fix PR "narration silent in production" (branch
 * fix/narration-silent-prod).
 *
 * Fix E (banner) — black-box journey on a phone viewport (390×844, touch):
 * fresh visit (sound on, the default; tutorial seen; tour skipped for the
 * day) → the greeting's play() REJECTS (the clip exists but playback never
 * starts — the silent symptom) → the text-only fallback renders WITH the
 * one-time retry hint naming the figure tap (the banner has no speaker
 * button) → a real figure tap replays the greeting (a new mp3 request goes
 * out and the audio element really plays) instead of a poke line.
 *
 * This Chromium does not enforce the autoplay policy, so the rejection is
 * staged with a one-shot HTMLMediaElement.prototype.play patch limited to
 * greeting clips — the rejection then walks the app's real catch path
 * (greetPlayRejectedRef → onFail → hint). The replay uses the genuine
 * play() and the served clip.
 *
 * FAIL-pre: without the fix the fallback carries no hint, and the figure
 * tap rotates a poke line — no new mp3 request goes out.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
const APP = "http://127.0.0.1:4123/Meridian/";
const FALLBACK_TEXT = "The words are right here — read along with me.";
// BLOCK 1 (scrum 2026-10-11): the banner hint names the figure tap — the
// real retry path (Fix D), since the banner has no speaker button.
const RETRY_HINT = "Tap me to try again.";
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("banner play() rejection shows the figure-tap hint; figure tap replays", async ({
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
  // Force ONE play() rejection on the greeting clip. Limited to greeting
  // URLs so nothing else in the app can consume the staged rejection.
  await context.addInitScript(() => {
    const proto = HTMLMediaElement.prototype;
    const origPlay = proto.play;
    let rejected = false;
    proto.play = function (this: HTMLMediaElement): Promise<void> {
      const el = this as HTMLAudioElement;
      const src = el.currentSrc || el.src;
      if (!rejected && src.includes("greet-")) {
        rejected = true;
        return Promise.reject(
          new DOMException("play() failed: no user activation", "NotAllowedError"),
        );
      }
      return origPlay.call(this);
    };
  });
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      // Sound on (the default) — the greeting attempt is real; it fails
      // on playback, not on the mute.
      if ("serviceWorker" in navigator) {
        const container = navigator.serviceWorker as unknown as Record<
          string,
          unknown
        >;
        container.register = () =>
          Promise.reject(new Error("service worker disabled for test"));
      }
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);

  let mp3Requests = 0;
  await page.route(MP3_PATTERN, (route) => {
    mp3Requests += 1;
    return route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" });
  });

  await page.goto(APP);
  const host = page.getByTestId("storyteller-home");
  const figure = page.getByTestId("storyteller-figure");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });

  // The banner's one-shot consumes any first gesture; the staged play()
  // rejection walks the real catch path → fallback WITH the hint.
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  const fallback = page.getByTestId("storyteller-home-fallback");
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText(FALLBACK_TEXT);
  await expect(fallback).toContainText(RETRY_HINT);

  // The hinted retry path works: a real figure tap replays the greeting —
  // a new mp3 request goes out and the audio element really plays.
  const attemptsBefore = mp3Requests;
  await figure.click({ force: true });
  await expect
    .poll(() => mp3Requests, { timeout: 15_000 })
    .toBeGreaterThan(attemptsBefore);
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);

  expectCleanConsole(errors);
});
