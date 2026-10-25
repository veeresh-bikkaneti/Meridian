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
const NOTICE_KEY = "meridian.chunkReloadNotice";
/** CHUNK_ANNOUNCE_DWELL_MS in src/lib/chunk-recovery.ts (manifest D3). */
const DWELL_MS = 10_000;
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

/**
 * A11Y announcement round (manifest 2026-10-25-a11y-reload-announcement).
 *
 * Spike record (pre-fix build, 2026-10-25, temporary probe spec, log
 * spike-run2.log): the safari-launch recipe below produced the real
 * MapErrorBoundary card at alertAtMs=5532 after the click and a
 * recovery navigation at navAtMs=6887 with the guard stamp present —
 * Branch A: recovery DOES engage on the SatelliteMap path, ~1.4 s
 * after the card. 11-E is therefore the primary variant, not 11-E'.
 */

test("11-E: the real map error card gets the full announcement dwell before the recovery navigation", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  // Navigation recorder: on every document start, if the alert record
  // already exists in sessionStorage (it survives the reload) and no
  // navigation has been stamped yet, stamp it. First boot: no alert
  // record, no-op. The reload's document start is the navigation time.
  await context.addInitScript(() => {
    try {
      if (
        sessionStorage.getItem("__crA11yAlert") &&
        !sessionStorage.getItem("__crA11yNavAt")
      ) {
        sessionStorage.setItem("__crA11yNavAt", String(Date.now()));
      }
    } catch {
      // Recorder is best-effort; the assertions below fail loudly if
      // the records are missing.
    }
  });
  // The real chunk failure: abort the satellite-map chunk on the
  // context (SW-initiated fetches are invisible to page.route —
  // safari-launch precedent). Registered after serveBuiltArtifact so
  // it wins for this chunk.
  await context.route("**/satellite-map*.js", (route) => route.abort("failed"));

  const page = await context.newPage();
  await bootAndMark(page);

  // Alert recorder: capture the FIRST role=alert whose text is the
  // map error card, with its full rendered text and timestamp, in
  // sessionStorage — the evidence is recorded in-page, before any
  // navigation, not reconstructed after the reload.
  await page.evaluate(() => {
    const obs = new MutationObserver(() => {
      const cards = Array.from(document.querySelectorAll('[role="alert"]'));
      const card = cards.find((e) => (e.textContent ?? "").includes("load the map"));
      if (card) {
        sessionStorage.setItem(
          "__crA11yAlert",
          JSON.stringify({ at: Date.now(), text: card.textContent ?? "" }),
        );
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await page.getByRole("button", { name: "Play the globe" }).click();

  // 1. The full production card was present before navigation.
  await expect
    .poll(
      () => page.evaluate(() => sessionStorage.getItem("__crA11yAlert")),
      { timeout: 30_000 },
    )
    .not.toBeNull();
  const alertRec = JSON.parse(
    (await page.evaluate(() => sessionStorage.getItem("__crA11yAlert"))) as string,
  ) as { at: number; text: string };
  expect(alertRec.text).toContain("load the map.");
  expect(alertRec.text).toContain("Your game is safe");
  expect(alertRec.text).toContain("Check your connection, then try again.");
  expect(alertRec.text).toContain("Try again");

  // 2. The recovery navigation follows (guard stamp proves it was
  // the recovery reload, not some other navigation).
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);
  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).not.toBeNull();

  // 3. Timing oracle: the card dwelt at least DWELL_MS before the
  // navigation. RED pre-fix: navAt - alertAt ≈ 1_200–1_450 (reload at
  // failure+1_500, card rendered ε after the failure). The upper bound
  // is an anti-hang bound only, labelled as such.
  await expect
    .poll(
      () => page.evaluate(() => sessionStorage.getItem("__crA11yNavAt")),
      { timeout: 30_000 },
    )
    .not.toBeNull();
  const navAt = Number(await page.evaluate(() => sessionStorage.getItem("__crA11yNavAt")));
  const dwell = navAt - alertRec.at;
  expect(dwell).toBeGreaterThanOrEqual(DWELL_MS);
  expect(dwell).toBeLessThanOrEqual(1_500 + DWELL_MS + 15_000);

  await page.close();
});

test("13-E: after a recovery reload the explanation notice shows exactly once", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

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

  // The notice: exactly one, a status region, visible, with the copy.
  // RED pre-fix: this visibility leg times out — the element is never
  // rendered. (The key-null assert below would pass vacuously
  // pre-fix — the key is never written — so it is only a guard leg in
  // combination with this one.)
  const notice = page.getByTestId("chunk-reload-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });
  expect(await page.getByTestId("chunk-reload-notice").count()).toBe(1);
  expect(await notice.getAttribute("role")).toBe("status");
  expect((await notice.textContent()) ?? "").toContain("Meridian had to reload.");
  const noticeKey = await page.evaluate((key) => sessionStorage.getItem(key), NOTICE_KEY);
  expect(noticeKey).toBeNull(); // consumed at boot

  // Show-once across boots: a further manual reload shows no notice.
  await page.reload();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 60_000,
  });
  expect(await page.getByTestId("chunk-reload-notice").count()).toBe(0);

  await page.close();
});

test("14-E: no card on screen means no deferral — the fast reload still leaves the notice", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await bootAndMark(page);

  // Precondition, asserted not assumed: the menu has no alert.
  expect(await page.getByRole("alert").count()).toBe(0);

  const dispatchAt = await page.evaluate(() => {
    const at = Date.now();
    window.dispatchEvent(new Event("vite:preloadError"));
    return at;
  });
  await expect.poll(() => markerGone(page), { timeout: 30_000 }).toBe(true);

  // The stamp is written at the decision instant on the page clock,
  // so it times the decision precisely (no boot-lag noise): the plain
  // 1_500 decision, with ≥1 s margin below the deferred time. A
  // defer-unconditionally implementation fails this leg.
  const stamp = Number(
    await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY),
  );
  expect(Number.isFinite(stamp)).toBe(true);
  expect(stamp - dispatchAt).toBeGreaterThanOrEqual(1_000);
  expect(stamp - dispatchAt).toBeLessThan(1_500 + DWELL_MS - 1_000);

  // And the fast path still explains itself after the reload.
  await expect(page.getByTestId("chunk-reload-notice")).toBeVisible({
    timeout: 30_000,
  });

  await page.close();
});

test("6-E2: the stale offer stands recovery down across the whole dwell window — no reload, no stamp, no notice", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
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
  // 6-E's wait extended across the full possible dwell: a deferred
  // decision that ignored the offer would fire inside this window.
  await page.waitForTimeout(1_500 + DWELL_MS + 2_000);
  expect(await markerGone(page)).toBe(false);
  const stamp = await page.evaluate((key) => sessionStorage.getItem(key), GUARD_KEY);
  expect(stamp).toBeNull();
  const notice = await page.evaluate((key) => sessionStorage.getItem(key), NOTICE_KEY);
  expect(notice).toBeNull();

  await page.close();
});
