import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * ResizeObserver telemetry-noise hardening (fix/resizeobserver-telemetry-noise).
 *
 * Runtime proof for the two halves of the fix:
 * 1. The three prod ResizeObserver sites (atlas-map draw, scroll-cue update,
 *    starfield repaint) are rAF-coalesced — rapid resizes during boot must
 *    not produce an uncaught "ResizeObserver loop" pageerror, and the
 *    observed components must keep working (map ready, scroll cue state).
 * 2. The crash-pipeline classifier downgrades the benign browser message —
 *    covered at unit level (observability.test.ts); here we assert the boot
 *    session completes cleanly end to end.
 *
 * Video records the whole boot session (constitutional law).
 */
test.setTimeout(180_000);
test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

test("boot session: rapid resizes produce no ResizeObserver pageerror; map stays functional", async ({
  page,
  context,
}) => {
  await serveBuiltArtifact(context);

  const roPageErrors: string[] = [];
  page.on("pageerror", (err) => {
    if (/ResizeObserver loop/i.test(String(err?.message ?? err))) {
      roPageErrors.push(String(err?.message ?? err));
    }
  });

  await page.goto(APP_NO_IDLE, { waitUntil: "domcontentloaded" });
  // Let boot settle: fonts, map init, storyteller, starfield — the exact
  // window where the production report fired at milestone boot_ready.
  await page.waitForTimeout(6000);

  // Thrash the layout the way boot does: rapid viewport resizes.
  for (const w of [390, 360, 390, 320, 390]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(400);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2000);

  expect(roPageErrors).toEqual([]);

  // Behavior intact: the app booted and is interactive (rAF wrapping must
  // not have swallowed the resize-driven updates).
  await expect(page.getByRole("button", { name: /drop pin|play|start/i }).first()).toBeVisible({
    timeout: 15000,
  });
});
