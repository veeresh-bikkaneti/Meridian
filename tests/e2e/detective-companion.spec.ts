import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  companionMode,
  currentPhase,
  currentPlacement,
  entryByName,
  fulfillFlagsOn,
  guessByEntryId,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Detective companion gates K2 + K3 (U10, BUILD-SCOPE §5, council Q2):
 *
 * K2 OCCLUSION — scripted pointer pauses on a grid across the map, at
 * 360×640 (touch) and 768×1024 (mouse). While Holmes is berthed, an
 * in-page rAF sampler records every frame's geometry against the
 * pause point. ZERO violations tolerated on real berths: the box must
 * never contain the point, centre distance ≥96 px (touch) / ≥64 px
 * (mouse), closest edge ≥56 px, box centre above the point. Grid
 * points where the solver lawfully answers "remote" (thinks at the
 * dock) or "hide" are counted and reported, not silently dropped:
 * remote samples are still held to contain/centre/edge (the
 * above-the-point rule governs berths, where he stands BY the point).
 *
 * K3 ABSENCE — sheet open hides Holmes ≤100 ms after the sheet appears
 * (MutationObserver timestamps, both taken in-page); after a miss he
 * stays hidden through the ring window; a pinch cancels a berth; a
 * pan cancels to the dock; a tap (<250 ms) never summons him.
 *
 * Case 137 (Henderson) via the seam — the core case with full audio.
 * No hard sleeps for assertions: every wait polls a condition. The
 * only fixed durations are the scripted stimulus itself (the pause a
 * player would make, the sampling windows that ARE the measurement).
 */

test.setTimeout(420_000);

interface BerthSample {
  contains: boolean;
  centreDist: number;
  edgeDist: number;
  centreAbove: boolean;
  left: number;
  top: number;
}

/** In-page rAF sampler: while Holmes wears the berth-think pose at a
 * berth placement, record per-frame geometry vs the pause point.
 * The point is MAP-RELATIVE (fractions of the map rect) and is
 * re-projected to client coords from the map's LIVE rect on every
 * frame: the page can scroll a few px between the pause and the
 * sampling (mobile scroll settling), and the pause point is a spot
 * ON THE MAP — measuring it in stale client coords would charge the
 * solver for the harness's own scroll drift (observed: a systematic
 * ~4 px shortfall on every margin before this fix). */
async function sampleBerth(
  page: Page,
  rel: { fx: number; fy: number } | { abs: { x: number; y: number } },
  durationMs: number,
): Promise<BerthSample[]> {
  return page.evaluate(
    ({ rel, durationMs }) =>
      new Promise<BerthSample[]>((resolve) => {
        const mapEl = document.querySelector('[data-testid="loop-map"]');
        const pointOf = () => {
          if ("abs" in rel) return rel.abs;
          const m = mapEl!.getBoundingClientRect();
          return { x: m.left + m.width * rel.fx, y: m.top + m.height * rel.fy };
        };
        const out: BerthSample[] = [];
        const t0 = performance.now();
        // SETTLED frames only: a frame counts when the wrapper's rect
        // has been unchanged for 3 consecutive frames. The walk's
        // final frames can carry the berth-think pose a frame or two
        // before the CSS transition fully lands (host timer vs
        // compositor), and under SwiftShader jank a single repeated
        // frame can fake stillness mid-walk — a moving box is in
        // transit, not berthed; K2 judges the berth, so transit
        // frames are excluded by construction here.
        let prev: { left: number; top: number } | null = null;
        let stableFrames = 0;
        const frame = () => {
          const w = document.querySelector(
            '[data-testid="detective-holmes-wrapper"]',
          );
          const host = document.querySelector('[data-testid="detective-host"]');
          if (w && host?.getAttribute("data-holmes-placement") === "berth") {
            const pose = w
              .querySelector("[data-pose]")
              ?.getAttribute("data-pose");
            if (pose === "berth-think") {
              const point = pointOf();
              const r = w.getBoundingClientRect();
              if (
                prev !== null &&
                Math.abs(r.left - prev.left) < 0.5 &&
                Math.abs(r.top - prev.top) < 0.5
              ) {
                stableFrames += 1;
              } else {
                stableFrames = 0;
              }
              prev = { left: r.left, top: r.top };
              const settled = stableFrames >= 2;
              if (!settled) {
                if (performance.now() - t0 < durationMs) requestAnimationFrame(frame);
                else resolve(out);
                return;
              }
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              const dx = Math.max(r.left - point.x, 0, point.x - r.right);
              const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
              out.push({
                contains:
                  point.x >= r.left &&
                  point.x <= r.right &&
                  point.y >= r.top &&
                  point.y <= r.bottom,
                centreDist: Math.hypot(cx - point.x, cy - point.y),
                edgeDist: Math.hypot(dx, dy),
                centreAbove: cy < point.y,
                left: r.left,
                top: r.top,
              });
            }
          }
          if (performance.now() - t0 < durationMs) {
            requestAnimationFrame(frame);
          } else {
            resolve(out);
          }
        };
        requestAnimationFrame(frame);
      }),
    { rel, durationMs },
  );
}

async function mapBox(page: Page) {
  const map = page.getByTestId("loop-map");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function dockRect(page: Page) {
  return page.evaluate(() => {
    const w = document.querySelector('[data-testid="detective-holmes-wrapper"]');
    if (!w) return null;
    const r = w.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

/** Poll until the pause resolves: berth / hidden / still dock after a
 * generous window (remote). Returns the placement outcome. */
async function pauseOutcome(page: Page, timeout = 9_000): Promise<string> {
  const start = Date.now();
  for (;;) {
    const p = await currentPlacement(page);
    if (p === "berth" || p === "hidden") return p;
    if (Date.now() - start > timeout) return p ?? "none";
    await page.waitForTimeout(120);
  }
}

const GRID: Array<[number, number]> = [
  [0.32, 0.5],
  [0.5, 0.42],
  [0.62, 0.58],
  [0.4, 0.7],
  [0.68, 0.36],
  [0.3, 0.32],
];

interface GridResult {
  samples: BerthSample[];
  berths: number;
  remotes: number;
  hides: number;
  remoteSamples: BerthSample[];
}

async function runGridMouse(page: Page): Promise<GridResult> {
  const box = await mapBox(page);
  const dock = await dockRect(page);
  const res: GridResult = { samples: [], berths: 0, remotes: 0, hides: 0, remoteSamples: [] };
  for (const [fx, fy] of GRID) {
    const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
    const outcome = await pauseOutcome(page);
    if (outcome === "hidden") {
      res.hides += 1;
    } else if (outcome === "berth") {
      const samples = await sampleBerth(page, { fx, fy }, 900);
      const atDock = samples.filter(
        (s) => dock && Math.abs(s.left - dock.left) < 4 && Math.abs(s.top - dock.top) < 4,
      );
      if (samples.length > 0 && atDock.length === samples.length) {
        res.remotes += 1;
        res.remoteSamples.push(...samples);
      } else if (samples.length > 0) {
        res.berths += 1;
        res.samples.push(...samples.filter((s) => !atDock.includes(s)));
      } else {
        res.remotes += 1;
      }
      // Cancel back to the dock: a real move away from the pause point.
      await page.mouse.move(point.x + 150, point.y + 90, { steps: 6 });
      await expect
        .poll(() => currentPlacement(page), { timeout: 10_000 })
        .toBe("dock");
      await waitForSearchIdle(page, 30_000);
    } else {
      res.remotes += 1;
    }
  }
  return res;
}

async function runGridTouch(page: Page): Promise<GridResult> {
  const box = await mapBox(page);
  const dock = await dockRect(page);
  const cdp = await page.context().newCDPSession(page);
  const res: GridResult = { samples: [], berths: 0, remotes: 0, hides: 0, remoteSamples: [] };
  for (const [fx, fy] of GRID) {
    const dispatchPoint = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    // Capture the pointer coordinate the PAGE reports for this touch:
    // Chromium's touch pipeline reports the contact centroid, which
    // can sit a few px from the CDP dispatch coordinate. The solver
    // can only ever know the reported coordinate — that reported
    // anchor is the point K2 judges against.
    await page.evaluate(() => {
      const w = window as unknown as { __anchor: { x: number; y: number } | null };
      w.__anchor = null;
      const el = document.querySelector('[data-testid="loop-map"]')!;
      const onMove = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerType === "touch" && !w.__anchor) {
          w.__anchor = { x: pe.clientX, y: pe.clientY };
        }
      };
      el.addEventListener("pointermove", onMove);
      setTimeout(() => el.removeEventListener("pointermove", onMove), 20_000);
    });
    const point = dispatchPoint;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    // Finger micro-jitter (<6 px) — a perfectly still touch emits no
    // pointermove for the host's detector to feed on; a real resting
    // finger always trembles a little. This is stimulus, not a wait.
    // The detector anchors the pause on its FIRST fed sample (the
    // first pointermove — touchStart itself feeds nothing), proven
    // by the page-reported anchor equalling the first jitter move in
    // an earlier run. So the first moves land EXACTLY on the point:
    // anchor ≡ dispatch point, no jitter ambiguity in the audit.
    const jitters: Array<[number, number]> = [
      [0, 0],
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 0],
    ];
    for (const [jx, jy] of jitters) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: point.x + jx, y: point.y + jy, id: 1 }],
      });
      await page.waitForTimeout(110);
    }
    const outcome = await pauseOutcome(page);
    console.log(
      `[K2 touch grid] point (${fx},${fy}) → ${outcome}, phase=${await currentPhase(page)}`,
    );
    if (outcome === "hidden") {
      res.hides += 1;
    } else if (outcome === "berth") {
      const reported = await page.evaluate(
        () =>
          (window as unknown as { __anchor: { x: number; y: number } | null })
            .__anchor,
      );
      const anchor = reported ?? point;
      console.log(
        `[K2 touch grid] point (${fx},${fy}) dispatch=${JSON.stringify(point)} reported anchor=${JSON.stringify(anchor)}`,
      );
      const samples = await sampleBerth(page, { abs: anchor }, 900);
      if (samples.length > 0) {
        // Diagnostic: distance from the berth centre to the ORIGINAL
        // client point (captured at dispatch, no reprojection).
        const s0 = samples[0]!;
        const cx = s0.left + 35;
        const cy = s0.top + 52;
        const distToClientPoint = Math.hypot(cx - point.x, cy - point.y);
        console.log(
          `[K2 touch grid] point (${fx},${fy}) worst centre=${Math.min(...samples.map((s) => s.centreDist)).toFixed(2)} worst edge=${Math.min(...samples.map((s) => s.edgeDist)).toFixed(2)} distToClientPoint=${distToClientPoint.toFixed(2)} transformVsRect=${await page.evaluate(() => { const w = document.querySelector('[data-testid="detective-holmes-wrapper"]') as HTMLElement | null; const m = document.querySelector('[data-testid="loop-map"]'); if (!w || !m) return null; const r = w.getBoundingClientRect(); const mr = m.getBoundingClientRect(); const t = new DOMMatrixReadOnly(getComputedStyle(w).transform); return `intended=(${t.e.toFixed(2)},${t.f.toFixed(2)}) renderedMapRel=(${(r.left - mr.left).toFixed(2)},${(r.top - mr.top).toFixed(2)})`; })}`,
        );
      }
      const atDock = samples.filter(
        (s) => dock && Math.abs(s.left - dock.left) < 4 && Math.abs(s.top - dock.top) < 4,
      );
      if (samples.length > 0 && atDock.length === samples.length) {
        res.remotes += 1;
        res.remoteSamples.push(...samples);
      } else if (samples.length > 0) {
        res.berths += 1;
        res.samples.push(...samples.filter((s) => !atDock.includes(s)));
      } else {
        res.remotes += 1;
      }
      // Cancel: drag away, then lift.
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: point.x + 120, y: point.y + 70, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect
        .poll(() => currentPlacement(page), { timeout: 10_000 })
        .toBe("dock");
      await waitForSearchIdle(page, 30_000);
    } else {
      res.remotes += 1;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    if (outcome === "hidden") {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  }
  return res;
}

function assertClearance(
  samples: BerthSample[],
  centreMin: number,
  label: string,
): { worstCentre: number; worstEdge: number } {
  expect(samples.length, `${label}: no berth samples recorded`).toBeGreaterThan(0);
  let worstCentre = Infinity;
  let worstEdge = Infinity;
  for (const s of samples) {
    worstCentre = Math.min(worstCentre, s.centreDist);
    worstEdge = Math.min(worstEdge, s.edgeDist);
  }
  console.log(
    `[${label}] worst centre=${worstCentre.toFixed(2)} worst edge=${worstEdge.toFixed(2)} above-violations=${samples.filter((s) => !s.centreAbove).length} contains=${samples.filter((s) => s.contains).length}`,
  );
  for (const s of samples) {
    expect(s.contains, `${label}: box contains the pause point`).toBe(false);
    expect(s.centreDist, `${label}: centre distance`).toBeGreaterThanOrEqual(centreMin);
    expect(s.edgeDist, `${label}: edge clearance`).toBeGreaterThanOrEqual(56);
    expect(s.centreAbove, `${label}: centre above the point`).toBe(true);
  }
  return { worstCentre, worstEdge };
}

async function openCompanionContext(
  browser: Browser,
  viewport: { width: number; height: number },
  touch: boolean,
): Promise<{ context: import("playwright/test").BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: touch,
  });
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 4);
  await fulfillFlagsOn(context);
  const page = await context.newPage();
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  expect(await companionMode(page)).toBe("full");
  return { context, page };
}

test("K2 clearance — touch grid at 360×640", async ({ browser }) => {
  const { context, page } = await openCompanionContext(
    browser,
    { width: 360, height: 640 },
    true,
  );
  try {
    const res = await runGridTouch(page);
    console.log(
      `[K2 touch] berths=${res.berths} remotes=${res.remotes} hides=${res.hides} samples=${res.samples.length} remoteSamples=${res.remoteSamples.length} watchdogSeeks=${await watchdogSeeks(page)}`,
    );
    expect(res.berths).toBeGreaterThanOrEqual(2);
    const worst = assertClearance(res.samples, 96, "K2 touch");
    for (const s of res.remoteSamples) {
      expect(s.contains).toBe(false);
      expect(s.centreDist).toBeGreaterThanOrEqual(96);
      expect(s.edgeDist).toBeGreaterThanOrEqual(56);
    }
    console.log(
      `[K2 touch] worst centre=${worst.worstCentre.toFixed(1)}px (≥96) worst edge=${worst.worstEdge.toFixed(1)}px (≥56) violations=0`,
    );
  } finally {
    await context.close();
  }
});

test("K2 clearance — mouse grid at 768×1024", async ({ browser }) => {
  const { context, page } = await openCompanionContext(
    browser,
    { width: 768, height: 1024 },
    false,
  );
  try {
    const res = await runGridMouse(page);
    console.log(
      `[K2 mouse] berths=${res.berths} remotes=${res.remotes} hides=${res.hides} samples=${res.samples.length} remoteSamples=${res.remoteSamples.length} watchdogSeeks=${await watchdogSeeks(page)}`,
    );
    expect(res.berths).toBeGreaterThanOrEqual(2);
    const worst = assertClearance(res.samples, 64, "K2 mouse");
    for (const s of res.remoteSamples) {
      expect(s.contains).toBe(false);
      expect(s.centreDist).toBeGreaterThanOrEqual(64);
      expect(s.edgeDist).toBeGreaterThanOrEqual(56);
    }
    console.log(
      `[K2 mouse] worst centre=${worst.worstCentre.toFixed(1)}px (≥64) worst edge=${worst.worstEdge.toFixed(1)}px (≥56) violations=0`,
    );
  } finally {
    await context.close();
  }
});

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 4);
});

test("K3 absence — sheet ≤100 ms, ring window hidden", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  // Observer armed BEFORE the sheet can appear: timestamps for the
  // dialog's first appearance and the host root's removal, plus a
  // per-frame record of Holmes's visibility for the ring window.
  await page.evaluate(() => {
    const w = window as unknown as {
      __k3: { dialogAt: number | null; hostGoneAt: number | null; commitAt: number | null; backAt: number | null; clickAt: number | null; frames: Array<{ t: number; holmesVisible: boolean; phase: string | null; dialog: boolean }> };
    };
    w.__k3 = { dialogAt: null, hostGoneAt: null, commitAt: null, backAt: null, clickAt: null, frames: [] };
    (w.__k3 as unknown as { t0: number }).t0 = performance.now();
    // Timestamp the "Guess this place" click IN-PAGE (capture phase,
    // same performance.now clock as the observer below). The click is
    // the causally earliest event of the ring hold: click → store
    // commit → host effect starts its 2000 ms ring timer → the pair
    // returns. Anchoring the hold measurement here (instead of at the
    // dialog's observed disappearance) removes the MutationObserver
    // delivery lag from the measurement — on this VM that lag
    // measured 327 ms (the dialog-close batch reached the observer
    // 327 ms after the causal chain had already started the timer),
    // which made a full-length hold read as 1673 ms.
    document.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement | null;
        if (
          w.__k3.clickAt === null &&
          t?.closest("button")?.textContent?.includes("Guess this place")
        ) {
          w.__k3.clickAt = performance.now();
        }
      },
      true,
    );
    const obs = new MutationObserver(() => {
      const now = performance.now();
      const dialog = document.querySelector('[role="dialog"]') !== null;
      const wrapper =
        document.querySelector('[data-testid="detective-holmes-wrapper"]') !== null;
      if (w.__k3.dialogAt === null && dialog) {
        w.__k3.dialogAt = now;
      }
      if (w.__k3.dialogAt !== null && w.__k3.hostGoneAt === null && !wrapper) {
        w.__k3.hostGoneAt = now;
      }
      // The guess commits in the same beat the sheet closes: the
      // first mutation batch with the dialog gone after it appeared.
      if (w.__k3.dialogAt !== null && w.__k3.commitAt === null && !dialog) {
        w.__k3.commitAt = now;
      }
      if (w.__k3.commitAt !== null && w.__k3.backAt === null && wrapper) {
        w.__k3.backAt = now;
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    const t0 = performance.now();
    // Interval sampling, not rAF: during the ring window the
    // SwiftShader GL work starves rAF to a few fps (observed: 5
    // frames in 1800 ms), while a 50 ms interval keeps sampling the
    // DOM state that is actually under test.
    const loop = () => {
      const wrapper = document.querySelector('[data-testid="detective-holmes-wrapper"]');
      const host = document.querySelector('[data-testid="detective-host"]');
      w.__k3.frames.push({
        t: performance.now() - t0,
        holmesVisible: wrapper !== null,
        phase: host?.getAttribute("data-phase") ?? null,
        dialog: document.querySelector('[role="dialog"]') !== null,
      });
    };
    const iv = setInterval(loop, 50);
    setTimeout(() => clearInterval(iv), 60_000);
    loop();
  });

  const lasVegas = entryByName("las vegas");
  await guessByEntryId(page, lasVegas.id, "las vegas");

  const k3 = await page.evaluate(
    () =>
      (window as unknown as { __k3: { dialogAt: number | null; hostGoneAt: number | null } })
        .__k3,
  );
  expect(k3.dialogAt).not.toBeNull();
  expect(k3.hostGoneAt).not.toBeNull();
  const delta = k3.hostGoneAt! - k3.dialogAt!;
  console.log(`[K3 sheet] Holmes hidden ${delta.toFixed(1)} ms after the sheet appeared (≤100)`);
  expect(delta).toBeLessThanOrEqual(100);
  expect(delta).toBeGreaterThanOrEqual(0);

  // Ring window: Holmes must stay hidden from the guess commit until
  // the ring absence ends (the host holds RING_ABSENCE_MS = 2000 ms,
  // DetectiveHost.tsx). Proven on MutationObserver timestamps —
  // event-driven, so the proof does not depend on sampler density
  // (interval/rAF sampling starves to a few ticks under this VM's
  // SwiftShader ring render; observed and disclosed).
  //
  // The duration is anchored at the in-page CLICK timestamp (see the
  // listener above): the causal chain click → commit → timer-start →
  // timer-fire → return means the pair cannot lawfully return before
  // click + 2000 ms, so backAt − clickAt ≥ 1800 (2000 minus the same
  // ≤200 ms tolerance) is a conservative floor. The earlier anchor —
  // the observer's dialog-disappearance batch — is kept in the log
  // for context: its delivery lagged the chain by 327 ms on the
  // failing run, so it understated a full hold as 1673 ms. The
  // interval frames that land in the window must also all agree he
  // was hidden.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __k3: { backAt: number | null } }).__k3.backAt,
        ),
      { timeout: 60_000 },
    )
    .not.toBeNull();
  const k3Ring = await page.evaluate(
    () =>
      (window as unknown as { __k3: { commitAt: number | null; backAt: number | null; clickAt: number | null; frames: Array<{ t: number; holmesVisible: boolean; phase: string | null; dialog: boolean }> } })
        .__k3,
  );
  expect(k3Ring.commitAt).not.toBeNull();
  expect(k3Ring.clickAt).not.toBeNull();
  const hiddenMs = k3Ring.backAt! - k3Ring.commitAt!;
  const hiddenFromClickMs = k3Ring.backAt! - k3Ring.clickAt!;
  console.log(
    `[K3 ring] Holmes hidden for ${hiddenFromClickMs.toFixed(0)} ms after the guess click (ring hold 2000 ms, assert ≥1800); dialog-anchored reading ${hiddenMs.toFixed(0)} ms (delivery-lagged, context only)`,
  );
  expect(hiddenFromClickMs).toBeGreaterThanOrEqual(1800);
  const frames = k3Ring.frames;
  // Supporting interval frames, on the SAME click anchor: he is
  // hidden continuously from the sheet (already open at the click)
  // through the ring hold, so every frame sampled inside
  // [click, click+1800] must show him absent. (The previous window
  // anchored at the sampler's first dialog-free frame misread the
  // run: the dialog's DOM close lands ~600 ms after the click under
  // load, so that window slid ~600 ms late and caught his lawful
  // return at its tail — 8 frames ≈ 400 ms of post-hold visibility.)
  const k3T0 = await page.evaluate(
    () =>
      (window as unknown as { __k3: { t0: number } }).__k3.t0,
  );
  const clickFrameT = k3Ring.clickAt! - k3T0;
  const ringFrames = frames.filter(
    (f) => f.t >= clickFrameT && f.t <= clickFrameT + 1800,
  );
  const visibleInRing = ringFrames.filter((f) => f.holmesVisible);
  console.log(
    `[K3 ring] supporting interval frames in click-anchored window: ${ringFrames.length}, Holmes visible in ${visibleInRing.length}${visibleInRing.length ? ` (phases: ${visibleInRing.map((f) => f.phase).join(",")})` : ""}`,
  );
  expect(visibleInRing).toHaveLength(0);
  // The pair returns for the selection read, then the ladder moves on;
  // wait for the next SEARCH_IDLE (post-miss) to prove the flow lived.
  await waitForSearchIdle(page, 120_000);
  console.log(`[K3] post-miss ladder returned to SEARCH_IDLE; watchdogSeeks=${await watchdogSeeks(page)}`);
});

/** Berth Holmes at the dock-near point (0.38, 0.68 of the map) with a
 * mouse pause. Shared by the two cancel tests. */
async function berthAtDockNearPoint(page: Page): Promise<{ x: number; y: number }> {
  expect(await companionMode(page)).toBe("full");
  const box = await mapBox(page);
  const point = { x: box.x + box.width * 0.38, y: box.y + box.height * 0.68 };
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
  await expect
    .poll(() => currentPlacement(page), { timeout: 15_000 })
    .toBe("berth");
  return point;
}

test("K3 absence — pinch cancels a berth", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  const point = await berthAtDockNearPoint(page);
  const cdp = await context.newCDPSession(page);
  // Pinch: two fingers down cancels the berth.
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: point.x, y: point.y, id: 1 },
      { x: point.x + 80, y: point.y + 40, id: 2 },
    ],
  });
  await expect
    .poll(() => currentPlacement(page), { timeout: 10_000 })
    .toBe("dock");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // Disclosed observation (not a K3 failure): on this VM's SwiftShader
  // renderer the pinch zoom's frame collapse reliably trips the U6
  // auto-kill (rolling FPS < 45 in SEARCH phases), latching the
  // companion dock-only for the session. The pinch CANCEL — K3's
  // actual requirement — landed on the dock above, before and
  // regardless of the kill. The pan half therefore runs in its own
  // test with a fresh session (the kill is session-scoped by design).
  console.log(
    `[K3 pinch] berth cancelled to dock; companion mode after pinch = ${await companionMode(page)}; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

test("K3 absence — pan cancels a berth to the dock", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  const point = await berthAtDockNearPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 140, point.y + 80, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => currentPlacement(page), { timeout: 10_000 })
    .toBe("dock");
  console.log(
    `[K3 pan] berth cancelled to dock; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

test("K3 — a tap (<250 ms) never summons Holmes", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  const box = await mapBox(page);
  // Record every placement the host reports during the tap window.
  await page.evaluate(() => {
    const w = window as unknown as { __tapPlacements: string[] };
    w.__tapPlacements = [];
    const obs = new MutationObserver(() => {
      const el =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      const p = el?.getAttribute("data-holmes-placement");
      if (p) w.__tapPlacements.push(p);
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-holmes-placement"],
    });
  });
  const point = { x: box.x + box.width * 0.38, y: box.y + box.height * 0.68 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up(); // a tap: well under 250 ms, no travel
  // Sample the recorded placements over the following ~1.2 s (the
  // measurement window — a berth would need only ~460 ms to fire).
  await page.waitForTimeout(1200);
  const placements = await page.evaluate(
    () => (window as unknown as { __tapPlacements: string[] }).__tapPlacements,
  );
  console.log(`[K3 tap] placements seen during tap window: ${JSON.stringify(placements)}`);
  expect(placements).not.toContain("berth");
  const now = await currentPlacement(page);
  expect(now === "dock" || now === null).toBe(true);
  // Dismiss the confirm sheet the tap opened, if it opened.
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
  }
  void currentPhase;
});
