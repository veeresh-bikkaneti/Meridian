/**
 * Scout Map settings-toggle E2E (PBI-7 + Phase A UX contract).
 *
 * Contract: data-testid="map-mode-button" lives in the Play top bar
 * (NOT inside .satellite-map). The toggle flips stored state immediately
 * but takes effect on the NEXT place mount — never a mid-round remount.
 * Round-trips localStorage `meridian:map-mode`.
 *
 * PBI-7 dependency: fails until the dev implements the toggle.
 */
import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  clickNextPlace,
  readPhase,
  readRun,
  APP_NO_IDLE,
} from "./helpers";
import {
  mapModeButton,
  mapWrapper,
  readMapMode,
  readStoredMapMode,
  seedManualMode,
  spoofCapableDevice,
} from "./scout-helpers";

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Start FULL: the VM's SwiftShader Chromium would otherwise qualify
  // scout at boot and the switch/toggle paths become no-ops.
  await spoofCapableDevice(context);
});

test("toggle lives in the Play top bar, outside the map", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  const btn = mapModeButton(page);
  await expect(btn).toBeVisible({ timeout: 15_000 });

  // NOT inside satellite-map.tsx's wrapper.
  const insideMap = await btn.evaluate(
    (el) => el.closest(".satellite-map") !== null,
  );
  expect(insideMap).toBe(false);
});

test("toggle flips stored state and round-trips localStorage", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  const btn = mapModeButton(page);
  await expect(btn).toBeVisible({ timeout: 15_000 });

  expect(await readStoredMapMode(page)).toBeNull();

  await btn.click();
  expect((await readStoredMapMode(page))?.mode).toBe("scout");

  // Reload: the toggle reflects the stored state.
  await page.reload();
  await startGlobeRun(page);
  await expect(mapModeButton(page)).toBeVisible({ timeout: 15_000 });
  expect((await readStoredMapMode(page))?.mode).toBe("scout");

  await mapModeButton(page).click();
  expect((await readStoredMapMode(page))?.mode).toBe("full");
});

test("toggle takes effect on the NEXT place mount — never a mid-round remount", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");

  const btn = mapModeButton(page);
  await expect(btn).toBeVisible({ timeout: 15_000 });

  // Marker on the live map wrapper: a remount would destroy it.
  await mapWrapper(page).evaluate((el) => {
    el.setAttribute("data-qa-mount-probe", "alive");
  });
  const modeBefore = await readMapMode(page);

  // Toggle mid-round (aim phase): the map must NOT remount.
  await btn.click();
  await page.waitForTimeout(2_000);
  expect(await readPhase(page)).toBe("aim");
  expect(await mapWrapper(page).getAttribute("data-qa-mount-probe")).toBe("alive");
  expect(await readMapMode(page)).toBe(modeBefore);
  expect(await mapWrapper(page).count()).toBe(1);

  // Advance to the next place: the NEW mount picks up the toggled mode.
  const runBefore = await readRun(page);
  await commitMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const runAfter = await readRun(page);
  expect(runAfter.placeId).not.toBe(runBefore.placeId);

  await expect
    .poll(() => readMapMode(page), { timeout: 20_000 })
    .toBe("scout");
});

test("manual toggle beats the weak-device probe (no demotion on override)", async ({
  context,
}) => {
  // This VM's Chromium reports a SwiftShader renderer, so the boot probe
  // would qualify scout — the seeded manual "full" must win anyway.
  await seedManualMode(context, "full");
  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  expect(await readMapMode(page)).not.toBe("scout");
  await page.close();
});
