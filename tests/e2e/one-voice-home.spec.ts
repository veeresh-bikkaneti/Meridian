import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * One voice at a time on the Home page (owner, 2026-11-11: "2 or 3
 * characters talk at once"; the rule: "if one speak the other needs to
 * shut up").
 *
 * Every character voice claims the app-wide channel
 * (src/game/audio/voice-channel.ts). This spec watches the real page:
 * at every moment a voice STARTS (a media `play` event, or a wrapped
 * speechSynthesis.speak), it counts the other voices still sounding. The
 * count must never reach two.
 *
 * What counts as a voice: an audio element under /audio/ that is playing
 * (not paused, not ended) plus a device-speech utterance that has not
 * ended or been cancelled. Muted card films and short sound effects are
 * not voices.
 *
 * Home has no card to read, so the Read aloud button (cards only) is not
 * reachable here; the device-speech path is covered by the wrapped
 * speak() and by the voice-channel unit test.
 */
test.setTimeout(180_000);

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.addInitScript(() => {
    const w = window as unknown as {
      __voiceMax: number;
      __voiceStarts: string[];
      __speechLive: number;
      __audios: HTMLMediaElement[];
    };
    w.__voiceMax = 0;
    w.__voiceStarts = [];
    w.__speechLive = 0;
    w.__audios = [];

    const isVoice = (a: HTMLMediaElement) =>
      !a.muted && (a.currentSrc || a.src || "").includes("/audio/");
    const sounding = (except?: HTMLMediaElement) =>
      w.__audios.filter((a) => a !== except && isVoice(a) && !a.paused && !a.ended).length +
      w.__speechLive;
    const note = (name: string, others: number) => {
      w.__voiceStarts.push(name);
      w.__voiceMax = Math.max(w.__voiceMax, others + 1);
    };

    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!w.__audios.includes(this)) w.__audios.push(this);
      // These elements are detached (never in the DOM), so a document
      // `play` listener cannot see them: measure at the play() call.
      if (isVoice(this) && (this.paused || this.ended)) {
        note(this.currentSrc || this.src, sounding(this));
      }
      return origPlay.apply(this);
    };

    if ("speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      const origSpeak = synth.speak.bind(synth);
      const origCancel = synth.cancel.bind(synth);
      synth.speak = (u: SpeechSynthesisUtterance) => {
        note("speech", sounding());
        w.__speechLive += 1;
        const done = () => {
          w.__speechLive = Math.max(0, w.__speechLive - 1);
        };
        u.addEventListener("end", done, { once: true });
        u.addEventListener("error", done, { once: true });
        origSpeak(u);
      };
      synth.cancel = () => {
        w.__speechLive = 0;
        origCancel();
      };
    }
  });
});

test("Home: greeting, then a tap on the storyteller, then the Comet speaker — never two voices at once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE);

  // Wait for the greeting's audio slot to resolve, then release it: the
  // first-visit invite's "Not now" is the gesture that starts it.
  await page
    .waitForResponse((r) => r.url().includes("storyteller-assets.json"), { timeout: 30_000 })
    .catch(() => undefined);
  const notNow = page.getByRole("button", { name: /not now/i });
  if (await notNow.isVisible().catch(() => false)) await notNow.click();
  else await page.mouse.click(640, 400);
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __voiceStarts: string[] }).__voiceStarts.length),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);

  // Tap the storyteller (the banner figure), then Comet's speaker, while
  // the first voice may still be sounding.
  const banner = page.getByTestId("storyteller-home");
  if (await banner.isVisible().catch(() => false)) {
    await banner.locator("button, [role=button]").first().click({ force: true }).catch(() => undefined);
  }
  const speaker = page.getByTestId("comet-greeting-speaker");
  if (await speaker.isVisible().catch(() => false)) {
    await speaker.click({ force: true }).catch(() => undefined);
  }
  await page.waitForTimeout(3_000);

  const max = await page.evaluate(
    () => (window as unknown as { __voiceMax: number }).__voiceMax,
  );
  expect(max).toBeLessThanOrEqual(1);
});
