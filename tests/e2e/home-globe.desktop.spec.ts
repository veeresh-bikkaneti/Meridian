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
  // A painted, textured globe is tens of KB of PNG; a blank or
  // never-painted canvas compresses to almost nothing.
  expect(shot.length).toBeGreaterThan(10_000);
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
