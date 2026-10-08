/**
 * Scout Map webglcontextlost switch E2E (PBI-5 + PBI-9c).
 *
 * The ONLY automatic mid-game switch: on webglcontextlost the app must
 * preserve ALL game state, tear down the GL map, mount Scout Map, and
 * write meridian:map-mode — with no page reload and no data loss, under
 * a live round. Repeat events (context-loss storms) must not double-mount.
 *
 * PBI-5 dependency: fails until the dev implements the switch.
 */
import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  readPhase,
  readRun,
  pinCount,
  APP_NO_IDLE,
} from "./helpers";
import {
  readMapMode,
  mapWrapper,
  readStoredMapMode,
} from "./scout-helpers";

test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function fireContextLost(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page
      .locator(".maplibregl-canvas")
      .evaluate((canvas) =>
        canvas.dispatchEvent(new Event("webglcontextlost")),
      );
  }
}

test("mid-round context loss: map switches, all game state preserved", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  expect(await readPhase(page)).toBe("aim");

  // Snapshot the full game state before the loss.
  const before = await readRun(page);
  expect(before.placeId).not.toBeNull();
  await page.evaluate(() => {
    (window as unknown as { __qaBoot?: number }).__qaBoot = 1;
  });

  await fireContextLost(page);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");

  // No reload: the boot marker survives.
  expect(
    await page.evaluate(
      () => (window as unknown as { __qaBoot?: number }).__qaBoot,
    ),
  ).toBe(1);

  // Game state is byte-identical: phase, hits, index, place.
  const after = await readRun(page);
  expect(after).toEqual(before);

  // The round still plays: commit a pin, the run continues.
  await commitMiss(page);
  await expect(page.locator(".maplibregl-marker").first()).toBeVisible({
    timeout: 15_000,
  });
  expect(await pinCount(page)).toBeGreaterThan(0);
});

test("context-loss storm: no double-mount, single scout map", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);

  await fireContextLost(page, 3);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");

  // Settle, then assert exactly one map instance.
  await page.waitForTimeout(3_000);
  expect(await mapWrapper(page).count()).toBe(1);
  expect(await page.locator(".maplibregl-canvas").count()).toBe(1);
  expect(await readPhase(page)).toBe("aim");
});

test("switch writes meridian:map-mode so the next boot stays scout", async ({
  page,
}) => {
  await page.goto(APP_NO_IDLE);
  await startGlobeRun(page);
  await fireContextLost(page);
  await expect.poll(() => readMapMode(page), { timeout: 20_000 }).toBe("scout");

  const stored = await readStoredMapMode(page);
  expect(stored?.mode).toBe("scout");

  // Next boot: still scout (the stored assignment re-qualifies via the
  // fresh probe on this SwiftShader harness).
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await startGlobeRun(page);
  expect(await readMapMode(page)).toBe("scout");
});
