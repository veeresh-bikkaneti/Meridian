import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Stale-chunk auto-recovery E2E (src/lib/chunk-recovery.ts).
 *
 * The 2026-10-24 crash: a deploy replaced the assets mid-session, the
 * old tab's lazy LoopScreen chunk URL 404'd, and the session died on
 * the error card. The recovery handler — installed at boot in
 * game-app.tsx — listens for the bundler's `vite:preloadError` event
 * (plus a message-filtered backstop) and reloads the tab at most once
 * per episode: an episode begins when an auto-reload writes its
 * timestamp to sessionStorage, and ends after 30 s of continuous
 * failure-free time on a page where the episode is active.
 *
 * These specs drive the REAL built artifact: they dispatch the same
 * event the bundler dispatches on a failed chunk preload and observe
 * the navigations. A page-side marker proves a reload happened (the
 * marker cannot survive one); the sessionStorage guard stamp proves
 * the episode latch engaged.
 */

const GUARD_KEY = "meridian.chunkReloadAt";
const REFRESH_COPY = "A new version of Meridian is available.";

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

async function setMarker(page: import("playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__crProbe = "alive";
  });
}

test("1-E: vite:preloadError reloads exactly once and the guard stamp rides through the reload", async ({
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

  await page.close();
});

test("8-E: unrelated errors never reload — fresh page, waited past the decision delay", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  // A non-signature window error, a generic ErrorEvent, and an
  // unhandled rejection with an ordinary message.
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("some render bug") }),
    );
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    void Promise.reject(new Error("network down"));
  });
  // D + 2_000 = 3_500 ms: past the 1_500 ms decision delay, so a
  // wrongly scheduled reload would already have fired.
  await page.waitForTimeout(3_500);
  expect(await markerGone(page)).toBe(false);
  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).toBeNull();

  await page.close();
});

test("backstop: an unhandled rejection carrying the chunk signature reloads once — and the latch blocks a second rejection on the reloaded page (B1-EXT)", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  const rejectChunk = () =>
    page
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
  await rejectChunk();
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);

  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).not.toBeNull();

  // B1-EXT: on the reloaded page, a second rejection of the same chunk
  // is blocked by the episode latch — no second navigation.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await setMarker(page);
  await rejectChunk();
  await page.waitForTimeout(3_500);
  expect(await markerGone(page)).toBe(false);

  await page.close();
});

test("3A-E: a seeded stamp blocks the reload; removing it re-arms and the returned page carries a fresh stamp", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  // Seed an episode stamp 1 s old. HARD precondition: a failed seed
  // fails the test — it is never reclassified or skipped.
  const seed = await page.evaluate((key) => {
    const value = String(Date.now() - 1_000);
    sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key) === value ? value : null;
  }, GUARD_KEY);
  expect(seed).not.toBeNull();

  await page.evaluate(() => {
    window.dispatchEvent(new Event("vite:preloadError"));
  });
  await page.waitForTimeout(3_500); // D + 2_000: past the decision delay
  expect(await markerGone(page)).toBe(false);
  const blockedStamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(blockedStamp).toBe(seed);

  // Positive control (O2 repair): remove the stamp, dispatch again —
  // the marker MUST go; then the returned page's stamp is fresh.
  await page.evaluate((key) => {
    sessionStorage.removeItem(key);
  }, GUARD_KEY);
  await page
    .evaluate(() => {
      window.dispatchEvent(new Event("vite:preloadError"));
    })
    .catch(() => {
      // Navigation cuts the evaluate short.
    });
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await setMarker(page);
  const freshStamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(freshStamp).not.toBeNull();
  expect(Number.isFinite(Number(freshStamp))).toBe(true);
  expect(freshStamp).not.toBe(seed);

  await page.close();
});

test("6-E: the app's own new-version offer on screen stands recovery down — no navigation, no stamp", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  // The crash-watchdog stale-build recipe: abort the lazy geonames
  // chunk and stub build-meta.json with a mismatched buildId so the
  // app's real new-version offer appears. Registered after
  // serveBuiltArtifact so these win.
  await context.route("**/assets/globe-*.js", (route) => route.abort());
  await context.route("**/build-meta.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ buildId: "e2e-different-build" }),
    });
  });

  const page = await context.newPage();
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.getByText(REFRESH_COPY, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

  await setMarker(page);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("vite:preloadError"));
  });
  await page.waitForTimeout(3_500); // D + 2_000: past the decision delay
  expect(await markerGone(page)).toBe(false);
  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).toBeNull();

  await page.close();
});
