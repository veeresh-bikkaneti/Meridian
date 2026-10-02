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
 * - Service worker registers on load with a clean console.
 * - A waiting update shows the non-blocking "Update available" toast;
 *   nothing reloads on its own.
 * - Tapping Update activates the waiting worker and reloads exactly once;
 *   an active game (run + session score) survives the reload.
 * - Offline: navigations fall back to the precached offline page.
 *
 * Update simulation: the spec overrides the **\/sw.js route AFTER
 * serveBuiltArtifact (last-registered route wins) and serves a
 * byte-different worker (VERSION bump) to trigger the update flow.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const DIST = path.resolve("dist/client");
const APP_URL = "http://127.0.0.1:4123/Meridian/";

async function swSource(): Promise<string> {
  return readFile(path.join(DIST, "sw.js"), "utf8");
}

/** Serve sw.js with a controllable VERSION; bump to simulate a new deploy. */
async function serveVersionedSw(
  context: import("playwright/test").BrowserContext,
  getVersion: () => string,
) {
  const base = await swSource();
  await context.route("**/sw.js", async (route) => {
    const body = base.replace("meridian-v1", `meridian-${getVersion()}`);
    await route.fulfill({
      status: 200,
      body,
      contentType: "text/javascript; charset=utf-8",
    });
  });
}

async function swState(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      registered: !!reg,
      scope: reg?.scope ?? null,
      hasController: !!navigator.serviceWorker.controller,
      hasWaiting: !!reg?.waiting,
      activeState: reg?.active?.state ?? null,
    };
  });
}

async function waitForControlled(page: import("playwright/test").Page) {
  await expect
    .poll(async () => (await swState(page)).hasController, { timeout: 30_000 })
    .toBe(true);
}

const updateToast = (page: import("playwright/test").Page) =>
  page.getByText("A new version of Meridian is available.");

test("PWA: service worker registers, manifest linked, clean console", async ({
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
  for (const asset of ["manifest.webmanifest", "sw.js", "offline.html"]) {
    const res = await page.request.get(`${APP_URL}${asset}`);
    expect(res.status(), asset).toBe(200);
  }

  await waitForControlled(page);
  const state = await swState(page);
  expect(state.registered).toBe(true);
  expect(state.scope).toBe("http://127.0.0.1:4123/Meridian/");
  expect(errors).toEqual([]);
});

test("PWA: waiting update shows the toast but never reloads on its own", async ({
  page,
  context,
}) => {
  let version = "v1";
  await serveVersionedSw(context, () => version);
  await page.goto(APP_URL);
  await waitForControlled(page);

  // Mark the page: if it reloads on its own, the marker disappears.
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__pwaMarker = "alive";
  });

  // Simulate a new deploy: byte-different worker → installs → waits.
  version = "v2";
  await page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((r) => r?.update()),
  );
  await expect(updateToast(page)).toBeVisible({ timeout: 30_000 });

  // The toast is non-blocking: Later dismisses it, the game is untouched.
  await expect
    .poll(async () => (await swState(page)).hasWaiting, { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwaMarker)).toBe(
    "alive",
  );

  await page.getByRole("button", { name: "Later" }).click();
  await expect(updateToast(page)).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwaMarker)).toBe(
    "alive",
  );
});

test("PWA: tapping Update activates the worker and reloads exactly once", async ({
  page,
  context,
}) => {
  let version = "v1";
  await serveVersionedSw(context, () => version);
  await page.goto(APP_URL);
  await waitForControlled(page);

  version = "v2";
  await page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((r) => r?.update()),
  );
  await expect(updateToast(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await swState(page)).hasWaiting, { timeout: 30_000 })
    .toBe(true);

  // Clicking Update posts SKIP_WAITING; controllerchange reloads once.
  await Promise.all([
    page.waitForEvent("load", { timeout: 30_000 }),
    page.getByRole("button", { name: "Update" }).click(),
  ]);
  // After the reload the new worker controls the page and nothing is waiting.
  await waitForControlled(page);
  const state = await swState(page);
  expect(state.hasWaiting).toBe(false);
  await expect(updateToast(page)).toBeHidden();
});

test("PWA: an active game survives the update reload with its score", async ({
  page,
  context,
}) => {
  let version = "v1";
  await serveVersionedSw(context, () => version);
  await startGlobeRun(page);

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

  // New deploy lands while the game is active.
  version = "v2";
  await page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((r) => r?.update()),
  );
  await expect(updateToast(page)).toBeVisible({ timeout: 30_000 });

  // The player chooses Update: the game must come back intact.
  await Promise.all([
    page.waitForEvent("load", { timeout: 30_000 }),
    page.getByRole("button", { name: "Update" }).click(),
  ]);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const scoreText = (await page.getByTestId("score-total").textContent()) ?? "";
  expect(scoreText).toContain(`SCORE ${banked.toLocaleString("en-US")}`);
});

test("PWA: offline navigations fall back to the offline page", async ({
  page,
  context,
}) => {
  await page.goto(APP_URL);
  await waitForControlled(page);

  // The offline page must be precached for the fallback to work.
  const precached = await page.evaluate(() =>
    caches
      .match("http://127.0.0.1:4123/Meridian/offline.html")
      .then((r) => !!r),
  );
  expect(precached).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "You're offline" }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.setOffline(false);
  }
});
