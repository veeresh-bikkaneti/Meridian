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
 * requests are fulfilled with a 256x256 PNG stub. This restores the nominal
 * "network works" condition: it does not change any app behavior, it only
 * lets MapLibre's style "load" event fire so the intro camera beats run.
 * Every zoom-space assertion measures camera/projection/announcement/pin
 * state — tile pixels are irrelevant to all of them — and the tile
 * loading/failure UX itself is covered by the 13 unit tests in
 * src/map/tile-status.test.ts, not by these specs. If real tile egress
 * returns, delete the stub and the pass-through below suffices.
 */

// Repo-relative: the built Pages artifact this branch produced via `npm run build:pages`.
const DIST = path.join(import.meta.dirname, "..", "..", "dist", "client");
const BASE = "/Meridian/";
export const EVIDENCE = "/home/hatch/workspace/meridian-review/evidence";
export const RUN_KEY = "meridian.run";

// 256x256 PNG (base64) — tile stub, see the header comment. Sized to the
// source's declared tileSize (256) rather than a 1x1 pixel.
const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACwElEQVR4nO3TIQEAIADAMEARhQD0z0YMxLcEN5/73AFV63cA/GQA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQ9otwCZMlETM0AAAAASUVORK5CYII=",
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

/** Load the built app, start a globe run, wait for the aim phase + map. */
export async function startGlobeRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
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
