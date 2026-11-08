/**
 * companion.ts — the waypoint companion's pure logic (U6).
 *
 * Architecture (Senior Mechanics Engineer pattern): everything in this
 * module is a pure function or a small explicit state machine over
 * caller-supplied timestamps — no DOM, no React, no timers, no rAF.
 * DetectiveHost owns the environment (the ONE passive pointer listener
 * set, the timers that call `check`, the rAF deltas and long-task
 * events that feed the kill tracker) and renders what these functions
 * decide. That split is what makes the council Q2 behaviour unit-
 * testable in node with scripted traces, and what makes the swap test
 * (U10) honest: identical inputs → identical outputs, and the inputs
 * contain NO game data — only pointer kinematics and screen geometry
 * of things already visible to the player.
 *
 * Council Q2 numbers baked in here:
 * - pause: velocity < ~20 px/s AND displacement < 8 px sustained
 *   350 ms (desktop); touch: single finger, displacement < 6 px
 *   sustained 450 ms AND map still ≥ 250 ms.
 * - after a gesture cancel: no new pause until the map has been idle
 *   500 ms, then a fresh full pause is required.
 * - berth: centre ≥ 96 dp (touch) / ≥ 64 px (desktop) from the touch
 *   point; box's closest edge ≥ 56 dp from the touch centroid; always
 *   the half-plane ABOVE the finger; NW for right hand, NE mirrored
 *   for left; ≥ 120 dp clearance from every exclusion circle; pause
 *   point > 320 px from the dock → "remote"; no legal position →
 *   "hide". Overlap is NEVER the fallback.
 * - auto-kill: rolling 5 s FPS < 45 OR 3 long tasks > 100 ms within
 *   10 s → killed. The kill is NOT a session latch (staging close /
 *   berth cure, 2026-11-07): the tracker re-qualifies the companion
 *   after a sustained healthy window (rolling 5 s at ≥ 55 FPS with
 *   no long task — a hysteresis band above the 45 FPS kill line, so
 *   a borderline device does not flap), and the host additionally
 *   resets the tracker on every case change, so one bad case can
 *   never dock Holmes for a whole run. The diagnosis that forced
 *   this: the old latch fired under ordinary SEARCH-phase tile load
 *   and never cleared — 8/8 full case plays on the diagnosis rig
 *   ended killed (DIAGNOSIS-bench-at-close.md, defect 2).
 */

/* ------------------------------------------------------------------ */
/* Pause detector                                                      */
/* ------------------------------------------------------------------ */

export interface PointerSample {
  x: number;
  y: number;
  /** Caller clock, ms (monotonic — e.g. performance.now()). */
  t: number;
  pointerType: string;
  /** How many pointers are currently down (pinch detection upstream). */
  pointersDown: number;
}

export interface PauseDetector {
  /** Feed one pointer sample. Samples only RECORD; confirmation is
   * evaluated by `check`, because a truly still pointer emits no
   * further samples for `feed` to react to. */
  feed(sample: PointerSample): void;
  /** A gesture (pan / pinch / wheel) started: any candidate dies. */
  notifyGestureStart(): void;
  /** The gesture ended at time `t`: the 500 ms map-idle re-arm runs
   * from here, and a fresh full pause is required after it. */
  notifyGestureEnd(t: number): void;
  /** Evaluate the sustained-pause conditions at time `now`.
   * `mapStillMs` is the host-supplied time since the map last moved
   * (the touch rule needs the map motionless for the last 250 ms).
   * Returns the pause point exactly once per confirmed pause. */
  check(now: number, mapStillMs: number): { x: number; y: number } | null;
  reset(): void;
}

export const PAUSE_DESKTOP_MS = 350;
export const PAUSE_TOUCH_MS = 450;
export const PAUSE_DESKTOP_DISP_PX = 8;
export const PAUSE_TOUCH_DISP_PX = 6;
export const PAUSE_MAX_VELOCITY_PX_S = 20;
export const PAUSE_TOUCH_MAP_STILL_MS = 250;
export const GESTURE_REARM_MS = 500;
/** Velocity is judged as PATH length over the trailing pause window
 * (see `check`): a 1 px jitter step in one 16 ms frame is ~60 px/s
 * instantaneously but is not motion, while oscillating jitter travels
 * a long path while going nowhere — path rate separates the two. */

interface Candidate {
  anchorX: number;
  anchorY: number;
  startT: number;
  pointerType: string;
  /** Samples since the anchor, for the windowed velocity check. */
  trail: PointerSample[];
  confirmed: boolean;
}

export function createPauseDetector(): PauseDetector {
  let candidate: Candidate | null = null;
  /** No pause may confirm before this time (post-gesture re-arm). */
  let blockedUntil = -Infinity;
  let gesturing = false;

  const isTouch = (s: PointerSample) => s.pointerType === "touch";
  const dispLimit = (touch: boolean) =>
    touch ? PAUSE_TOUCH_DISP_PX : PAUSE_DESKTOP_DISP_PX;
  const durationNeeded = (touch: boolean) =>
    touch ? PAUSE_TOUCH_MS : PAUSE_DESKTOP_MS;

  function startCandidate(s: PointerSample): void {
    candidate = {
      anchorX: s.x,
      anchorY: s.y,
      startT: s.t,
      pointerType: s.pointerType,
      trail: [s],
      confirmed: false,
    };
  }

  return {
    feed(s: PointerSample) {
      if (gesturing) return;
      // A second finger (pinch) or a lifted finger ends candidacy:
      // the touch rule is single-finger only, and a desktop pause is a
      // hover (no buttons). A mouse sample WITH a button down is a
      // drag, not a thinking pause.
      if (s.pointersDown > 1) {
        candidate = null;
        return;
      }
      if (isTouch(s) && s.pointersDown !== 1) {
        candidate = null;
        return;
      }
      if (!isTouch(s) && s.pointersDown > 0) {
        candidate = null;
        return;
      }
      if (!candidate || candidate.pointerType !== s.pointerType) {
        startCandidate(s);
        return;
      }
      const dx = s.x - candidate.anchorX;
      const dy = s.y - candidate.anchorY;
      if (Math.hypot(dx, dy) >= dispLimit(isTouch(s))) {
        // Slid out of the stillness radius: the pause restarts here.
        startCandidate(s);
        return;
      }
      candidate.trail.push(s);
      // Keep the trail bounded to a little past the longest pause
      // window the check can read.
      const cutoff = s.t - PAUSE_TOUCH_MS - 350;
      while (candidate.trail.length > 2 && candidate.trail[0]!.t < cutoff) {
        candidate.trail.shift();
      }
    },

    notifyGestureStart() {
      gesturing = true;
      candidate = null;
    },

    notifyGestureEnd(t: number) {
      gesturing = false;
      candidate = null;
      blockedUntil = t + GESTURE_REARM_MS;
    },

    check(now: number, mapStillMs: number) {
      if (gesturing || !candidate || candidate.confirmed) return null;
      const touch = candidate.pointerType === "touch";
      const need = durationNeeded(touch);
      // The pause must be fully sustained AFTER any post-gesture
      // re-arm: the evidence window is the trailing `need` ms, and it
      // must start no earlier than the re-arm boundary.
      const effectiveStart = Math.max(candidate.startT, blockedUntil);
      if (now - effectiveStart < need) return null;
      if (touch && mapStillMs < PAUSE_TOUCH_MAP_STILL_MS) return null;
      // Path velocity over the evidence window: sum the actual
      // distance travelled between samples, not just net drift. A
      // still hand travels ~0 px; a slow drift under 20 px/s travels
      // little; oscillating jitter travels a lot while going nowhere
      // — path length is what separates them. The trail's last sample
      // may be old (a still pointer emits nothing new), which is
      // itself the sustained-stillness evidence.
      const from = now - need;
      let startSample = candidate.trail[0]!;
      for (const p of candidate.trail) {
        if (p.t <= from) startSample = p;
        else break;
      }
      let path = 0;
      let prev = startSample;
      for (const p of candidate.trail) {
        if (p.t <= from) continue;
        path += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
      }
      const last = candidate.trail[candidate.trail.length - 1]!;
      const spanMs = last.t - startSample.t;
      if (spanMs > 0 && (path / spanMs) * 1000 >= PAUSE_MAX_VELOCITY_PX_S) {
        return null;
      }
      candidate.confirmed = true;
      return { x: candidate.anchorX, y: candidate.anchorY };
    },

    reset() {
      candidate = null;
      gesturing = false;
      blockedUntil = -Infinity;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Berth solver                                                        */
/* ------------------------------------------------------------------ */

export interface ExclusionCircle {
  x: number;
  y: number;
  r: number;
}

export interface BerthInput {
  pausePoint: { x: number; y: number };
  /** Holmes's rendered box size (px). */
  holmesBox: { w: number; h: number };
  viewport: { w: number; h: number };
  /** The dock position (Holmes box's top-left when docked), same
   * coordinate space as pausePoint. */
  dock: { x: number; y: number };
  /** Screen-px circles around things already visible to the player
   * (their own guess markers / pin element). Geometry only — the
   * solver neither knows nor cares what they represent. */
  exclusions: ExclusionCircle[];
  pointerType: string;
  /** "right" berths NW of the point, "left" mirrors to NE. The host
   * derives it from the pause x vs the viewport midline unless it
   * knows the player's hand another way. */
  handSide: "left" | "right";
}

export type BerthResult =
  | { kind: "berth"; x: number; y: number }
  | { kind: "remote" }
  | { kind: "hide" };

export const BERTH_TOUCH_CENTRE_MIN = 96;
export const BERTH_DESKTOP_CENTRE_MIN = 64;
export const BERTH_EDGE_MIN = 56;
/**
 * Render margin (px) added to the legal minimums INSIDE the solver.
 * The constants above are the council's law, and the law judges the
 * RENDERED box — but two small losses sit between the solver's model
 * and the screen: the box origin is rounded to whole px (≤0.71 px of
 * centre drift), and the host's rendered rect sits +1/+1 px from the
 * solved transform (measured by the U10 K2 audit's transform-vs-rect
 * diagnostic). Solving to the bare minimum therefore rendered as low
 * as 94.3 px centre / 55.3 px edge on the touch grid — a real breach
 * of the law the player sees. The solver now aims 3 px past the law
 * so the rendered berth honours it; the law itself is unchanged.
 */
const RENDER_MARGIN_PX = 3;
export const BERTH_EXCLUSION_CLEARANCE = 120;
export const BERTH_REMOTE_DISTANCE = 320;
/** Candidate offsets are scanned on this grid (px) — coarse enough to
 * stay deterministic and cheap, fine enough to find legal berths in
 * tight corners. */
const SCAN_STEP = 8;
/** How far out (centre distance, px) the scan looks for a berth. */
const SCAN_MAX_CENTRE = 280;

export function berthFor(input: BerthInput): BerthResult {
  const { pausePoint, holmesBox, viewport, dock, exclusions } = input;
  const touch = input.pointerType === "touch";
  const centreMin =
    (touch ? BERTH_TOUCH_CENTRE_MIN : BERTH_DESKTOP_CENTRE_MIN) +
    RENDER_MARGIN_PX;

  // Remote rule first: a pause far from home is not worth crossing
  // the map for — he stays docked and thinks there.
  const dockCentre = {
    x: dock.x + holmesBox.w / 2,
    y: dock.y + holmesBox.h / 2,
  };
  if (
    Math.hypot(pausePoint.x - dockCentre.x, pausePoint.y - dockCentre.y) >
    BERTH_REMOTE_DISTANCE
  ) {
    return { kind: "remote" };
  }

  const halfW = holmesBox.w / 2;
  const halfH = holmesBox.h / 2;

  const legal = (cx: number, cy: number): boolean => {
    // Centre distance from the touch point.
    if (Math.hypot(cx - pausePoint.x, cy - pausePoint.y) < centreMin) {
      return false;
    }
    // Above the finger, strictly: centre above the point.
    if (cy >= pausePoint.y) return false;
    // Closest box edge ≥ 56 dp from the touch centroid.
    const dxEdge = Math.max(Math.abs(pausePoint.x - cx) - halfW, 0);
    const dyEdge = Math.max(Math.abs(pausePoint.y - cy) - halfH, 0);
    if (Math.hypot(dxEdge, dyEdge) < BERTH_EDGE_MIN + RENDER_MARGIN_PX) return false;
    // On screen, fully.
    if (cx - halfW < 0 || cy - halfH < 0) return false;
    if (cx + halfW > viewport.w || cy + halfH > viewport.h) return false;
    // Exclusions: centre-to-centre ≥ exclusion radius + 120 dp.
    for (const ex of exclusions) {
      if (
        Math.hypot(cx - ex.x, cy - ex.y) <
        ex.r + BERTH_EXCLUSION_CLEARANCE
      ) {
        return false;
      }
    }
    return true;
  };

  // Scan outward from the ideal berth: directly above at the minimum
  // centre distance, biased toward the hand side (NW right / NE
  // left). Deterministic order: increasing centre distance, then the
  // hand-side direction first — identical inputs, identical result.
  const sideSign = input.handSide === "right" ? -1 : 1;
  let best: { x: number; y: number; score: number } | null = null;
  for (
    let dist = centreMin;
    dist <= SCAN_MAX_CENTRE;
    dist += SCAN_STEP
  ) {
    // Angles in the upper half-plane, hand side first: start at
    // straight up, sweep toward the hand side, then the other side.
    for (let step = 0; step <= 16; step++) {
      const frac = step / 16; // 0 = up, 1 = horizontal
      for (const sgn of [sideSign, -sideSign]) {
        if (step === 0 && sgn !== sideSign) continue;
        const ang = (frac * Math.PI) / 2; // 0..90° from vertical
        const cx = pausePoint.x + sgn * Math.sin(ang) * dist;
        const cy = pausePoint.y - Math.cos(ang) * dist;
        if (!legal(cx, cy)) continue;
        // Prefer: hand side, then mostly-above, then near the minimum
        // distance (the scan order already ascends distance).
        const sideBonus = Math.sign(cx - pausePoint.x) === sideSign ? 0 : 1;
        const score = sideBonus * 1000 + frac;
        if (!best || score < best.score) {
          best = { x: cx - halfW, y: cy - halfH, score };
        }
      }
    }
    if (best) break; // nearest distance ring with any legal berth wins
  }
  if (best === null) return { kind: "hide" };
  const found: { x: number; y: number } = best;
  return { kind: "berth", x: Math.round(found.x), y: Math.round(found.y) };
}

/* ------------------------------------------------------------------ */
/* Auto-kill accumulator                                               */
/* ------------------------------------------------------------------ */

export interface AutoKillTracker {
  /** Feed one rendered frame's duration (ms) ending at time `t`.
   * Feeding CONTINUES while killed — that is how re-qualification
   * is judged — so the host must keep feeding in SEARCH phases
   * even after a kill. */
  feedFrame(durationMs: number, t: number): void;
  /** Feed one long-task event: `durationMs` ending at time `t`.
   * While killed, a long task does not change the kill reason; it
   * restarts the healthy window re-qualification is judged on. */
  feedLongTask(durationMs: number, t: number): void;
  /** Clear the kill and every window (host: on case change). */
  reset(): void;
  readonly killed: boolean;
  /** Why the kill fired (for the host's console line), once killed. */
  readonly killReason: "fps" | "longtask" | null;
  /** How many times the tracker has re-qualified after a kill. */
  readonly requalifiedCount: number;
}

export const KILL_FPS_WINDOW_MS = 5000;
export const KILL_FPS_MIN = 45;
export const KILL_LONGTASK_MS = 100;
export const KILL_LONGTASK_COUNT = 3;
export const KILL_LONGTASK_WINDOW_MS = 10000;
/** FPS is judged only once at least this much frame history exists —
 * a single slow first frame is a load hiccup, not a trend. */
const KILL_FPS_MIN_SPAN_MS = 1000;
/** Re-qualification (berth cure): after a kill, the companion earns
 * its way back only on a SUSTAINED healthy window — a full rolling
 * 5 s (the kill window's own length) of frames at ≥ 55 FPS with no
 * long task inside it. 55 is deliberately above the 45 FPS kill
 * line: the 10 FPS band is hysteresis, so a device hovering at the
 * kill line stays docked instead of flapping dock/berth. */
export const REQUALIFY_FPS_MIN = 55;
export const REQUALIFY_SUSTAIN_MS = 5000;

export function createAutoKillTracker(): AutoKillTracker {
  let killed = false;
  let killReason: "fps" | "longtask" | null = null;
  let requalifiedCount = 0;
  /** Frame end timestamps inside the rolling window. */
  let frameEnds: number[] = [];
  /** End timestamps of long tasks (> 100 ms) inside their window. */
  let longTaskEnds: number[] = [];
  /** Frame end timestamps since the kill, pruned to the
   * re-qualification window: the healthy evidence. Cleared by any
   * long task, so the sustain must be one unbroken healthy run. */
  let healthyFrameEnds: number[] = [];

  return {
    feedFrame(_durationMs: number, t: number) {
      if (killed) {
        // Re-qualification judging: keep only the trailing sustain
        // window; a full window at a healthy rate resurrects.
        healthyFrameEnds.push(t);
        const hCutoff = t - REQUALIFY_SUSTAIN_MS;
        healthyFrameEnds = healthyFrameEnds.filter((e) => e > hCutoff);
        if (healthyFrameEnds.length >= 2) {
          const spanMs = t - healthyFrameEnds[0]!;
          const fps = ((healthyFrameEnds.length - 1) / spanMs) * 1000;
          if (spanMs >= REQUALIFY_SUSTAIN_MS - 100 && fps >= REQUALIFY_FPS_MIN) {
            killed = false;
            killReason = null;
            requalifiedCount += 1;
            frameEnds = [];
            longTaskEnds = [];
            healthyFrameEnds = [];
          }
        }
        return;
      }
      frameEnds.push(t);
      const cutoff = t - KILL_FPS_WINDOW_MS;
      frameEnds = frameEnds.filter((e) => e > cutoff);
      if (frameEnds.length < 2) return;
      const spanMs = t - frameEnds[0]!;
      if (spanMs < KILL_FPS_MIN_SPAN_MS) return;
      // Frames per second across the observed span, capped at the
      // nominal 5 s window: with a full window span ≈ 5000 ms.
      const fps = ((frameEnds.length - 1) / spanMs) * 1000;
      if (fps < KILL_FPS_MIN) {
        killed = true;
        killReason = "fps";
      }
    },
    feedLongTask(durationMs: number, t: number) {
      if (durationMs <= KILL_LONGTASK_MS) return;
      if (killed) {
        // A long task breaks the healthy run: re-qualification's
        // sustain restarts from here.
        healthyFrameEnds = [];
        return;
      }
      longTaskEnds.push(t);
      const cutoff = t - KILL_LONGTASK_WINDOW_MS;
      longTaskEnds = longTaskEnds.filter((e) => e > cutoff);
      if (longTaskEnds.length >= KILL_LONGTASK_COUNT) {
        killed = true;
        killReason = "longtask";
      }
    },
    reset() {
      killed = false;
      killReason = null;
      frameEnds = [];
      longTaskEnds = [];
      healthyFrameEnds = [];
    },
    get killed() {
      return killed;
    },
    get killReason() {
      return killReason;
    },
    get requalifiedCount() {
      return requalifiedCount;
    },
  };
}
