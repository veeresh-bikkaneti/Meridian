/**
 * Scout Map throttled-device E2E (PBI-9a) — CONVERTED 2026-10-20.
 *
 * This VM's Chromium already reports a SwiftShader software renderer
 * (verified 2026-10-08), so the harness IS the weak device the probe
 * must catch. 6x CPU throttling (CDP) simulates the old-phone main
 * thread.
 *
 * The spec used to walk the capability DIALOG (the weak renderer got a
 * choice). The owner's 2026-10-20 ruling — "Auto-switch silently on
 * weak devices (my decision stands)" — removed the dialog: the boot
 * probe now switches the session to Scout silently, stores an AUTO
 * record (source "probe", no accepted flag), and the game completes.
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
import { readMapMode, readStoredMapMode } from "./scout-helpers";

test.setTimeout(300_000);
// Reduced motion makes the map's intro dive an instant jump-to, which is
// the only way a 6x-throttled software renderer finishes in sane time.
// Game logic is unaffected (see the tutorial spec's use of this seam).
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ context }) => {
  // Production boot behavior: do NOT suppress the auto-switch.
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
});

test("SwiftShader + 6x CPU throttle: scout auto-switches silently and the game completes", async ({
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

  // No dialog: the weak renderer was switched silently at boot, and the
  // auto record is stored — qualifying source kept, no accepted flag.
  await expect(page.getByTestId("scout-boot-offer")).toHaveCount(0);
  const stored = await readStoredMapMode(page);
  expect(stored).toMatchObject({ mode: "scout", source: "probe" });
  expect((stored as unknown as Record<string, unknown>)?.accepted).toBeUndefined();

  await page.getByRole("button", { name: "Play the globe" }).click();

  // The session is in scout from the first mount.
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
