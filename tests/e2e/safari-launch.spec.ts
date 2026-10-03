import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  dropButton,
  tapHitsMap,
} from "./helpers";

/**
 * P0 Safari launch-outage fix E2E (built Pages artifact, base /Meridian/).
 *
 * (a) Menu boots light: the satellite-map chunk (maplibre-gl + atlas
 *     payloads) is a separate file that is NOT requested during menu boot,
 *     and the total boot JS is far below the pre-split 2.57 MB.
 * (b) Starting a run lazy-loads the map chunk and the game works
 *     end-to-end (drop a pin, reveal, result card).
 * (c) `?nosw=1`: the inline hatch unregisters the SW, deletes meridian-*
 *     caches, strips the param, records the cleanup in sessionStorage, and
 *     reloads exactly once — the app then boots cleanly.
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";
// Effectively disable the 2-minute idle watchdog (see helpers.NO_IDLE):
// the lazy chunk + tile waits can push a slow-VM run near the budget.
const APP_URL_NO_IDLE = `${APP_URL}?idle-ms=3600000`;
// Pre-split boot JS: 433,613 (index) + 2,140,683 (routes) = 2,574,296 B.
// Post-split: ~1.40 MB. The ceiling leaves generous headroom for growth
// while failing loudly if maplibre ever leaks back into the boot chunk.
const BOOT_JS_BYTES_CEILING = 1_800_000;

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** JS chunk requests under /Meridian/assets/ seen so far (URL + bytes). */
function trackChunkRequests(page: Page): { url: string; bytes: number }[] {
  const seen: { url: string; bytes: number }[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/Meridian/assets/") || !url.endsWith(".js")) return;
    try {
      const body = await res.body();
      seen.push({ url, bytes: body.length });
    } catch {
      // Response gone (navigated away); ignore.
    }
  });
  return seen;
}

const mapChunkRequested = (seen: { url: string }[]) =>
  seen.some((r) => /satellite-map/i.test(r.url));

test("menu boots without the satellite-map chunk and under the boot-JS ceiling", async ({
  page,
}) => {
  const seen = trackChunkRequests(page);
  await page.goto(APP_URL_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible();
  // Let any deferred boot requests settle.
  await page.waitForTimeout(1500);

  expect(
    mapChunkRequested(seen),
    "the satellite-map chunk must not load during menu boot",
  ).toBe(false);

  const bootFiles = seen.map((r) => r.url.split("/").pop());
  expect(bootFiles.length).toBeGreaterThan(0);
  const totalBytes = seen.reduce((sum, r) => sum + r.bytes, 0);
  expect(totalBytes).toBeLessThan(BOOT_JS_BYTES_CEILING);
});

test("starting a run lazy-loads the map chunk; pin drop + reveal work", async ({
  page,
}) => {
  const seen = trackChunkRequests(page);
  await page.goto(APP_URL_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible();
  expect(mapChunkRequested(seen)).toBe(false);

  await page.getByRole("button", { name: "Play the globe" }).click();
  // The map chunk is fetched only now, on run start.
  await expect
    .poll(() => mapChunkRequested(seen), { timeout: 20_000 })
    .toBe(true);

  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  // Full game loop: drop a pin, reveal, result card. This deliberately does
  // NOT wait for tile-status "ready": the 15 s tile watchdog is a known
  // flake under VM CPU contention (tiles are stubbed; pixels are irrelevant
  // to the game loop), and the tile overlay's root is pointer-events-none
  // outside its card, so the map stays tappable regardless. Dismiss the card
  // if it is up, then tap clear of it (bottom-left, away from chrome).
  await dismissTileOverlayIfPresent(page);
  const tap = { x: 200, y: 700 };
  expect(await tapHitsMap(page, tap.x, tap.y)).toBe(true);
  await page.mouse.click(tap.x, tap.y);
  await expect(dropButton(page)).toBeEnabled({ timeout: 10_000 });
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toMatch(/^(story|done)$/);
  await expect(
    page.getByRole("button", { name: "Next place" }),
  ).toBeVisible({ timeout: 20_000 });
});

test("?nosw=1 unregisters the SW, purges meridian-* caches, strips the param", async ({
  page,
}) => {
  // Seed the stuck-client state: a registered SW and a meridian-* cache.
  await page.goto(APP_URL_NO_IDLE);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          navigator.serviceWorker.getRegistration().then((r) => !!r),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.evaluate(async () => {
    await caches.open("meridian-test-seed");
    await caches.open("other-cache");
  });

  await page.goto(`${APP_URL}?nosw=1`);
  // The hatch strips the param via replaceState and reloads exactly once.
  await expect
    .poll(() => page.url(), { timeout: 15_000 })
    .not.toContain("nosw");
  expect(new URL(page.url()).pathname).toBe("/Meridian/");

  // The hatch recorded what it cleaned (observable even though the app
  // re-registers its worker on the clean reload).
  const marker = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("meridian.noswHatch") ?? "null"),
  );
  expect(marker?.ran).toBe(true);
  expect(marker.swUnregistered).toBeGreaterThanOrEqual(1);
  expect(marker.cachesDeleted).toContain("meridian-test-seed");
  expect(marker.cachesDeleted).not.toContain("other-cache");

  // The app boots cleanly after the hatch.
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toBeVisible();
});
