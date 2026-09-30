/**
 * F1 — pinch-zoom gesture verification across the mode × projection matrix.
 *
 * What this covers (both directions, full range — per Veeresh 2026-09-30):
 * - Two-finger pinch OUT (spread) zooms in; pinch IN (together) zooms out —
 *   in state, country, and globe editions, at a mobile viewport with touch.
 * - The "Zoom in" / "Zoom out" controls step the zoom ±1 level in every edition.
 * - Pinch zoom-in keeps working at high zoom (driven there via the control).
 *
 * F2 coordination: F2's progressive boundary reveal keys off zoom bands, so
 * this spec (and F1 as a whole) changes NO zoom thresholds — the zoom value
 * stays one continuous signal and the band transitions remain F2's code.
 *
 * How the pinch is synthesized: Chromium's CDP `Input.synthesizePinchGesture`
 * does NOT produce touch input — it dispatches wheel events, which exercise
 * MapLibre's scrollZoom, not the touchZoomRotate pinch path (verified
 * 2026-09-30: zero touchstart/touchmove/touchend reached the canvas).
 * So this spec dispatches real TouchEvents (touchstart → touchmove × N →
 * touchend) on the map canvas, which is what a physical two-finger gesture
 * produces. MapLibre's TwoFingersTouchZoomHandler turns a finger-spread
 * ratio r into log2(r) zoom (so the 3× spread here yields ~+1.5 levels),
 * and the map writes Math.round(getZoom()) into the wrapper's data-zoom
 * on zoomend — so the assertions below read data-zoom and expect at least
 * a ±1 rounded step per gesture direction.
 *
 * Target: the BUILT Pages artifact (dist/client, base path /Meridian/).
 * Tile stubbing: server.arcgisonline.com is unreachable from this VM, so
 * tile requests are fulfilled with a 1×1 PNG stub — camera/projection/
 * announcement assertions are unaffected (tile pixels are irrelevant).
 */
import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Resolved from the repo root (Playwright's cwd) so the spec works on any
// checkout, not just the worktree it was written in.
const DIST = path.resolve("dist/client");
const BASE = "/Meridian/";

// Timeouts (ms) and gesture geometry, named in one place.
const MENU_TIMEOUT = 15_000;
const CANVAS_TIMEOUT = 20_000;
const SETTLE_TIMEOUT = 45_000;
const ANNOUNCE_TIMEOUT = 20_000;
const POLL_TIMEOUT = 10_000;
/** Half-spread in px: 30→90 is a 3× ratio ≈ +1.5 zoom levels. */
const PINCH_HALF_FROM = 30;
const PINCH_HALF_TO = 90;
const PINCH_MOVES = 10;

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      return route.fulfill({
        status: 200,
        body: TILE_STUB,
        contentType: "image/png",
      });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return route.continue();
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
    else if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (p.endsWith("/")) p += "_shell.html";
    // Defense-in-depth: contain served files under DIST even though only the
    // test's own browser context can issue requests here (never copy this
    // handler into a real static-file server without this check).
    const file = path.resolve(DIST, p.replace(/^\/+/, ""));
    if (!file.startsWith(DIST + path.sep) && file !== DIST) {
      return route.fulfill({ status: 403, body: "forbidden" });
    }
    try {
      const body = await readFile(file);
      const ext = path.extname(file).toLowerCase();
      return route.fulfill({
        status: 200,
        body,
        contentType: MIME[ext] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
});

const mapEl = (page) => page.locator(".satellite-map");
const readZoom = async (page) =>
  Number(await mapEl(page).getAttribute("data-zoom"));

async function startRun(page, edition: "state" | "country" | "globe", region: string | null) {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page
    .getByRole("button", { name: "Choose a state" })
    .waitFor({ state: "visible", timeout: MENU_TIMEOUT });
  if (edition === "globe") {
    await page.getByRole("button", { name: "Play the globe" }).click();
  } else {
    await page
      .getByRole("button", {
        name: edition === "state" ? "Choose a state" : "Choose a country",
      })
      .click();
    await page.getByRole("button", { name: region! }).click();
  }
  await page.locator(".maplibregl-canvas").waitFor({ timeout: CANVAS_TIMEOUT });
}

/** Wait for the intro beat to release the map and announce the settled view. */
async function waitSettle(page, announcement: string) {
  await expect
    .poll(() => mapEl(page).getAttribute("aria-hidden"), {
      timeout: SETTLE_TIMEOUT,
    })
    .not.toBe("true");
  await expect
    .poll(
      async () =>
        (
          await page.locator('.satellite-map > [aria-live="polite"]').textContent()
        )?.trim(),
      { timeout: ANNOUNCE_TIMEOUT },
    )
    .toBe(announcement);
  // Let any trailing camera easing finish so data-zoom is stable.
  await expect.poll(() => readZoom(page), { timeout: ANNOUNCE_TIMEOUT }).not.toBeNaN();
  await page.waitForTimeout(1000);
}

/**
 * Dispatch a real two-finger pinch on the map canvas.
 * direction "out": fingers spread 60px → 180px apart (zoom ≈ +1.5).
 * direction "in":  fingers close 180px → 60px apart (zoom ≈ −1.5).
 *
 * The 3× spread ratio yields ~1.5 zoom levels — comfortably more than one
 * rounded data-zoom step even after MapLibre's pinch-start threshold eats
 * the first move or two. (A 2× ratio nets only ~0.9 after threshold loss,
 * and Math.round can swallow a sub-1.0 delta entirely, leaving data-zoom
 * unchanged.)
 */
async function pinch(page, direction: "out" | "in") {
  // Real-device guard: synthetic TouchEvents bypass the browser's
  // touch-action enforcement, so a missing handler class would pass this
  // test while a real device swallowed the pinch natively. Assert the
  // computed touch-action the handler arming produces before gesturing.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          getComputedStyle(
            document.querySelector(".maplibregl-canvas")!,
          ).touchAction,
        ),
      { timeout: POLL_TIMEOUT },
    )
    .toBe("none");
  await page.evaluate(
    ({ dir, halfFrom, halfTo, moves }) => {
      const canvas = document.querySelector(
        ".maplibregl-canvas",
      ) as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const mk = (id: number, x: number, y: number) =>
        new Touch({ identifier: id, target: canvas, clientX: x, clientY: y });
      const fire = (
        type: string,
        touches: Touch[],
        changed: Touch[],
      ) =>
        canvas.dispatchEvent(
          new TouchEvent(type, {
            touches,
            targetTouches: touches,
            changedTouches: changed,
            bubbles: true,
            cancelable: true,
          }),
        );
      const spread = (half: number): [Touch, Touch] => [
        mk(1, cx - half, cy),
        mk(2, cx + half, cy),
      ];
      const [from, to] = dir === "out" ? [halfFrom, halfTo] : [halfTo, halfFrom];
      const start = spread(from);
      fire("touchstart", start, start);
      // Incremental moves keep every frame's delta small, like a real
      // gesture, and give the handler's zoom-threshold logic room to engage.
      for (let i = 1; i <= moves; i++) {
        const half = from + ((to - from) * i) / moves;
        const pts = spread(half);
        fire("touchmove", pts, pts);
      }
      fire("touchend", [], start);
    },
    {
      dir: direction,
      halfFrom: PINCH_HALF_FROM,
      halfTo: PINCH_HALF_TO,
      moves: PINCH_MOVES,
    },
  );
  // touchZoom applies synchronously per move; zoomend → data-zoom follows.
  await expect
    .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
    .not.toBeNaN();
  await page.waitForTimeout(400);
}

const MODES = [
  // zoomIns drives the high-zoom test below. Globe's range is tighter
  // (maxZoom 5, settle ~1.5) so one press suffices; the flat editions settle
  // near 4.5 with headroom, so two presses exercise deeper zoom.
  //
  // Region-choice constraint: the zoom-space T_OUT transition fires on
  // zoomend when a zoom-OUT ends below 2.2, so a large region settling below
  // 2.2 (e.g. USA ≈ z1.8–2.05) could legitimately trigger a projection swap
  // mid-test. Nebraska/France settle well above it, keeping these tests
  // deterministic; don't swap in a larger region without accounting for that.
  { edition: "state", region: "Nebraska", settle: "Nebraska view", zoomIns: 2 },
  { edition: "country", region: "France", settle: "France view", zoomIns: 2 },
  { edition: "globe", region: null, settle: "Globe view", zoomIns: 1 },
] as const;

for (const mode of MODES) {
  test(`${mode.edition}: pinch out zooms in one level, pinch in zooms out one level`, async ({
    page,
  }) => {
    await startRun(page, mode.edition, mode.region);
    await waitSettle(page, mode.settle);
    const z0 = await readZoom(page);

    await pinch(page, "out");
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBeGreaterThanOrEqual(z0 + 1);
    const zOut = await readZoom(page);

    await pinch(page, "in");
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBeLessThanOrEqual(zOut - 1);
  });

  test(`${mode.edition}: Zoom out control lowers zoom one level`, async ({
    page,
  }) => {
    await startRun(page, mode.edition, mode.region);
    await waitSettle(page, mode.settle);
    const z0 = await readZoom(page);

    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBe(z0 - 1);
  });

  test(`${mode.edition}: Zoom in control raises zoom one level`, async ({
    page,
  }) => {
    await startRun(page, mode.edition, mode.region);
    await waitSettle(page, mode.settle);
    const z0 = await readZoom(page);

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBe(z0 + 1);
  });

  // Full-range: pinch must keep working when already zoomed in close.
  // (The low end is covered by the main pinch-in test, which drives zoom one
  // level back down. F2's progressive boundary bands key off the same
  // continuous zoom value, so F1 changes no thresholds.)
  test(`${mode.edition}: pinch zoom-in works at high zoom`, async ({
    page,
  }) => {
    await startRun(page, mode.edition, mode.region);
    await waitSettle(page, mode.settle);
    const z0 = await readZoom(page);
    for (let i = 0; i < mode.zoomIns; i++) {
      await page.getByRole("button", { name: "Zoom in" }).click();
    }
    // Poll for the driven zoom instead of sleeping: a stale-low zHigh would
    // only weaken the final assertion.
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBe(z0 + mode.zoomIns);
    const zHigh = await readZoom(page);
    await pinch(page, "out");
    await expect
      .poll(() => readZoom(page), { timeout: POLL_TIMEOUT })
      .toBeGreaterThanOrEqual(zHigh + 1);
  });
}
