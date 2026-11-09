import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  assertHolmesStaysSettled,
  companionMode,
  currentPhase,
  currentPlacement,
  entryByName,
  fulfillFlagsOn,
  guessByEntryId,
  holmesRect,
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
 * (mouse), closest edge ≥56 px. Grid points where the solver
 * lawfully answers "remote" (thinks at the dock) or "hide" are
 * counted and reported, not silently dropped: remote samples are
 * still held to contain/centre/edge.
 *
 * PB-1 REWRITE NOTE (2026-11-07): the old K2 "centre above the
 * point" anchor rule and the K3 "pinch/pan cancels a berth to the
 * dock" rules asserted the DELETED berth engine. Under the owner's
 * follow model a pinch or pan does NOT cancel anything — Holmes
 * stays planted (viewport-fixed in the follow tier; map-anchored in
 * the pause-berth tier this spec's intercepted flags select) and
 * NEVER returns to a dock on his own. The two K3 tests below assert
 * exactly that; the follow model itself is gated by
 * detective-follow.spec.ts.
 *
 * K3 ABSENCE — sheet open hides Holmes ≤100 ms after the sheet appears
 * (MutationObserver timestamps, both taken in-page); after a miss he
 * stays hidden through the ring window; a pinch does NOT cancel a
 * berth; a pan does NOT cancel a berth; a tap (<250 ms) never
 * summons him.
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
        // K2 cure (PR #364): the audit window opens only once the
        // wrapper is SETTLED in the host's own signals too — neither
        // travelling (class detective-follow-travelling) nor
        // telegraphing (data-follow-telegraph attr), both carried on
        // the wrapper element — AND the rect has been stable for
        // >= 150 ms of wall time (the 3-frame gate alone can pass
        // inside 150 ms under jank). Travelling/telegraphing frames
        // reset the stability clock entirely.
        let prev: { left: number; top: number } | null = null;
        let stableFrames = 0;
        let stableSince: number | null = null;
        const frame = () => {
          const w = document.querySelector(
            '[data-testid="detective-holmes-wrapper"]',
          );
          const host = document.querySelector('[data-testid="detective-follow-root"]') ?? document.querySelector('[data-testid="detective-station"]') ?? document.querySelector('[data-testid="detective-host"]'); // detective-host is Watson-only here and absent in SEARCH, so berth samples read 0 from it alone; Holmes rides the follow root, station as fallback (detective-u10.ts pattern)
          if (w && host?.getAttribute("data-holmes-placement") === "berth") {
            const pose = w
              .querySelector("[data-pose]")
              ?.getAttribute("data-pose");
            if (pose === "berth-think") {
              const point = pointOf();
              const r = w.getBoundingClientRect();
              const travelling = w.classList.contains(
                "detective-follow-travelling",
              );
              const telegraphing = w.hasAttribute("data-follow-telegraph");
              if (travelling || telegraphing) {
                prev = null;
                stableFrames = 0;
                stableSince = null;
                if (performance.now() - t0 < durationMs) requestAnimationFrame(frame);
                else resolve(out);
                return;
              }
              if (
                prev !== null &&
                Math.abs(r.left - prev.left) < 0.5 &&
                Math.abs(r.top - prev.top) < 0.5
              ) {
                stableFrames += 1;
              } else {
                stableFrames = 0;
                stableSince = performance.now();
              }
              prev = { left: r.left, top: r.top };
              const stableMs =
                stableSince === null ? 0 : performance.now() - stableSince;
              const settled = stableFrames >= 2 && stableMs >= 150;
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

/**
 * The wrapper's CURRENT settled rect. (This helper used to be
 * `dockRect`: under the owner's STAYS model there is no true dock
 * reference to capture once a dwell has berthed him — the rect
 * read after the cured idle wait may be a berth, not the dock.
 * K2's remote classification is therefore re-derived per grid
 * point from THIS settled rect — see runGridMouse/runGridTouch.)
 */
async function settledRect(page: Page) {
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
  const res: GridResult = { samples: [], berths: 0, remotes: 0, hides: 0, remoteSamples: [] };
  for (const [fx, fy] of GRID) {
    // Remote re-derivation (Cure A2, option (b)): a sample set is
    // "remote" when the solver answered THIS point's pause by not
    // moving — i.e. every sample sits on the rect Holmes was
    // settled at BEFORE this point's stimulus. The old grid-start
    // dock capture cannot serve: after the cured idle wait that
    // rect may be a dwell berth, not the dock, and under STAYS the
    // settled spot changes point to point. (Option (a), a fresh
    // context's pre-pause capture, was rejected: its own unlock
    // dwell can berth it too, and its geometry need not match.)
    const settled = await settledRect(page);
    const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
    const outcome = await pauseOutcome(page);
    if (outcome === "hidden") {
      res.hides += 1;
    } else if (outcome === "berth") {
      const samples = await sampleBerth(page, { fx, fy }, 900);
      const atSettled = samples.filter(
        (s) => settled && Math.abs(s.left - settled.left) < 4 && Math.abs(s.top - settled.top) < 4,
      );
      if (samples.length > 0 && atSettled.length === samples.length) {
        res.remotes += 1;
        res.remoteSamples.push(...samples);
      } else if (samples.length > 0) {
        res.berths += 1;
        res.samples.push(...samples.filter((s) => !atSettled.includes(s)));
      } else {
        res.remotes += 1;
      }
      // PB-1 STAYS: there is NO cancel back to the dock — a move
      // or drag away does not un-berth him (the deleted-model step
      // that polled for "dock" here is gone). The next grid point's
      // own move + jitter is the fresh stimulus, and pauseOutcome
      // judges its outcome: in this spec's flag-OFF (PAUSE_BERTH)
      // tier a fresh berth requires a genuine new pause at the new
      // point.
    } else {
      res.remotes += 1;
    }
  }
  return res;
}

/** The wrapper's current transform string (viewport translate3d),
 * or null when Holmes is not mounted. Recorded before each touch
 * stimulus for the fresh-confirm rule below. */
async function wrapperTransform(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const w = document.querySelector(
      '[data-testid="detective-holmes-wrapper"]',
    ) as HTMLElement | null;
    if (!w) return null;
    return getComputedStyle(w).transform;
  });
}

/**
 * K2 touch grid — fresh-pause gate (PR #364 cure).
 *
 * Why: under STAYS a berth is STICKY. After point 1 berths, the
 * phase sits in SEARCH_AREA, which exits ONLY via gestureStarted —
 * and gestureStarted needs a real on-map move > 12 px
 * (GESTURE_CANCEL_PX) from the pause point; attemptConfirm also
 * requires SEARCH_IDLE. The grid's <= 1 px finger jitter can never
 * fire any of that, so without this gate points 2-6 would inherit
 * point 1's berth and be "confirmed" instantly against new anchors.
 *
 * The lawful reset is a real touch drag on the map (> 12 px — a
 * ~map-width sweep, so some move event lands > 12 px from ANY pause
 * point on the map) via the spec's CDP touch pattern, after which
 * the phase must poll back to SEARCH_IDLE (bounded; a phase that
 * never returns is a harness error, not a remote).
 */
async function ensureTouchSearchIdle(
  page: Page,
  cdp: Awaited<
    ReturnType<import("playwright/test").BrowserContext["newCDPSession"]>
  >,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> {
  // Cure round 5 (diagnosis E): the previous point's lift-in-place
  // is a tap on the map \u2014 the place-confirm sheet may be open
  // with the host unmounted under it by design (phase reads null).
  // Dismiss it first; the phase logic below then judges the
  // returned SEARCH state exactly as before.
  const notThisOne = page.getByRole("button", { name: "Not this one" });
  const sheetOpened = await notThisOne
    .waitFor({ state: "visible", timeout: 1_500 })
    .then(() => true)
    .catch(() => false);
  if (sheetOpened) await notThisOne.click();
  const phase0 = await currentPhase(page);
  if (phase0 === "SEARCH_IDLE") return;
  if (phase0 !== "SEARCH_AREA") {
    // Some other phase (e.g. a read still draining): give it a
    // bounded chance to settle to SEARCH_IDLE on its own first.
    try {
      await expect
        .poll(() => currentPhase(page), { timeout: 10_000 })
        .toBe("SEARCH_IDLE");
      return;
    } catch (pollErr) {
      // Round 8 (diagnosis #2 Q1): a poll that died on a destroyed
      // execution context is a dead page (renderer loss), not a
      // phase verdict \u2014 name it as the environment failure it is
      // instead of manufacturing a phase diagnosis from it.
      const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
      if (/Execution context was destroyed|Target closed/i.test(msg)) {
        throw new Error(
          `[K2 touch grid] fresh-pause gate: page lost during the settle poll (environment): ${msg}`,
        );
      }
      /* fall through to the clear error below if it is SEARCH_AREA */
      const phaseNow = await currentPhase(page).catch(() => null);
      if (phaseNow !== "SEARCH_AREA") {
        throw new Error(
          `[K2 touch grid] fresh-pause gate: phase is ${phaseNow}, not SEARCH_IDLE/SEARCH_AREA — cannot start a stimulus lawfully`,
        );
      }
    }
  }
  const y = box.y + box.height * 0.5;
  const x0 = box.x + 24;
  const x1 = box.x + box.width - 24;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x0, y, id: 1 }],
  });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y, id: 1 }],
    });
    await page.waitForTimeout(60);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  try {
    await expect
      .poll(() => currentPhase(page), { timeout: 15_000 })
      .toBe("SEARCH_IDLE");
  } catch (pollErr) {
    // Round 8 (diagnosis #2 Q1): as above \u2014 a destroyed context
    // in the poll is a dead page, not a phase that never returned.
    const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
    if (/Execution context was destroyed|Target closed/i.test(msg)) {
      throw new Error(
        `[K2 touch grid] fresh-pause gate: page lost during the post-drag poll (environment): ${msg}`,
      );
    }
    const lastPhase = await currentPhase(page).catch(() => null);
    throw new Error(
      `[K2 touch grid] fresh-pause gate: phase never returned to SEARCH_IDLE after the lawful >12 px drag reset (last phase=${lastPhase})`,
    );
  }
}

/**
 * K2 touch grid — fresh-confirm poll (PR #364 cure). A "berth"
 * counts ONLY on a transition into berth/SEARCH_AREA AFTER the
 * stimulus: the gate above guarantees the phase was SEARCH_IDLE
 * (and the wrapper transform was recorded) before the stimulus, so
 * SEARCH_AREA appearing now is by construction THIS point's pause
 * confirming — never the inherited STAYS berth, whose samples must
 * not be asserted against this point's anchor. No fresh confirm
 * within the window => remote/none (counted + logged by the
 * caller). "hidden" is reported as before.
 */
async function freshBerthOutcome(
  page: Page,
  beforeTransform: string | null,
  timeout = 12_000,
): Promise<{ outcome: string; transformChanged: boolean }> {
  const start = Date.now();
  let transformChanged = false;
  for (;;) {
    const placement = await currentPlacement(page);
    if (placement === "hidden") return { outcome: "hidden", transformChanged };
    const t = await wrapperTransform(page);
    if (t !== null && beforeTransform !== null && t !== beforeTransform) {
      transformChanged = true;
    }
    const phase = await currentPhase(page);
    if (phase === "SEARCH_AREA") {
      return { outcome: "berth", transformChanged };
    }
    // Placement "berth" without the SEARCH_AREA transition counts
    // only if the wrapper actually moved after the stimulus.
    if (placement === "berth" && transformChanged) {
      return { outcome: "berth", transformChanged };
    }
    if (Date.now() - start > timeout) {
      return { outcome: placement ?? "none", transformChanged };
    }
    await page.waitForTimeout(120);
  }
}

async function runGridTouch(page: Page): Promise<GridResult> {
  const box = await mapBox(page);
  const cdp = await page.context().newCDPSession(page);
  const res: GridResult = { samples: [], berths: 0, remotes: 0, hides: 0, remoteSamples: [] };
  for (const [fx, fy] of GRID) {
    // Fresh-pause gate FIRST (see ensureTouchSearchIdle): the
    // stimulus for this point starts only from SEARCH_IDLE.
    await ensureTouchSearchIdle(page, cdp, box);
    // Per-point settled reference for the remote classification —
    // same Cure A2 re-derivation as runGridMouse (option (b)),
    // captured AFTER the gate so it names the inherited STAYS
    // berth this point must not be judged by. Null handling: see
    // the berth branch below (never let a null empty the filter).
    let settled = await settledRect(page);
    // Fresh-confirm baseline: phase (SEARCH_IDLE, per the gate) +
    // wrapper transform recorded before the stimulus.
    const phaseBefore = await currentPhase(page);
    const transformBefore = await wrapperTransform(page);
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
    // Fresh-confirm ONLY (see freshBerthOutcome): a placement that
    // already read "berth" from the inherited STAYS berth is NOT an
    // outcome for this point.
    const { outcome, transformChanged } = await freshBerthOutcome(
      page,
      transformBefore,
    );
    console.log(
      `[K2 touch grid] point (${fx},${fy}) → ${outcome} (phaseBefore=${phaseBefore} phase=${await currentPhase(page)} transformChanged=${transformChanged})`,
    );
    try {
      if (outcome === "hidden") {
        res.hides += 1;
      } else if (outcome === "berth") {
        // Null-settled hole (PR #364 cure): if the pre-stimulus
        // settled capture was null, re-capture now the outcome has
        // resolved; if it is STILL null the point's classification
        // is "unknown" and the point fails as a harness error —
        // a null must never silently empty the remote filter and
        // dump the inherited berth's samples into the asserted
        // bucket.
        if (!settled) {
          settled = await settledRect(page);
          console.log(
            `[K2 touch grid] point (${fx},${fy}) settledRect was null pre-stimulus; re-captured=${JSON.stringify(settled)}`,
          );
        }
        if (!settled) {
          throw new Error(
            `[K2 touch grid] harness error: settledRect still null for point (${fx},${fy}) after the berth resolved — classification unknown, refusing to assert unfiltered samples`,
          );
        }
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
            `[K2 touch grid] point (${fx},${fy}) worst centre=${Math.min(...samples.map((s) => s.centreDist)).toFixed(2)} worst edge=${Math.min(...samples.map((s) => s.edgeDist)).toFixed(2)} distToClientPoint=${distToClientPoint.toFixed(2)} transformVsRectViewport=${await page.evaluate(() => { const w = document.querySelector('[data-testid="detective-holmes-wrapper"]') as HTMLElement | null; if (!w) return null; const r = w.getBoundingClientRect(); const t = new DOMMatrixReadOnly(getComputedStyle(w).transform); return `transformViewport=(${t.e.toFixed(2)},${t.f.toFixed(2)}) rectViewport=(${r.left.toFixed(2)},${r.top.toFixed(2)})`; })}`,
          );
        }
        const atSettled = samples.filter(
          (s) => Math.abs(s.left - settled.left) < 4 && Math.abs(s.top - settled.top) < 4,
        );
        if (samples.length > 0 && atSettled.length === samples.length) {
          res.remotes += 1;
          res.remoteSamples.push(...samples);
        } else if (samples.length > 0) {
          res.berths += 1;
          res.samples.push(...samples.filter((s) => !atSettled.includes(s)));
        } else {
          res.remotes += 1;
        }
      } else {
        // No fresh confirm: remote/none — counted + logged, and the
        // inherited position's samples are never asserted.
        res.remotes += 1;
        console.log(
          `[K2 touch grid] point (${fx},${fy}) classified remote/none (no fresh berth transition after stimulus)`,
        );
      }
    } finally {
      // The finger is LIFTED at the end of every point (touch
      // lifecycle for the next grid point's touchStart / gate drag,
      // not a cancel stimulus: a lift in place starts no gesture).
      // The next point's fresh-pause gate performs any lawful
      // SEARCH_AREA -> SEARCH_IDLE reset before its stimulus.
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
    `[${label}] worst centre=${worstCentre.toFixed(2)} worst edge=${worstEdge.toFixed(2)} contains=${samples.filter((s) => s.contains).length}`,
  );
  for (const s of samples) {
    expect(s.contains, `${label}: box contains the pause point`).toBe(false);
    expect(s.centreDist, `${label}: centre distance`).toBeGreaterThanOrEqual(centreMin);
    expect(s.edgeDist, `${label}: edge clearance`).toBeGreaterThanOrEqual(56);
    // PB-1: no above-the-point assertion — the anchor rule is deleted.
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

test("K3 planted — a pinch does NOT cancel a berth (PB-1)", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  const point = await berthAtDockNearPoint(page);
  const cdp = await context.newCDPSession(page);
  // Pinch: two fingers down. Under the follow model this is a burst
  // gesture, not a cancel: Holmes stays berthed where he stands.
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
  await page.waitForTimeout(1_500);
  expect(
    await currentPlacement(page),
    "PB-1: a pinch must not cancel the berth back to a dock",
  ).toBe("berth");
  // Cure A3: the instant assertion becomes a stays-settled window
  // (1.5 s, matching the wait above) — placement constant and
  // centre planted while the pinch still holds.
  await assertHolmesStaysSettled(page, 1_500);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  console.log(
    `[K3 pinch PB-1] berth held through pinch; companion mode = ${await companionMode(page)}; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

test("K3 planted — a pan does NOT cancel a berth (PB-1)", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  const point = await berthAtDockNearPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 140, point.y + 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1_500);
  expect(
    await currentPlacement(page),
    "PB-1: a pan must not cancel the berth back to a dock — he stays",
  ).toBe("berth");
  // Cure A3: stays-settled window (1.5 s, matching the wait above).
  await assertHolmesStaysSettled(page, 1_500);
  console.log(
    `[K3 pan PB-1] berth held through pan; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

/**
 * K3 tap — premise, stated honestly (cure round 4, v3): the
 * settled state after the idle wait VARIES. Round 3's E2E proved
 * Holmes can be at the STATION then (placement "station", no
 * follow wrapper in the DOM), as well as "dock" or "berth" — so
 * v2's premise "he is mounted on the map after the idle wait, the
 * settled rect must exist" failed AT THE PREMISE ("Holmes must
 * stay mounted: Received: null"). This rewrite is placement-based
 * (the original main-era pin): record whatever state he settled
 * in, with no rect requirement, and pin the boundary that matters
 * from EVERY settled state — a tap (<250 ms) is not a
 * summons/pause: the press must not change his placement, must
 * not move him, and must not create a berth. Whatever state he
 * settled in, the tap changes nothing. (Positive control:
 * berthAtDockNearPoint in this file, used by the pinch/pan tests
 * above, proves a genuine pause at a point DOES berth.)
 */
test("K3 — a tap (<250 ms) never summons Holmes", async ({ page, context }) => {
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  // Settled state, recorded — not assumed, and with NO rect
  // requirement: the placement may be "station", "dock" or
  // "berth". If a wrapper rect does exist, record its centre too.
  const settledPlacement = await currentPlacement(page);
  const settledWrapper = await holmesRect(page);
  const settledCentre = settledWrapper
    ? {
        x: settledWrapper.x + settledWrapper.w / 2,
        y: settledWrapper.y + settledWrapper.h / 2,
      }
    : null;
  // Position reference for choosing the tap point: his settled
  // centre if mounted; otherwise the station/dock reference —
  // the rect centre of the same placement-carrying element
  // currentPlacement() reads (detective-station, falling back to
  // detective-host).
  const stationReference = await page.evaluate(() => {
    const el =
      document.querySelector('[data-testid="detective-station"]') ??
      document.querySelector('[data-testid="detective-host"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const box = await mapBox(page);
  const reference =
    settledCentre ??
    stationReference ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Tap at whichever candidate point is FARTHER from his current
  // position reference — a tap that "summoned" him would have
  // the longest, most visible travel to make, and neither
  // candidate can be confused with wherever he is already sitting.
  const candidates = [
    { x: box.x + box.width * 0.38, y: box.y + box.height * 0.68 },
    { x: box.x + box.width * 0.72, y: box.y + box.height * 0.3 },
  ];
  const point = candidates.reduce((farther, c) =>
    Math.hypot(c.x - reference.x, c.y - reference.y) >
    Math.hypot(farther.x - reference.x, farther.y - reference.y)
      ? c
      : farther,
  );
  // Record TRANSITIONS, not state (round 1's fix, kept). The old
  // sampler observed childList over the whole document and pushed
  // the CURRENT placement on any DOM mutation, so a latch state
  // set at any earlier time was logged as an in-window event.
  // This observer is seeded with the placement at arm time and
  // pushes only when data-holmes-placement actually changes.
  await page.evaluate(() => {
    const w = window as unknown as { __tapPlacements: string[] };
    w.__tapPlacements = [];
    const read = () => {
      const el =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      return el?.getAttribute("data-holmes-placement") ?? null;
    };
    let last = read();
    const obs = new MutationObserver(() => {
      const p = read();
      if (p !== last) {
        last = p;
        if (p) w.__tapPlacements.push(p);
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-holmes-placement"],
    });
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up(); // a tap: well under 250 ms, no travel
  // Remove the rest channel (round 1's fix, kept). Leaving the
  // mouse RESTING on the tap point for the whole sample window
  // would make the sustained dwell (460 ms pause-confirm + ≥350 ms
  // stillness), not the press, what berths him — the press itself
  // is invisible to the pause detector. Move far away immediately,
  // so the pointer does not dwell at the tap point during the
  // window. (The positive control stands elsewhere in this file:
  // berthAtDockNearPoint, used by the pinch/pan tests above,
  // proves a genuine pause at a point DOES berth.)
  await page.mouse.move(0, 0);
  // Sample the recorded transitions over the following ~1.2 s
  // (the measurement window — a berth would need only ~460 ms
  // to fire).
  await page.waitForTimeout(1200);
  const placements = await page.evaluate(
    () => (window as unknown as { __tapPlacements: string[] }).__tapPlacements,
  );
  console.log(
    `[K3 tap] settled=${settledPlacement} mounted=${settledCentre !== null} reference=(${Math.round(reference.x)},${Math.round(reference.y)}), tap at (${Math.round(point.x)},${Math.round(point.y)}), placement transitions during tap window: ${JSON.stringify(placements)}`,
  );
  // (a) The pin, valid from every settled state: the tap changed
  // nothing — no placement transition at all occurs in the window.
  expect(
    placements,
    "K3 tap: a tap must not cause any placement transition",
  ).toHaveLength(0);
  // (b) If he was mounted, he did not travel: his centre at the
  // window's end is within 8 px of the settled centre. (A wrapper
  // that vanished mid-window would already have failed (a) as a
  // placement transition, so a missing end rect needs no separate
  // assertion here.)
  if (settledCentre) {
    const endRect = await holmesRect(page);
    if (endRect) {
      const endCentre = {
        x: endRect.x + endRect.w / 2,
        y: endRect.y + endRect.h / 2,
      };
      expect(
        Math.hypot(endCentre.x - settledCentre.x, endCentre.y - settledCentre.y),
        "K3 tap: Holmes must not move toward the tap point",
      ).toBeLessThanOrEqual(8);
    }
  }
  const now = await currentPlacement(page);
  // (c) v2's preserved original assertion, generalised to every
  // non-berth settled state: if he did not settle berthed,
  // "berth" never appears in the window.
  if (settledPlacement !== "berth") {
    expect(placements).not.toContain("berth");
    expect(now, "K3 tap: a tap must not berth Holmes").not.toBe("berth");
  }
  // Final overall placement sanity (the original main-era pin,
  // generalised): he ends in the placement he settled in, or the
  // host is gone at teardown (null).
  expect(
    now === settledPlacement || now === null,
    `K3 tap: final placement ${JSON.stringify(now)} must equal the settled placement ${JSON.stringify(settledPlacement)} or be null at teardown`,
  ).toBe(true);
  // Dismiss the confirm sheet the tap opened, if it opened.
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
  }
});
