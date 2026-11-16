import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Item 22 recheck (Stream W): the picker montage, verified live
 * instead of assumed. Report C could not confirm playback, so this
 * spec measures it on the built artifact:
 * - the film's frames actually change: the <video> is drawn to a
 *   canvas twice, ~700ms apart, and the pixels must differ (a
 *   frozen poster or a stalled decoder fails this);
 * - currentTime advances across the same window;
 * - after the sound control is tapped, the film is unmuted and
 *   still playing, and Chrome's decoded-audio counter grows when
 *   the browser exposes it (headless Chrome renders to a null
 *   device, so audibility itself is reported, not asserted);
 * - item 11's evidence rides along: no sideways scroll at 1280px.
 */
test.setTimeout(180_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

async function openPicker(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  });
  await serveBuiltArtifact(context);
  await context.addInitScript(
    (key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: "7-10",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    PROFILE_KEY,
  );
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("why-learn-hero-video")).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

/** Mean absolute per-channel difference between two canvas draws of the film. */
async function frameSample(page: Page): Promise<{ time: number; pixels: number[] }> {
  return page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>('[data-testid="why-learn-hero-video"]');
    if (!video) throw new Error("montage video not mounted");
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels: number[] = [];
    for (let i = 0; i < data.length; i += 401) pixels.push(data[i] ?? 0);
    return { time: video.currentTime, pixels };
  });
}

test("montage frames advance, sound unmutes, and the picker does not scroll sideways at 1280", async ({
  browser,
}) => {
  const { context, page } = await openPicker(browser);
  try {
    const video = page.getByTestId("why-learn-hero-video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);

    const first = await frameSample(page);
    await page.waitForTimeout(700);
    const second = await frameSample(page);

    expect(second.time).toBeGreaterThan(first.time);
    let diff = 0;
    for (let i = 0; i < Math.min(first.pixels.length, second.pixels.length); i++) {
      diff += Math.abs((second.pixels[i] ?? 0) - (first.pixels[i] ?? 0));
    }
    const meanDiff = diff / Math.max(1, Math.min(first.pixels.length, second.pixels.length));
    expect(meanDiff).toBeGreaterThan(1);

    // Sound: the film starts muted (autoplay policy); the sound
    // control must unmute it and keep it playing.
    await page.getByTestId("why-learn-hero-sound").click();
    const audio = await video.evaluate((v: HTMLVideoElement) => {
      const anyVideo = v as HTMLVideoElement & { webkitAudioDecodedByteCount?: number };
      return { muted: v.muted, paused: v.paused, audioBytes: anyVideo.webkitAudioDecodedByteCount ?? -1 };
    });
    expect(audio.muted).toBe(false);
    expect(audio.paused).toBe(false);
    if (audio.audioBytes >= 0) {
      await page.waitForTimeout(700);
      const later = await video.evaluate(
        (v) => (v as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount ?? -1,
      );
      expect(later).toBeGreaterThan(audio.audioBytes);
    }

    const { sw, iw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    expect(sw).toBeLessThanOrEqual(iw);
  } finally {
    await context.close();
  }
});
