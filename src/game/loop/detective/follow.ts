/**
 * follow.ts — Holmes's proximity-follow solver (Pair Behaviour PR 1).
 *
 * Why this module exists: the owner played the shipped waypoint
 * companion and named its core behaviour a bug — Holmes walked to a
 * pause point on the map, then walked BACK to a home dock on the next
 * gesture. The follow model replaces that wholesale: Holmes travels
 * to the pointer's last neighbourhood ANYWHERE on the page and STAYS
 * there. There is no home, no dock-return, and no remote rule in this
 * module — positional memory lives in the host's ref and survives
 * case changes, phase exits, and bursts.
 *
 * Everything here is pure: viewport geometry in, a berth out. The
 * inputs are screen geometry of things already visible to the player
 * (the same answer-blindness discipline as companion.ts) — never game
 * data. DetectiveHost owns the environment: window pointer listeners
 * writing to refs, the forbidden-rect cache, the timers.
 *
 * The solve (Game Developer seat, BUILD-pair-behaviour-report §2):
 * - 8 candidate berths ring the pointer at the park offset, scored
 *   zero-forbidden-intersection first, then least distance from the
 *   park ring, then same-side hysteresis (he prefers to stay on the
 *   side of the pointer he is already on — no gratuitous crossings).
 * - The figure's box must clear every forbidden rect by the clearance
 *   bubble (>= 64 px touch / >= 48 px desktop from the pointer, and
 *   no intersection with a forbidden rect at all).
 * - Fallback is the nearest valid edge perch. NEVER a dock: if no
 *   perch is legal either, the solver returns null and the host keeps
 *   Holmes exactly where he already is.
 *
 * Tiers (ONE solver, tiered degradation): PAGE_FOLLOW solves on
 * pointer displacement/dwell; PAUSE_BERTH solves only on a confirmed
 * thinking pause (companion.ts's detector) but is still page-wide and
 * still stays; DOCK_ONLY pins the solver to a fixed viewport perch
 * (the perf bottom tier — a place he sits, not a place he returns
 * to). The tier machine steps DOWN on an auto-kill verdict and back
 * UP at case-open re-qualification probes, following the #362
 * pattern: a kill is a verdict until proven healthy, never a life
 * sentence.
 */

export interface ForbiddenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FollowInput {
  /** The pointer's last position, viewport coordinates. */
  pointer: { x: number; y: number };
  /** Holmes's rendered box size (px). */
  holmesBox: { w: number; h: number };
  viewport: { w: number; h: number };
  /** Rects Holmes may never overlap: clue card, question text,
   * Watson's cluster, header/controls, result card, pin + rings.
   * Cached by the host on resize/scroll/clue-change — never measured
   * in the pointer hot path. */
  forbidden: ForbiddenRect[];
  pointerType: string;
  /** Holmes's current centre (positional memory), for the
   * same-side hysteresis term. Null on first placement. */
  currentCentre: { x: number; y: number } | null;
}

export interface FollowBerth {
  /** Top-left of Holmes's box, viewport coordinates. */
  x: number;
  y: number;
  /** "ring" = a scored candidate around the pointer; "perch" = the
   * edge fallback. */
  kind: "ring" | "perch";
}

/** Park offset: the figure's CENTRE sits in this band from the
 * pointer (owner/council: 80–100 px). */
export const PARK_OFFSET_MIN_PX = 80;
export const PARK_OFFSET_MAX_PX = 100;
const PARK_OFFSET_TARGET_PX = 90;
/** Clearance bubble: the figure's box stays at least this far from
 * the pointer itself (>= 64 px touch / >= 48 px desktop), so a
 * resting finger or cursor never sits under the figure. */
export const CLEARANCE_TOUCH_PX = 64;
export const CLEARANCE_DESKTOP_PX = 56; // K2 edge law (companion gates)
/** Render margin (K2 cure, PR #364): legality is judged ABOVE the
 * law by this much, because a solve must honour the law AFTER the
 * host renders it — solveFollow rounds the box to whole px
 * (<= 0.5 px/axis) and the spec's anchor can sit up to ~2.24 px
 * from the solver's anchor, a worst-case stack of ~2.8 px. Without
 * the margin a candidate whose continuous edge is exactly the law
 * (56.000) renders as low as ~55.3 px edge and fails K2 as a
 * SETTLED violation. Precedent: the pre-PB-1 solver on main
 * (companion.ts berthFor) carried exactly this +3 px margin —
 * centre floor = law + 3, edge rejection at < law + 3 — with a
 * comment documenting this same failure mode; PB-1 dropped it. */
export const RENDER_MARGIN_PX = 3;
/** Solve triggers (host-enforced, named here so tests pin them):
 * solve on >= 32 px displacement from the last solved pointer, or
 * >= 150 ms of dwell; at most one solve per 100 ms. */
export const FOLLOW_SOLVE_DISPLACEMENT_PX = 32;
export const FOLLOW_SOLVE_DWELL_MS = 150;
export const FOLLOW_SOLVE_MIN_INTERVAL_MS = 100;
/** Head-turn telegraph before a walk starts (~120 ms), and the
 * camera-idle delay before a queued target applies. */
export const FOLLOW_TELEGRAPH_MS = 120;
export const FOLLOW_CAMERA_IDLE_MS = 120;
/** Travel: one translate3d transition, duration by distance,
 * clamped to this band. */
export const FOLLOW_TRAVEL_MIN_MS = 300;
export const FOLLOW_TRAVEL_MAX_MS = 800;

export function followTravelMs(distancePx: number): number {
  // ~450 px/s, clamped into the 0.3–0.8 s band.
  const raw = (distancePx / 450) * 1000;
  return Math.round(
    Math.min(FOLLOW_TRAVEL_MAX_MS, Math.max(FOLLOW_TRAVEL_MIN_MS, raw)),
  );
}

function boxIntersectsForbidden(
  x: number,
  y: number,
  w: number,
  h: number,
  forbidden: ForbiddenRect[],
): boolean {
  for (const r of forbidden) {
    if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) {
      return true;
    }
  }
  return false;
}

function legal(
  cx: number,
  cy: number,
  input: FollowInput,
  clearance: number,
): boolean {
  const { holmesBox, viewport, pointer, forbidden } = input;
  const x = cx - holmesBox.w / 2;
  const y = cy - holmesBox.h / 2;
  // Fully on screen.
  if (x < 0 || y < 0) return false;
  if (x + holmesBox.w > viewport.w || y + holmesBox.h > viewport.h) return false;
  // Clearance bubble around the pointer: the box's closest edge must
  // stay at least `clearance` px away from the pointer point.
  const dxEdge = Math.max(Math.abs(pointer.x - cx) - holmesBox.w / 2, 0);
  const dyEdge = Math.max(Math.abs(pointer.y - cy) - holmesBox.h / 2, 0);
  if (Math.hypot(dxEdge, dyEdge) < clearance + RENDER_MARGIN_PX) return false;
  // Zero intersection with forbidden rects — the text-coverage law.
  if (boxIntersectsForbidden(x, y, holmesBox.w, holmesBox.h, forbidden)) {
    return false;
  }
  return true;
}

/**
 * Solve Holmes's next berth for a pointer position. Returns null
 * when nothing legal exists — the host then keeps his current
 * position (staying is always legal; returning "home" is not a
 * concept here).
 */
export function solveFollow(input: FollowInput): FollowBerth | null {
  const { pointer, holmesBox, currentCentre } = input;
  const clearance =
    input.pointerType === "touch" ? CLEARANCE_TOUCH_PX : CLEARANCE_DESKTOP_PX;
  // The centre must sit far enough out that the box can honour the
  // clearance bubble: at least clearance + the box's half-diagonal
  // is overkill; clearance + half the smaller dimension is the honest
  // floor, and the park band (80–100) already exceeds it on desktop.
  // We scan the park band outward in small steps until a ring of
  // candidates turns up a legal berth.
  const minCentre = Math.max(
    PARK_OFFSET_MIN_PX,
    clearance + RENDER_MARGIN_PX + Math.min(holmesBox.w, holmesBox.h) / 2,
  );
  const maxCentre = 260;
  const prevSideX = currentCentre
    ? Math.sign(currentCentre.x - pointer.x)
    : 0;
  const prevSideY = currentCentre
    ? Math.sign(currentCentre.y - pointer.y)
    : 0;

  for (let dist = minCentre; dist <= maxCentre; dist += 8) {
    let best: { cx: number; cy: number; score: number } | null = null;
    // 8 candidates: the compass + diagonal ring.
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const cx = pointer.x + Math.cos(ang) * dist;
      const cy = pointer.y + Math.sin(ang) * dist;
      if (!legal(cx, cy, input, clearance)) continue;
      // Score: distance from the park target first, then same-side
      // hysteresis (staying on his current side of the pointer is
      // cheaper than crossing over it).
      const parkErr = Math.abs(dist - PARK_OFFSET_TARGET_PX);
      const crossX =
        prevSideX !== 0 && Math.sign(cx - pointer.x) !== prevSideX ? 1 : 0;
      const crossY =
        prevSideY !== 0 && Math.sign(cy - pointer.y) !== prevSideY ? 1 : 0;
      const score = parkErr * 10 + (crossX + crossY) * 4;
      if (!best || score < best.score) best = { cx, cy, score };
    }
    if (best) {
      return {
        x: Math.round(best.cx - holmesBox.w / 2),
        y: Math.round(best.cy - holmesBox.h / 2),
        kind: "ring",
      };
    }
  }

  // Fallback: nearest valid edge perch — scan the viewport edges
  // (inset by 8 px) for the legal spot closest to the pointer. This
  // is a perch for THIS solve, not a home: the next solve rings the
  // pointer again.
  const inset = 8;
  const perchSpots: { x: number; y: number }[] = [];
  const xs = [inset, input.viewport.w - holmesBox.w - inset];
  const ys = [inset, input.viewport.h - holmesBox.h - inset];
  for (const x of xs) {
    for (let y = inset; y <= input.viewport.h - holmesBox.h - inset; y += 16) {
      perchSpots.push({ x, y });
    }
  }
  for (const y of ys) {
    for (let x = inset; x <= input.viewport.w - holmesBox.w - inset; x += 16) {
      perchSpots.push({ x, y });
    }
  }
  let bestPerch: { x: number; y: number; d: number } | null = null;
  for (const s of perchSpots) {
    const cx = s.x + holmesBox.w / 2;
    const cy = s.y + holmesBox.h / 2;
    if (!legal(cx, cy, input, clearance)) continue;
    const d = Math.hypot(cx - pointer.x, cy - pointer.y);
    if (!bestPerch || d < bestPerch.d) bestPerch = { x: s.x, y: s.y, d };
  }
  if (bestPerch) return { x: bestPerch.x, y: bestPerch.y, kind: "perch" };
  return null;
}

/** The DOCK_ONLY tier's fixed perch: bottom-left of the viewport,
 * inset like the old dock but in viewport space. A place he sits —
 * the tier pins him here; nothing ever "returns" him here from a
 * berth, because the tier never berths. */
export function dockPerch(
  holmesBox: { w: number; h: number },
  viewport: { w: number; h: number },
): { x: number; y: number } {
  return {
    x: 12,
    y: Math.max(0, viewport.h - 12 - holmesBox.h),
  };
}

/* ------------------------------------------------------------------ */
/* Tier machine                                                        */
/* ------------------------------------------------------------------ */

export type FollowTier = "PAGE_FOLLOW" | "PAUSE_BERTH" | "DOCK_ONLY";

export interface FollowTierMachine {
  readonly tier: FollowTier;
  /** The tier the flag + degradation matrix ask for, before any
   * perf step-down: flag ON + healthy device = PAGE_FOLLOW; flag
   * OFF = PAUSE_BERTH (page-wide, stays); resource-constrained
   * device = DOCK_ONLY. */
  readonly baseTier: FollowTier;
  /** An auto-kill verdict landed: step one tier down. */
  stepDown(): FollowTier;
  /** Case-open re-qualification probe: the device just proved a
   * healthy window (or the case changed, per the #362 pattern), so
   * step back UP toward the base tier — never above it. */
  requalify(): FollowTier;
  /** Re-derive from flag + degradation (both may change at boot). */
  setBase(tier: FollowTier): FollowTier;
}

export function baseTierFor(input: {
  followFlagOn: boolean;
  dockOnlyDevice: boolean;
}): FollowTier {
  if (input.dockOnlyDevice) return "DOCK_ONLY";
  return input.followFlagOn ? "PAGE_FOLLOW" : "PAUSE_BERTH";
}

const TIER_ORDER: FollowTier[] = ["PAGE_FOLLOW", "PAUSE_BERTH", "DOCK_ONLY"];

export function createFollowTierMachine(base: FollowTier): FollowTierMachine {
  let baseTier = base;
  let tier = base;
  const clampToBase = () => {
    if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(baseTier)) {
      tier = baseTier;
    }
  };
  return {
    get tier() {
      return tier;
    },
    get baseTier() {
      return baseTier;
    },
    stepDown() {
      const i = TIER_ORDER.indexOf(tier);
      if (i < TIER_ORDER.length - 1) tier = TIER_ORDER[i + 1]!;
      return tier;
    },
    requalify() {
      const i = TIER_ORDER.indexOf(tier);
      if (i > TIER_ORDER.indexOf(baseTier)) tier = TIER_ORDER[i - 1]!;
      return tier;
    },
    setBase(next: FollowTier) {
      baseTier = next;
      clampToBase();
      // A base drop (device reclassified dock-only) applies at once.
      if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(baseTier)) {
        tier = baseTier;
      }
      return tier;
    },
  };
}
