import { expect, type BrowserContext, type Page } from "playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Shared E2E helpers for the P0-02/P0-03 suite.
 *
 * Serving model: the built Pages artifact (dist/client) is fulfilled from
 * disk for every app URL while the page keeps the production base URL
 * http://127.0.0.1:4123/Meridian/. See playwright.config.ts for why the
 * loopback preview server cannot be reached directly from Chromium 152 in
 * this VM. The served bytes are the identical files `npm run build:pages`
 * produced.
 *
 * Imagery tiles: server.arcgisonline.com is unreachable from this VM (TCP
 * connects time out 100% — measured 2026-09-30; other hosts work), so tile
 * requests are fulfilled with a 1x1 PNG stub. This restores the nominal
 * "network works" condition: it does not change any app behavior, it only
 * lets MapLibre's style "load" event fire so the intro camera beats run.
 * Every zoom-space assertion measures camera/projection/announcement/pin
 * state — tile pixels are irrelevant to all of them — and the tile
 * loading/failure UX itself is covered by the 41 unit tests in
 * src/map/tile-status.test.ts, not by these specs. If real tile egress
 * returns, delete the stub and the pass-through below suffices.
 */

// NOTE (F2 worktree): the parent clone hardcodes its own dist path here; this
// worktree resolves relative to the repo root it runs from so E2E tests the
// worktree's own build, never a sibling's stale artifact.
const DIST = path.resolve("dist/client");
const BASE = "/Meridian/";
export const EVIDENCE = "/home/hatch/workspace/meridian-review/evidence";
export const RUN_KEY = "meridian.run";

// 1x1 fully-transparent PNG (base64) — tile stub, see the header comment.
// (The previous bytes decoded to semi-transparent GREEN, not transparent;
// regenerated 2026-09-30 so the stub matches its documented intent.)
const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
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
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

export async function serveBuiltArtifact(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      // Tile stub — VM-egress compensation, see the header comment.
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
    // Clamp to the dist dir: a crafted pathname like /../../etc/passwd must
    // 403, not serve files outside the built artifact.
    const file = path.normalize(path.join(DIST, p));
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
}

/** Effectively disables the idle watchdog for tests that cover other behavior. */
export const NO_IDLE = 3_600_000;

/** Load the built app, start a globe run, wait for the aim phase + map.
 *  `idleMs` forwards `?idle-ms=` (see session.ts). It defaults to an hour:
 *  on the slow harness the map/chunk startup alone can outlast the real
 *  2-minute timeout, so only the idle-timeout specs opt into short values. */
export async function startGlobeRun(page: Page, idleMs: number = NO_IDLE): Promise<void> {
  const url =
    idleMs && idleMs > 0
      ? `http://127.0.0.1:4123/Meridian/?idle-ms=${idleMs}`
      : "http://127.0.0.1:4123/Meridian/";
  await page.goto(url);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // The map's zoomend handler writes Math.round(getZoom()) into data-zoom,
  // so the initial 1.5 settles to "2" once the first zoomend fires. Wait for
  // the value to stabilize rather than asserting an exact racy value. The
  // generous timeout/gap tolerate very slow software rendering where the
  // intro dive can take many seconds.
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

/**
 * The map's 15 s tile-load watchdog can fire on very slow machines (first
 * idle arrives after the budget), raising the full-screen "Couldn't load
 * satellite imagery" overlay. That overlay swallows map clicks, so before
 * any map interaction, dismiss it via its Retry button — exactly what a
 * user on a flaky connection would do. No-op when the overlay is absent.
 */
export async function dismissTileOverlayIfPresent(page: Page): Promise<void> {
  const overlay = page.getByText("Couldn't load satellite imagery");
  if (await overlay.isVisible()) {
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(overlay).toBeHidden({ timeout: 10_000 });
  }
}

export async function readPhase(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { phase: string }).phase : null;
  }, RUN_KEY);
}

export async function readRun(page: Page): Promise<{
  phase: string; hits: number; index: number; placeId: string | null;
}> {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), RUN_KEY);
}

/** Number of MapLibre pin markers currently on the map. */
export const pinCount = (page: Page): Promise<number> =>
  page.locator(".maplibregl-marker").count();

export const dropButton = (page: Page) =>
  page.getByRole("button", { name: "Drop pin and lock in your guess" });

export async function aimMarkerCenter(page: Page): Promise<{ x: number; y: number } | null> {
  const box = await page.getByLabel("Your pin").boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

export async function spotMarkerCenter(page: Page): Promise<{ x: number; y: number } | null> {
  const box = await page.getByLabel("The spot").boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

/**
 * Screen point of Oia (deterministic first globe target: lon 25.376, lat
 * 36.461) at the initial camera (center [0,0], zoom 1.5). Computed with the
 * app's own MapLibre GlobeTransform projection (maplibre-gl, same version
 * as the bundle): project2.mjs in the QA work dir. Sanity-checked: the
 * viewport center projects to (0,0) exactly, and projecting back is the
 * transform's own inverse.
 */
export const OIA_DESKTOP = { x: 795.9, y: 319.1 }; // 1440x900
export const OIA_MOBILE = { x: 270.7, y: 291.5 }; // 390x844

/** The tap point IS the answer: no lift, no pre-compensation. */

export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
  });
}

export async function focusedRole(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("role"));
}

/** Press Tab until `done()` is true (or maxPresses hit); returns focused name. */
export async function tabUntil(
  page: Page,
  done: () => Promise<boolean>,
  maxPresses = 8,
): Promise<string> {
  for (let i = 0; i < maxPresses; i++) {
    if (await done()) break;
    await page.keyboard.press("Tab");
  }
  return focusedName(page);
}

/**
 * Pin the puzzle calendar to 2026-09-29 (UTC) for Oia-dependent scenarios.
 *
 * The globe place order is date-shuffled (orderPlaces in trail.ts), so the
 * first globe place rotates daily — the OIA_* tap points only land a hit
 * when Oia is the day's first place (true on 2026-09-29). This installs an
 * init script that freezes the page's Date (no-arg construction and
 * Date.now()) to that day. Timers, requestAnimationFrame, and
 * performance.now() are untouched, so animations and timeouts behave
 * normally. Production date logic is unit-tested (daily/trail tests); the
 * freeze only makes the E2E puzzle deterministic.
 *
 * MUST be called before startGlobeRun — addInitScript only affects
 * navigations that happen after it is installed.
 */
export async function freezeOiaPuzzle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const FIXED = Date.UTC(2026, 8, 29, 12, 0, 0);
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args: never[]) {
        if (args.length === 0) {
          super(FIXED);
        } else {
          super(...(args as unknown as ConstructorParameters<DateConstructor>));
        }
      }
      static now(): number {
        return FIXED;
      }
    }
    window.Date = FrozenDate as unknown as DateConstructor;
  });
}

export async function evidencePath(name: string): Promise<string> {  await mkdir(EVIDENCE, { recursive: true });
  return `${EVIDENCE}/${name}`;
}

/**
 * Perceptual diff of two PNG screenshots, computed in-page (no new npm
 * packages). Returns the fraction of pixels whose summed RGB delta exceeds
 * the threshold.
 */
export async function screenshotDiffRatio(
  page: Page,
  aPath: string,
  bPath: string,
): Promise<{ ratio: number; width: number; height: number }> {
  const [a, b] = await Promise.all([readFile(aPath), readFile(bPath)]);
  return page.evaluate(
    async ({ a64, b64 }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a64), load(b64)]);
      const w = Math.min(ia.naturalWidth, ib.naturalWidth);
      const h = Math.min(ia.naturalHeight, ib.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(ia, 0, 0, w, h);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.drawImage(ib, 0, 0, w, h);
      const db = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d =
          Math.abs(da[i] - db[i]) +
          Math.abs(da[i + 1] - db[i + 1]) +
          Math.abs(da[i + 2] - db[i + 2]);
        if (d > 48) diff++;
      }
      return { ratio: diff / (w * h), width: w, height: h };
    },
    {
      a64: `data:image/png;base64,${a.toString("base64")}`,
      b64: `data:image/png;base64,${b.toString("base64")}`,
    },
  );
}

/**
 * Shared commit helpers for the reveal specs (moved here from
 * gap-view-reveal.desktop.spec.ts so the hit-path specs share one
 * implementation instead of drifting copies).
 */

/** Commit a pin at (x, y); resolves with the landed phase and commit time. */
export async function commitPin(
  page: Page,
  x: number,
  y: number,
): Promise<{ phase: string | null; committedAt: number }> {
  // The tile watchdog can fire on slow machines, and the reveal only plays
  // over healthy tiles (tile failure shows the card at once). Dismiss the
  // overlay as a user would, then wait for tiles to be ready.
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  await page.mouse.click(x, y);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  const committedAt = Date.now();
  // Capture the phase inside the poll: a separate readPhase after the poll
  // can race the transition it just observed.
  let phase: string | null = null;
  await expect
    .poll(
      async () => {
        phase = await readPhase(page);
        return phase;
      },
      { timeout: 20_000 },
    )
    .toMatch(/^(story|done)$/);
  return { phase, committedAt };
}

/** Viewport coords of the current place's true spot, or null when the spot
 *  is unknown. Uses the app's own live projection (no luck involved).
 *  Rounded to integers: Playwright's synthetic mouse with fractional
 *  coordinates does not reliably trip the app's pointer tap classifier
 *  (observed in this harness; physical-device verification remains open). */
export async function spotViewportPoint(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  return page.locator(".satellite-map").evaluate((el) => {
    const hook = (
      el as unknown as {
        __spotScreen?: () => { x: number; y: number } | null;
      }
    ).__spotScreen;
    const s = hook?.();
    if (!s) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
  });
}

/** True when a tap at (x, y) would hit the map canvas (not chrome like the
 *  question bubble floating over it). */
export async function tapHitsMap(
  page: Page,
  x: number,
  y: number,
): Promise<boolean> {
  return page.evaluate(
    ({ px, py }) => {
      const el = document.elementFromPoint(px, py);
      return !!el?.closest?.(".satellite-map");
    },
    { px: x, py: y },
  );
}

export const nextPlaceButton = (page: Page) =>
  page.getByRole("button", { name: "Next place" });

/** The result card is a scrollable sheet (max-h-45dvh); pre-scroll the
 *  button with instant behavior because Chromium's scrollIntoViewIfNeeded
 *  (which Playwright's click uses) is pathologically slow inside this
 *  MapLibre layout. Real users scroll the sheet by touch/wheel, so this
 *  masks no production behavior. */
export async function clickNextPlace(page: Page): Promise<void> {
  const btn = nextPlaceButton(page);
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await btn.click();
}

export const resultCard = (page: Page) =>
  page.getByRole("region", { name: "Result" });

/**
 * Commit a guaranteed miss: tap (500, 400); on the ~1% chance it lands
 * inside the 750 km hit radius, advance and retry.
 */
export async function commitMiss(
  page: Page,
): Promise<{ committedAt: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { phase, committedAt } = await commitPin(page, 500, 400);
    if (phase === "done") return { committedAt };
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMiss: (500, 400) hit three places in a row");
}

/**
 * Commit a guaranteed hit: tap the true spot's exact screen point. When the
 * spot is on the far side of the globe (or under chrome), burn the place
 * with a miss and advance.
 */
export async function commitHit(
  page: Page,
): Promise<{ committedAt: number }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const spot = await spotViewportPoint(page);
    const inView =
      spot &&
      spot.x >= 0 &&
      spot.x <= 1440 &&
      spot.y >= 0 &&
      spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      const { phase, committedAt } = await commitPin(page, spot.x, spot.y);
      if (phase === "story") return { committedAt };
      // Tapped the projected spot but missed: the spot is on the globe's
      // far side (project() returns a viewport point even for occluded
      // locations). Burn this place and try the next.
    } else {
      // Spot not tappable: burn this place with a miss, move on.
      await commitMiss(page);
    }
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitHit: no tappable spot in 10 attempts");
}
