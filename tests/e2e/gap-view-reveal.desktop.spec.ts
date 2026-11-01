import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
  aimMarkerCenter,
  spotMarkerCenter,
  commitPin,
  commitMiss,
  commitHit,
  spotViewportPoint,
  tapHitsMap,
  nextPlaceButton,
  clickNextPlace,
  resultCard,
} from "./helpers";

/**
 * Educational gap-view reveal (desktop, animated).
 *
 * - Miss: one ease to the pin+spot framing (the gap view). The result card
 *   normally appears only when the beat completes (~2.2 s) — a near-miss
 *   no-op fit or tile-failure path can show it sooner — and leads with the
 *   miss distance, a 2-line explanatory subscript, the place story, and the
 *   source.
 * - Hit: light confirmation — no camera move; the card appears promptly.
 * - A tap on the map canvas during the miss beat skips to the end state.
 *
 * Determinism: the app exposes `__spotScreen()` on the map wrapper (DOM
 * contract, like data-zoom), projecting the current place's true spot to
 * wrapper-relative pixels through the live camera. The hit test taps the
 * exact spot; the miss tests tap (500, 400) and retry on the ~1% chance it
 * lands a hit.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/**
 * The shared startGlobeRun settle check (data-zoom stable across 800 ms)
 * can return while the globe intro dive is still running on very slow
 * machines: data-zoom sits at "1" until the first zoomend fires, then
 * settles to "2" (the documented post-dive value — see helpers.ts). Tests
 * that capture the aim zoom must wait for the dive to actually finish,
 * otherwise they snapshot the transient "1" and fail later. This completes
 * the wait the helper intends; it changes no app behavior.
 */
async function awaitGlobeDiveDone(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 30_000,
    })
    .toBe("2");
}


test("miss: the gap view frames pin + spot; card leads with distance, subscript, story, source", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const aimZoom = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  const { committedAt } = await commitMiss(page);

  const nextPlace = nextPlaceButton(page);
  // The card waits for the gap-view beat's end state (~2.2 s ease) — it must
  // not appear instantly on commit. Exception: if tiles fail mid-reveal the
  // beat is skipped by design and the card shows at once; that is not a
  // product bug, so distinguish it via the tile status.
  await expect(nextPlace).toBeVisible({ timeout: 15_000 });
  const cardDelayMs = Date.now() - committedAt;
  if (cardDelayMs < 1500) {
    const tileStatus = await page
      .locator(".satellite-map")
      .getAttribute("data-tile-status");
    expect(
      tileStatus,
      "card appeared instantly over healthy tiles — the beat did not run",
    ).not.toBe("ready");
  } else {
    expect(cardDelayMs).toBeGreaterThanOrEqual(1500);
  }

  const card = resultCard(page);
  // Distance + bearing headline ("12.3 km northeast of your pin").
  await expect(card.getByTestId("miss-headline")).toHaveText(
    /[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin/,
  );
  // 2-line explanatory subscript: legend + story lede.
  const subscript = card.getByTestId("miss-subscript");
  await expect(subscript).toBeVisible();
  await expect(subscript).toContainText("Your pin is your guess");
  // The place story and its source.
  await expect(card.getByRole("link")).toBeVisible();

  // The gap view: both the guess pin and the true spot are framed in the
  // viewport (a near or far miss — the camera moved to fit both).
  const pin = await aimMarkerCenter(page);
  const spot = await spotMarkerCenter(page);
  expect(pin).not.toBeNull();
  expect(spot).not.toBeNull();
  for (const pt of [pin!, spot!]) {
    expect(pt.x).toBeGreaterThanOrEqual(0);
    expect(pt.x).toBeLessThanOrEqual(1440);
    expect(pt.y).toBeGreaterThanOrEqual(0);
    expect(pt.y).toBeLessThanOrEqual(900);
  }

  // Continuing returns the camera to the region framing — the next
  // question must not start at the gap-view framing.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 20_000,
    })
    .toBe(aimZoom);
});

test("miss: a tap on the map skips the beat to the end state", async ({
  page,
}) => {
  await startGlobeRun(page);
  // Fix round 3: the beat-running evidence is recorded IN the page. The
  // round-2 Node-side poll sampled __spotScreen with one page.evaluate
  // per sample; under a full-file run each evaluate took ~0.6–1.2 s
  // while the gap-view ease ran, so only ~2 samples landed before the
  // card and spotMoves came back false on a healthy beat. Instead a
  // requestAnimationFrame recorder starts at the commit (the Drop
  // click, capture phase — the moment the beat begins; a retried
  // commit after a rare hit restarts it) and records, every frame, the
  // true spot's projected screen point, whether the result card's Next
  // place button is rendered, and the skip tap's time. It is read ONCE
  // after the card lands.
  await page.evaluate(() => {
    type Sample = { t: number; x: number | null; y: number | null; cardUp: boolean };
    const rec = {
      running: false,
      start: 0,
      samples: [] as Sample[],
      tapAt: null as number | null,
      cardAt: null as number | null,
      hook: true,
    };
    (window as unknown as { __gapRec: typeof rec }).__gapRec = rec;
    const map = () => document.querySelector(".satellite-map");
    const cardUp = () =>
      [...document.querySelectorAll("button")].some((b) => {
        const r = b.getBoundingClientRect();
        return (b.textContent ?? "").trim().startsWith("Next place") && r.width > 0 && r.height > 0;
      });
    let gen = 0;
    const frame = (g: number) => {
      if (g !== gen) return; // superseded by a retried commit
      const t = Math.round(performance.now() - rec.start);
      const el = map() as unknown as { __spotScreen?: () => { x: number; y: number } | null } | null;
      if (typeof el?.__spotScreen !== "function") rec.hook = false;
      const p = el?.__spotScreen?.() ?? null;
      const up = cardUp();
      rec.samples.push({ t, x: p?.x ?? null, y: p?.y ?? null, cardUp: up });
      if (up && rec.cardAt === null) rec.cardAt = t;
      // Stop 300 ms after the card lands, or at the 8 s cap.
      if ((rec.cardAt !== null && t > rec.cardAt + 300) || t > 8000) {
        rec.running = false;
        return;
      }
      requestAnimationFrame(() => frame(g));
    };
    document.addEventListener(
      "click",
      (e) => {
        const btn = (e.target as Element | null)?.closest?.("button");
        if (btn?.getAttribute("aria-label") !== "Drop pin and lock in your guess") return;
        gen++;
        rec.running = true;
        rec.start = performance.now();
        rec.samples = [];
        rec.tapAt = null;
        rec.cardAt = null;
        rec.hook = true;
        const g = gen;
        requestAnimationFrame(() => frame(g));
      },
      true,
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (rec.running && rec.tapAt === null && (e.target as Element | null)?.closest?.(".satellite-map")) {
          rec.tapAt = Math.round(performance.now() - rec.start);
        }
      },
      true,
    );
  });
  await commitMiss(page);

  // If the card is already up, the beat completed synchronously — a
  // near miss — and there is nothing to skip.
  const cardAlreadyUp = await nextPlaceButton(page).count();
  // A missing __spotScreen hook fails loudly, never passes vacuously:
  // without the hook there is no beat to skip and no evidence the camera
  // ran. Only an already-up card (synchronous beat) skips the test.
  const hookPresent = await page.locator(".satellite-map").evaluate((el) => {
    const hook = (
      el as unknown as { __spotScreen?: () => { x: number; y: number } | null }
    ).__spotScreen;
    return typeof hook === "function";
  });
  expect(
    hookPresent,
    "gap-view camera must expose __spotScreen; a missing hook is a failure, not a skip",
  ).toBe(true);
  if (cardAlreadyUp > 0) {
    // Synchronous beat (near miss): nothing to skip.
    // The main miss test covers the card content.
    return;
  }

  // Tap the canvas (not a button, not the question bubble) mid-beat to skip.
  // (1200, 450) is right-side canvas, clear of chrome.
  expect(await tapHitsMap(page, 1200, 450)).toBe(true);
  const tappedAt = Date.now();
  await page.mouse.click(1200, 450);

  // The skip jumps synchronously to the end state (skipChoreography emits
  // jump-to + reveal-done in the pointerup handler) — the card lands promptly
  // after the tap, well before the ~2.2 s beat would finish on its own.
  // (Measured from the tap, not the commit: commit processing alone can
  // take ~1 s, and tile/WebGL jank in CI can stretch the React/MapLibre
  // render for seconds after the synchronous skip — 5 s keeps the
  // "promptly" character without flaking. tapHitsMap proved the tap point
  // hits the canvas container the skip listener is attached to.)
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - tappedAt).toBeLessThan(5000);

  // Read the recording once (let it reach its post-card stop first).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __gapRec: { running: boolean } }).__gapRec.running,
        ),
      { timeout: 10_000 },
    )
    .toBe(false);
  const rec = await page.evaluate(
    () =>
      (window as unknown as {
        __gapRec: {
          samples: { t: number; x: number | null; y: number | null; cardUp: boolean }[];
          tapAt: number | null;
          cardAt: number | null;
          hook: boolean;
        };
      }).__gapRec,
  );
  expect(rec.hook, "__spotScreen must exist on every recorded frame").toBe(true);
  // The beat demonstrably ran: the true spot's screen point moved
  // between two recorded frames BEFORE the card appeared. The camera
  // must move on its own: only frames before the skip tap count, so
  // the skip's own jump-to cannot supply the movement. A card with no
  // prior movement (camera frozen, ~2.2 s beat timer still fires) fails.
  const cardIdx = rec.samples.findIndex((s) => s.cardUp);
  const before = (cardIdx === -1 ? rec.samples : rec.samples.slice(0, cardIdx)).filter(
    (s) => rec.tapAt === null || s.t < rec.tapAt,
  );
  let spotMoves = false;
  for (let i = 1; i < before.length; i++) {
    const a = before[i - 1]!;
    const b = before[i]!;
    if (a.x !== null && b.x !== null && (a.x !== b.x || a.y !== b.y)) {
      spotMoves = true;
      break;
    }
  }
  const diag = `frames=${rec.samples.length} framesBeforeCardAndTap=${before.length} tapAt=${rec.tapAt}ms cardAt=${rec.cardAt}ms (from Drop)`;
  test.info().annotations.push({ type: "gap-view skip recorder", description: diag });
  console.log(`gap-view skip ${diag} spotMoves=${spotMoves}`);
  expect(spotMoves, `the gap-view camera must move before the card appears; ${diag}`).toBe(true);
});

test("hit: light confirmation — the card appears promptly, the camera never moves", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const zoomBefore = await page
    .locator(".satellite-map")
    .getAttribute("data-zoom");
  const { committedAt } = await commitHit(page);

  // No beat to wait for: the hit completes synchronously, so the card
  // lands promptly.
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });
  expect(Date.now() - committedAt).toBeLessThan(4000);

  // The camera never moved — the hit confirms over the pin's own view.
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-zoom"), {
      timeout: 5_000,
    })
    .toBe(zoomBefore);
});
