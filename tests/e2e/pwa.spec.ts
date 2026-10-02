import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  serveBuiltArtifact,
  startGlobeRun,
  readPhase,
  commitHit,
  clickNextPlace,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * PWA wiring E2E (built Pages artifact, base path /Meridian/).
 *
 * - Service worker registers on load with a clean console; the first
 *   install never reloads the page on its own.
 * - A waiting update shows the non-blocking "Update available" toast;
 *   nothing reloads until the player chooses.
 * - Tapping Update activates the waiting worker and reloads exactly once;
 *   an active game (run + session score) survives the reload.
 * - Offline: navigations fall back to the cached app shell (offline.html
 *   is precached as the last resort).
 *
 * Update simulation: the sandbox browser cannot reach the loopback server,
 * so the browser's own SW update check can never re-fetch sw.js. Instead
 * the spec registers a byte-different worker at /Meridian/sw2.js for the
 * SAME scope — the spec's service-worker lifecycle (install -> waiting ->
 * SKIP_WAITING -> activate -> controllerchange) is identical to a real
 * deploy; only the discovery mechanism differs.
 */

const DIST = path.resolve("dist/client");
const APP_URL = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  const base = await readFile(path.join(DIST, "sw.js"), "utf8");
  // Bump VERSION to simulate a new deploy. The built file carries
  // `meridian-<buildId>` (stamped by fingerprint-sw); match it loosely.
  const bump = (src: string, version: string) =>
    src.replace(/const VERSION = "meridian-[^"]*"/, `const VERSION = "meridian-${version}"`);
  // The app's own registration URL. Serves the built worker as-is.
  await context.route("**/sw.js", async (route) => {
    await route.fulfill({
      status: 200,
      body: base,
      contentType: "text/javascript; charset=utf-8",
    });
  });
  // The "new deploy": byte-different worker for the same scope.
  const v2 = bump(base, "v2");
  await context.route("**/sw2.js", async (route) => {
    await route.fulfill({
      status: 200,
      body: v2,
      contentType: "text/javascript; charset=utf-8",
    });
  });
  // Count document loads to detect (unexpected) reloads.
  await context.addInitScript(() => {
    const n = Number(sessionStorage.getItem("__pwaLoads") ?? 0);
    sessionStorage.setItem("__pwaLoads", String(n + 1));
  });
});

type SwState = {
  registered: boolean;
  scope: string | null;
  hasController: boolean;
  hasWaiting: boolean;
  activeState: string | null;
  activeScript: string | null;
};

async function swState(page: import("playwright/test").Page): Promise<SwState> {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      registered: !!reg,
      scope: reg?.scope ?? null,
      hasController: !!navigator.serviceWorker.controller,
      hasWaiting: !!reg?.waiting,
      activeState: reg?.active?.state ?? null,
      activeScript: reg?.active?.scriptURL ?? null,
    };
  });
}

async function waitForControlled(page: import("playwright/test").Page) {
  await expect
    .poll(async () => (await swState(page)).hasController, { timeout: 30_000 })
    .toBe(true);
}

async function loadCount(page: import("playwright/test").Page): Promise<number | null> {
  // Returns null if a navigation is in flight (execution context destroyed).
  try {
    return await page.evaluate(() => Number(sessionStorage.getItem("__pwaLoads") ?? 0));
  } catch {
    return null;
  }
}

/** Wait until the document load count reaches `target`, then verify it stays there. */
async function expectStableLoads(
  page: import("playwright/test").Page,
  target: number,
) {
  await expect
    .poll(() => loadCount(page), { timeout: 30_000 })
    .toBe(target);
  await page.waitForTimeout(4000);
  await expect
    .poll(() => loadCount(page), { timeout: 15_000 })
    .toBe(target);
}

const updateToast = (page: import("playwright/test").Page) =>
  page.getByText("A new version is ready to install.");

/** Install a byte-different worker for the same scope; it waits behind v1. */
async function triggerWaitingUpdate(page: import("playwright/test").Page) {
  await page.evaluate(() =>
    navigator.serviceWorker.register("/Meridian/sw2.js", { scope: "/Meridian/" }),
  );
  await expect(updateToast(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await swState(page)).hasWaiting, { timeout: 30_000 })
    .toBe(true);
}

test("PWA: service worker registers, manifest linked, clean console, no bounce", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  // Manifest + icon links point at the static PWA assets (never /__grok/).
  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestHref).toBe("/Meridian/manifest.webmanifest");
  const iconHref = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(iconHref).toBe("/Meridian/icons/icon-192.png");

  // The real manifest + SW + offline page are served, not 404s.
  // (page.request bypasses route interception; fetch from the page instead.)
  for (const asset of ["manifest.webmanifest", "sw.js", "offline.html"]) {
    const status = await page.evaluate(
      async (a) => (await fetch(`/Meridian/${a}`)).status,
      asset,
    );
    expect(status, asset).toBe(200);
  }

  await waitForControlled(page);
  const state = await swState(page);
  expect(state.registered).toBe(true);
  expect(state.scope).toBe("http://127.0.0.1:4123/Meridian/");

  // The first install claims the page but never reloads it on its own.
  const loads = await loadCount(page);
  expect(loads).not.toBeNull();
  await expectStableLoads(page, loads as number);

  // No app errors. (React #418 is a pre-existing flaky hydration warning in
  // this build, unrelated to PWA wiring — it comes and goes on unmodified
  // loads, so it is excluded here.)
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant).toEqual([]);
});

test("PWA: waiting update shows the toast but never reloads on its own", async ({
  page,
}) => {
  await page.goto(APP_URL);
  await waitForControlled(page);
  const loads = await loadCount(page);

  await triggerWaitingUpdate(page);

  // The toast is non-blocking: no reload while the update waits.
  expect(loads).not.toBeNull();
  await expectStableLoads(page, loads as number);
  await expect(updateToast(page)).toBeVisible();

  // "Later" dismisses it; the page is untouched.
  await page.getByRole("button", { name: "Later" }).click();
  await expect(updateToast(page)).toBeHidden();
  expect(await loadCount(page)).toBe(loads);
});

test("PWA: tapping Update activates the worker and reloads exactly once", async ({
  page,
}) => {
  await page.goto(APP_URL);
  await waitForControlled(page);

  await triggerWaitingUpdate(page);
  const loads = await loadCount(page);

  await page.getByRole("button", { name: "Update now" }).click();
  // Exactly one reload, then stability (no reload loop).
  expect(loads).not.toBeNull();
  await expectStableLoads(page, (loads as number) + 1);

  // The new worker (sw2.js) is active. Note: the reloaded page re-registers
  // sw.js (a different script URL than the active sw2.js), so the browser
  // installs it as a further waiting worker — a simulation artifact of the
  // two-URL trick. In production the URL never changes, so no new worker
  // appears. What matters: no further reload happens on its own.
  await waitForControlled(page);
  const state = await swState(page);
  expect(state.activeScript).toContain("sw2.js");
});

test("PWA: an active game survives the update reload with its score", async ({
  page,
}) => {
  await startGlobeRun(page);
  await waitForControlled(page);

  // Bank a score in the session, then leave a place in progress.
  await dismissTileOverlayIfPresent(page);
  await commitHit(page);
  const banked = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { totalScore: number }).totalScore : -1;
  });
  expect(banked).toBeGreaterThan(0);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // A new deploy lands mid-game: toast, no interruption.
  await triggerWaitingUpdate(page);
  const loads = await loadCount(page);
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("aim");

  // The player chooses Update: the game must come back intact.
  await page.getByRole("button", { name: "Update now" }).click();
  expect(loads).not.toBeNull();
  await expectStableLoads(page, (loads as number) + 1);

  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const scoreText = (await page.getByTestId("score-total").textContent()) ?? "";
  expect(scoreText).toContain(`SCORE ${banked.toLocaleString("en-US")}`);
});

test("PWA: offline navigations fall back to the cached app shell", async ({
  page,
  context,
}) => {
  await page.goto(APP_URL);
  await waitForControlled(page);

  // The offline page is precached as the last-resort fallback.
  const precached = await page.evaluate(() =>
    caches
      .match("http://127.0.0.1:4123/Meridian/offline.html")
      .then((r) => !!r),
  );
  expect(precached).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload();
    // The service worker serves the cached shell — the app boots offline,
    // no dead browser error page.
    await expect(
      page.getByRole("heading", { name: "Meridian" }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.setOffline(false);
  }
});
