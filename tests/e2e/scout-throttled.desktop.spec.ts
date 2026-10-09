/**
 * Scout Map throttled-device E2E (PBI-9a).
 *
 * This VM's Chromium already reports a SwiftShader software renderer
 * (verified 2026-10-08), so the harness IS the weak device the probe must
 * catch. 6x CPU throttling (CDP) simulates the old-phone main thread.
 * Expectation: the boot probe qualifies scout and a full game completes.
 *
 * PBI-1..3 dependency: fails until capability.ts + scout rendering land.
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  clickNextPlace,
  readPhase,
  APP_NO_IDLE,
} from "./helpers";
import { readMapMode } from "./scout-helpers";

test.setTimeout(300_000);
// Reduced motion makes the map's intro dive an instant jump-to, which is
// the only way a 6x-throttled software renderer finishes in sane time.
// Game logic is unaffected (see the tutorial spec's use of this seam).
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("SwiftShader + 6x CPU throttle: scout qualifies and the game completes", async ({
  context,
}) => {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

  // Sanity: the harness really is a software-renderer device.
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl");
    const ext = g?.getExtension("WEBGL_debug_renderer_info") as
      | { UNMASKED_RENDERER_WEBGL: number }
      | null;
    return ext ? (g!.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : "none";
  });
  expect(renderer).toMatch(/swiftshader/i);

  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole("button", { name: "Play the globe" }).click();

  // The boot probe qualifies scout on the weak renderer.
  await expect
    .poll(() => readMapMode(page), { timeout: 60_000 })
    .toBe("scout");

  // The game completes in scout mode: aim → commit → next place → aim.
  await expect.poll(() => readPhase(page), { timeout: 90_000 }).toBe("aim");
  await commitMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 90_000 }).toBe("aim");

  // Still scout after the place transition (no mid-game flip-flop).
  expect(await readMapMode(page)).toBe("scout");
  await page.close();
});
