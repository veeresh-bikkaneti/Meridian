import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Stale-chunk auto-recovery E2E (src/lib/chunk-recovery.ts).
 *
 * The 2026-10-24 crash: a deploy replaced the assets mid-session, the
 * old tab's lazy LoopScreen chunk URL 404'd, and the session died on
 * the error card. The recovery handler — installed at boot in
 * game-app.tsx — listens for the bundler's `vite:preloadError` event
 * (plus a message-filtered backstop) and reloads the tab ONCE per
 * 30 s window onto the current build.
 *
 * These specs drive the REAL built artifact: they dispatch the same
 * event the bundler dispatches on a failed chunk preload and observe
 * the navigations. A page-side marker proves a reload happened (the
 * marker cannot survive one); the sessionStorage guard stamp proves
 * the loop guard engaged.
 */

const GUARD_KEY = "meridian.chunkReloadAt";

async function bootAndMark(page: import("playwright/test").Page): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__crProbe = "alive";
  });
}

async function markerGone(page: import("playwright/test").Page): Promise<boolean> {
  return page
    .evaluate(
      () => (window as unknown as Record<string, unknown>).__crProbe === undefined,
    )
    .catch(() => false);
}

test("vite:preloadError reloads exactly once; the guard blocks an immediate second; unrelated errors never reload", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  // The bundler's chunk-failure event -> exactly one reload.
  await page
    .evaluate(() => {
      window.dispatchEvent(new Event("vite:preloadError"));
    })
    .catch(() => {
      // The evaluate itself is cut short by the navigation it triggers.
    });
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);

  // The guard stamp rode through the reload in sessionStorage.
  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).not.toBeNull();
  expect(Number.isFinite(Number(stamp))).toBe(true);

  // A second failure inside the window must NOT reload again.
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__crProbe = "alive";
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("vite:preloadError"));
  });
  await page.waitForTimeout(1_500);
  expect(await markerGone(page)).toBe(false);

  // Unrelated errors must never reload: a generic window error and an
  // unhandled rejection with an ordinary message.
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("some render bug") }),
    );
    void Promise.reject(new Error("network down"));
  });
  await page.waitForTimeout(1_000);
  expect(await markerGone(page)).toBe(false);

  await page.close();
});

test("backstop: an unhandled rejection carrying the chunk signature reloads once", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  await page
    .evaluate(() => {
      void Promise.reject(
        new TypeError(
          "Failed to fetch dynamically imported module: http://127.0.0.1:4123/Meridian/assets/LoopScreen-deadbeef.js",
        ),
      );
    })
    .catch(() => {
      // Navigation cuts the evaluate short.
    });
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);

  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).not.toBeNull();

  await page.close();
});
