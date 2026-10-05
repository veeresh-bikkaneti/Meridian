import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
} from "./helpers";

/**
 * Educational gap-view reveal under prefers-reduced-motion: no animation,
 * no timers — the miss is a synchronous jump cut to the gap framing and the
 * hit is a synchronous confirmation, so the result card appears immediately
 * on commit in both cases (no ~2.2 s beat).
 *
 * Determinism: the app exposes `__spotScreen()` on the map wrapper (DOM
 * contract, like data-zoom), projecting the current place's true spot to
 * wrapper-relative pixels through the live camera. The hit test taps the
 * exact spot; the miss test taps (500, 400) and retries on the ~1% chance
 * it lands a hit.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/**
 * See gap-view-reveal.desktop.spec.ts: the shared startGlobeRun settle
 * check can return while the globe intro dive is still running on very
 * slow machines (data-zoom sits at "1" until the first zoomend fires, then
 * settles to "2"). Wait for the documented post-dive value before
 * capturing the aim zoom.
 */
async function awaitGlobeDiveDone(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 30_000,
    })
    .toBe("2");
}

type Page = import("playwright/test").Page;

/** Commit a pin at (x, y); resolves with the landed phase. */
async function commitPin(
  page: Page,
  x: number,
  y: number,
): Promise<string | null> {
  await dismissTileOverlayIfPresent(page);
  const map = page.locator(".satellite-map");
  await expect
    .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
    .toBe("ready");
  await page.mouse.click(x, y);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  let phase: string | null = null;
  await expect
    .poll(async () => {
      phase = await readPhase(page);
      return phase;
    }, { timeout: 20_000 })
    .toMatch(/^(story|done)$/);
  return phase;
}

/** Viewport coords of the current place's true spot, or null when unknown.
 *  Rounded to integers: Playwright's synthetic mouse with fractional
 *  coordinates does not reliably trip the app's pointer tap classifier
 *  (observed in this harness; physical-device verification remains open). */
async function spotViewportPoint(
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
async function tapHitsMap(
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

const nextPlaceButton = (page: Page) =>
  page.getByRole("button", { name: "Next place" });

async function clickNextPlace(page: Page): Promise<void> {
  const btn = nextPlaceButton(page);
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await btn.click();
}

/** Commit a guaranteed miss: tap (500, 400); on the ~1% chance it lands a
 *  hit, advance and retry. */
async function commitMiss(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const phase = await commitPin(page, 500, 400);
    if (phase === "done") return;
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMiss: (500, 400) hit three places in a row");
}

/** Commit a guaranteed hit: tap the true spot's exact screen point. When the
 *  spot is on the far side of the globe (or under chrome), burn the place
 *  with a miss and advance. */
async function commitHit(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const spot = await spotViewportPoint(page);
    const inView =
      spot &&
      spot.x >= 0 &&
      spot.x <= 1440 &&
      spot.y >= 0 &&
      spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      const phase = await commitPin(page, spot.x, spot.y);
      if (phase === "story") return;
      // Tapped the projected spot but missed: the spot is on the globe's
      // far side (project() returns a viewport point even for occluded
      // locations). Burn this place and try the next.
    } else {
      await commitMiss(page);
    }
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitHit: no tappable spot in 10 attempts");
}

test("reduced motion: miss is a jump cut — the card appears immediately", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitMiss(page);

  // No animated beat: the card lands promptly (the animated gap-view beat
  // would take ~2.2 s).
  const nextPlace = nextPlaceButton(page);
  await expect(nextPlace).toBeVisible({ timeout: 5_000 });

  // The miss card still carries the educational content.
  const card = page.getByRole("region", { name: "Result" });
  await expect(card.getByTestId("miss-headline")).toHaveText(
    /[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin/,
  );
  await expect(card.getByTestId("miss-subscript")).toContainText(
    "White pin is your guess",
  );
  await expect(card.getByRole("link")).toBeVisible();

  // Continuing jump-cuts back to the region framing.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
});

test("reduced motion: hit is synchronous — the card appears immediately", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const zoomBefore = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  await commitHit(page);

  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  // No camera move on a hit, in any motion mode.
  await expect(
    page.locator(".satellite-map").getAttribute("data-zoom"),
  ).resolves.toBe(zoomBefore);
});
