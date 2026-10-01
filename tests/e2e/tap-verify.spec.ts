import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * F5: tap preview / lock-in verification (touch, mobile viewport).
 *
 * Locked semantics (Veeresh): single tap shows a MOVABLE PREVIEW pin and
 * never records an answer; double-tap LOCKS IN (commits the answer) at the
 * exact tap point. The preview pin is hollow/ghosted ("Preview pin") while
 * the committed pin is solid ("Your pin") so draft vs locked-in is
 * unmistakable.
 *
 * Self-contained by design: the shared tests/e2e/helpers.ts is untracked
 * (absent from origin/main), so this spec inlines the small subset it needs
 * (artifact serving, tile stub, session-storage reads) instead of importing
 * it. DIST is resolved relative to this file so the spec works from any
 * checkout or worktree.
 */

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "client");
const BASE = "/Meridian/";
const RUN_KEY = "meridian.run";

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveBuiltArtifact(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      return route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return route.continue();
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
    else if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (p.endsWith("/")) p += "_shell.html";
    try {
      const body = await readFile(path.join(DIST, p));
      return route.fulfill({
        status: 200,
        body,
        contentType: MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
}

async function readPhase(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { phase: string }).phase : null;
  }, RUN_KEY);
}

async function readResultsLength(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const run = raw ? (JSON.parse(raw) as { results?: unknown[] }) : null;
    return run?.results?.length ?? 0;
  }, RUN_KEY);
}

/**
 * The tile-failure overlay is production behavior (any tile error before the
 * first idle marks the initial tile set "failed") and its card sits over the
 * map, swallowing taps. Under this VM's load a tile request can transiently
 * fail even with the PNG stub in place. If the overlay is up, hit Retry until
 * it clears so the tap points actually reach the map. Not F5's concern to
 * change the overlay itself.
 */
async function clearTileErrorOverlay(page: Page): Promise<void> {
  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load satellite imagery" });
  for (let i = 0; i < 3; i++) {
    if (!(await alert.isVisible())) return;
    await page.getByRole("button", { name: "Retry" }).click();
    await alert.waitFor({ state: "hidden", timeout: 15_000 });
  }
}

async function startGlobeRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await clearTileErrorOverlay(page);
}

/**
 * Double-tap via synthetic pointer events with an in-page 300ms gap.
 * Same rationale as the tap-precision suite: the app's double-tap window is
 * 500ms, and two real touchscreen.tap() calls drift past it under this VM's
 * CPU load. Both taps dispatch pointerdown/pointerup with pointerType
 * "touch", driving the exact production path (the app never checks
 * isTrusted).
 */
async function touchDoubleTap(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ x, y }) => {
      const mk = (type: string) =>
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerId: 10,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          bubbles: true,
          cancelable: true,
        });
      const tap = () => {
        const el = document.elementFromPoint(x, y) as HTMLElement;
        el.dispatchEvent(mk("pointerdown"));
        el.dispatchEvent(mk("pointerup"));
      };
      tap();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          tap();
          resolve();
        }, 300),
      );
    },
    { x, y },
  );
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("touch: single tap shows a hollow preview pin and records nothing; double-tap commits", async ({
  page,
}) => {
  await startGlobeRun(page);

  // 1. Single tap: preview appears, nothing is recorded.
  // Re-clear the tile overlay immediately before tapping: under this VM's
  // load it can (re-)appear after startGlobeRun, and its card swallows taps.
  await clearTileErrorOverlay(page);
  await page.touchscreen.tap(195, 420);
  const preview = page.getByLabel("Preview pin");
  await expect(preview).toBeVisible();

  // Preview is hollow/ghosted: transparent fill, dashed outline.
  const previewStyle = await preview.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, borderStyle: cs.borderStyle };
  });
  expect(previewStyle.background).toBe("rgba(0, 0, 0, 0)");
  expect(previewStyle.borderStyle).toBe("dashed");

  // No answer recorded: still aiming, zero results.
  expect(await readPhase(page)).toBe("aim");
  expect(await readResultsLength(page)).toBe(0);

  // 2. Tap elsewhere (after the double-tap window): the preview MOVES,
  // still without committing.
  await page.waitForTimeout(700);
  await clearTileErrorOverlay(page);
  await page.touchscreen.tap(120, 300);
  await expect(preview).toBeVisible();
  expect(await readPhase(page)).toBe("aim");
  expect(await readResultsLength(page)).toBe(0);
  expect(await page.locator(".maplibregl-marker").count()).toBe(1);

  // 3. Double-tap at one point: commits the answer at the tap point.
  await clearTileErrorOverlay(page);
  await touchDoubleTap(page, 250, 500);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toMatch(/^(story|done)$/);

  // Exactly one result recorded — the commit, not the earlier taps.
  expect(await readResultsLength(page)).toBe(1);

  // The committed pin is solid ("Your pin"), visually distinct from preview.
  const committed = page.getByLabel("Your pin");
  await expect(committed).toBeVisible();
  const committedStyle = await committed.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, borderStyle: cs.borderStyle };
  });
  expect(committedStyle.background).toBe("rgb(244, 241, 234)");
  expect(committedStyle.borderStyle).toBe("solid");
  // The correct spot is revealed alongside the committed pin.
  await expect(page.getByLabel("The spot")).toBeVisible();
});
