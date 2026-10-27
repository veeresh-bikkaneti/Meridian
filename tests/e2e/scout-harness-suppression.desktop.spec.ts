/**
 * Scout harness suppression — the discriminating pair for issue #154
 * item 1 (the production test seam removal).
 *
 * Until this change, the E2E harness suppressed the boot auto-switch by
 * setting window.__meridianSuppressScoutOffer, a flag the PRODUCTION
 * app read — a test bypass shipped to every player. The seam is gone:
 * serveBuiltArtifact now installs a capable-device spoof by default
 * (WebGL renderer + deviceMemory), so the app's own qualification
 * honestly reaches "full" on this weak VM.
 *
 * This VM's Chromium really is a weak device (SwiftShader — the probe
 * qualifies it for Scout). That is what makes the pair discriminating:
 *
 * - Test 1 (default serve, no spoof calls in the test): boot stays
 *   full, writes NO stored record, and shows no auto-switch note. If
 *   the serve-default spoof ever stops working, this test MUST go red —
 *   the app would auto-switch, exactly as it does in test 2.
 * - Test 2 (serve with the spoof opted out): the SAME boot auto-switches
 *   to Scout with a probe auto record. This proves test 1's pass comes
 *   from the harness spoof, not from the app having lost its
 *   auto-switch — the production boot path is exercised as-is.
 */
import { test, expect } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, APP_NO_IDLE } from "./helpers";
import {
  mapWrapper,
  readMapMode,
  readStoredMapMode,
  starfield,
} from "./scout-helpers";

test.setTimeout(120_000);

test("default serve: weak VM boots full — no record, no note, full map mounts", async ({
  context,
}) => {
  // Default serve installs the capable-device spoof. The test itself
  // installs NOTHING — that is the point: if the default ever breaks,
  // nothing here can rescue it.
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  // Boot qualification has settled (it runs in the mount effect, before
  // Home is usable): full mode, no auto record, no auto-switch note.
  const indicator = page.getByTestId("map-mode-indicator");
  await expect(indicator).toHaveAttribute("data-mode", "full", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("scout-auto-notice")).toHaveCount(0);
  await page.waitForTimeout(3_000);
  expect(await readStoredMapMode(page)).toBeNull();

  // The full map actually mounts (starfield exists only in full mode).
  await startGlobeRun(page);
  await expect(mapWrapper(page)).toBeVisible({ timeout: 30_000 });
  expect(await readMapMode(page)).toBe("full");
  await expect(starfield(page)).toHaveCount(1);
  await page.close();
});

test("opted-out serve: the same weak VM auto-switches to Scout (contrast pin)", async ({
  context,
}) => {
  // No spoof: the production boot path sees the real SwiftShader
  // device and does what it does on any weak device — silent Scout
  // with a probe auto record. If THIS test fails, the auto-switch
  // itself regressed; if test 1 fails while this passes, the harness
  // spoof regressed. Either way the failure names its layer.
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);

  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(() => readStoredMapMode(page), { timeout: 10_000 })
    .toMatchObject({ mode: "scout", source: "probe" });
  await expect(page.getByTestId("scout-auto-notice")).toBeVisible({
    timeout: 10_000,
  });
  const indicator = page.getByTestId("map-mode-indicator");
  await expect(indicator).toHaveAttribute("data-mode", "scout");
  await page.close();
});
