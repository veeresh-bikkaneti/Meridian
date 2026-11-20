import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

/**
 * Landmark globe presence gate (Stage 2 mount/paint cure, 2026-11-19).
 *
 * The Wave 1 panel blocked on prod captures that showed no globe: the
 * captures were shot while the opaque loading orb still covered the
 * mount (cold-load settle on a slow machine takes seconds; the orb only
 * lifts once the globe texture uploads). These tests pin the behaviour
 * the captures could not prove: on a fresh profile the live globe must
 * actually arrive — canvas mounted, orb gone, canvas painted — and when
 * the texture cannot load, the static disc fallback must land instead
 * of an endless spinner.
 */

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 320, height: 568 },
];

async function expectGlobePainted(page: Page) {
  const canvas = page.locator(".hv5-globe-mount canvas");
  await expect(canvas).toHaveCount(1, { timeout: 60_000 });
  // The loading orb is opaque and covers the mount until the texture
  // uploads; it unmounts after its fade. No orb + a painted canvas is
  // the settled state a capture must wait for.
  await expect(page.locator(".hv5-globe-orb")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(".hv5-globe-fallback")).toHaveCount(0);
  const shot = await canvas.screenshot();
  // Byte size alone cannot prove the texture painted (an untextured
  // black sphere with landmarks exceeds any size floor — Wave 1
  // re-vote, UX designer). Sample the disc interior's colours from
  // the composited screenshot instead: the parchment texture is
  // mid-luminance and many-coloured; a black or blank disc is not.
  const stats = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const x0 = Math.floor(c.width * 0.3);
    const x1 = Math.floor(c.width * 0.7);
    const y0 = Math.floor(c.height * 0.3);
    const y1 = Math.floor(c.height * 0.7);
    const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const w = x1 - x0;
    let sampled = 0;
    let painted = 0;
    let nearBlack = 0;
    const colours = new Set<string>();
    for (let y = 0; y < y1 - y0; y += 7) {
      for (let x = 0; x < w; x += 7) {
        const i = (y * w + x) * 4;
        sampled++;
        if (data[i + 3] < 128) continue;
        painted++;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum < 25) nearBlack++;
        colours.add(`${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`);
      }
    }
    return {
      paintedShare: painted / sampled,
      nearBlackShare: painted ? nearBlack / painted : 1,
      distinct: colours.size,
    };
  }, shot.toString("base64"));
  expect(stats.paintedShare).toBeGreaterThan(0.9);
  expect(stats.nearBlackShare).toBeLessThan(0.25);
  expect(stats.distinct).toBeGreaterThanOrEqual(8);
}

test.describe("landmark globe cold load", () => {
  test.setTimeout(300_000);

  for (const vp of VIEWPORTS) {
    test(`globe mounts and paints at ${vp.width}x${vp.height}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: vp });
      await serveBuiltArtifact(context);
      const page = await context.newPage();
      await page.goto(APP_URL);
      await expectGlobePainted(page);
      await context.close();
    });
  }

  test("texture failure lands on the static disc, never an endless spinner", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await serveBuiltArtifact(context);
    // Registered after serveBuiltArtifact, so this route wins dispatch.
    await context.route(/globe-texture[^/]*\.webp/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expect(page.locator(".hv5-globe-fallback")).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator(".hv5-globe-mount canvas")).toHaveCount(0);
    await expect(page.locator(".hv5-globe-orb")).toHaveCount(0);
    await context.close();
  });
});
