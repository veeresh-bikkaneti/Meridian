/**
 * Zoom/projection state machine ("zoom-space") — pure core + thin-adapter contract.
 *
 * One controller, one zoom axis: projection follows zoom continuously, so the
 * player can zoom out to an Earth-from-space view in every edition (State,
 * Country, Globe), with a spinning-globe intro that narrows onto the picked
 * region and settles at a comfortable regional framing.
 *
 * This module is intentionally pure — no MapLibre imports, no DOM — so the
 * transition logic is unit-testable in node like `tile-status.ts`. It receives
 * snapshots `{zoom, projection, center?}`, the edition, and the resolved
 * region geometry as a DTO, and emits a CLOSED vocabulary of intents (below).
 * The thin adapter in `satellite-map.tsx` executes intents against the live map.
 * The pure core NEVER imports `regions.ts`, topojson, or MapLibre: the
 * game→map dependency direction stays clean.
 *
 * --- States (derived from (projection, edition) + the narrow latch) ---
 *   INTRO   any edition, before requestNarrow — globe, zoom locked 1.0
 *   REGION  state/country, mercator — NO absolute zoom floor; T_OUT is
 *           direction-gated, not positional (large countries settle < 2.2)
 *   SPACE   state/country, globe, zoom < Z_FLAT_IN
 *   GLOBE   globe edition — thresholds inert for the whole run
 * Beats are orthogonal flags, not states: `beatActive` + `beatKind`
 * ("spin" | "narrow" | "pullback" | "settle" | "relock"), plus the terminal
 * latch `revealDone`.
 *
 * --- Thresholds (hysteresis band [2.2, 3.2]: hold, no swap either way) ---
 *   Z_GLOBE_OUT = 2.2, Z_FLAT_IN = 3.2
 *   T_OUT (REGION→SPACE): on zoomend, user gesture only (!beatActive,
 *     !revealDone), mercator, flat edition, AND the gesture zoomed OUT:
 *     endZoom < gestureStartZoom && endZoom < 2.2. `gestureStartZoom` is
 *     latched from the first onMove snapshot of a gesture (the adapter's
 *     existing single `move` listener — no new listener; the controller
 *     detects the settled→moving transition internally and clears the latch
 *     on gesture completion). The direction gate fixes the wrong-direction
 *     fire: a zoom-IN pinch from a sub-2.2 settle (USA ≈ z1.8–2.05) never
 *     fires T_OUT. Known limitation: the latch reads the gesture's FIRST
 *     move frame — if that frame already reflects the end zoom (a fast
 *     fling), the direction comparison sees no zoom-out and T_OUT misses;
 *     accepted trade-off, since `<=` would misfire T_OUT on pans.
 *   T_IN (SPACE→REGION): on zoomend, user gesture only, globe, flat edition,
 *     zoom > 3.2 → starts the `relock` beat.
 *
 * --- Closed intent vocabulary (the only things this module may emit) ---
 *   set-projection {projection: "globe" | "mercator"} — adapter gates on map.isStyleLoaded()
 *   set-max-bounds {bounds: [w,s,e,n] | null}
 *   gestures {enabled: boolean} — adapter maps to individual map.<handler>.enable()/disable()
 *   tap-handlers {enabled: boolean} — adapter attaches/detaches the DOM pointer listeners
 *   fly-to {center, zoom, bearing, durationMs, easing: "easeInOutCubic"}
 *   ease-to {center, zoom?, bearing?, durationMs, easing: "easeInOutCubic"}
 *   jump-to {center, zoom}
 *   paint-highlight {feature: RegionGeometryDTO} / clear-highlight
 *   paint-variation {variation: unknown} / clear-variation — variation payload is opaque
 *     to the controller; the adapter casts it to its own Variation type
 *   rearm-tiles — adapter dispatches {type:"retry"} + restarts the tile-phase watchdog
 *   a11y-intro {active: boolean} — adapter toggles aria-hidden + inert on the wrapper
 *   announce {message} — adapter posts to the M10 live region
 *   spin {active: boolean, speedDps?: number} — adapter owns the rAF loop + 1200 ms
 *     timer; speedDps defaults to the passed value, the adapter never hardcodes a speed
 *   reveal-hold {durationMs: number} — adapter arms a one-shot hold timer, then
 *     calls onRevealHoldTimer()
 *
 * --- Adapter contract (satellite-map.tsx) ---
 * - Forward every map `move` to `onMove({zoom, projection, center})` on the ONE
 *   existing move listener (no new listener): it carries the T_OUT latch and
 *   the narrow-in crossing detection. Forward `zoomend`→onZoomEnd,
 *   `moveend`→onMoveEnd with the same snapshot shape.
 * - Spin: on `spin {active: true}` start the rAF loop
 *   (`map.setBearing(bearing + dt * speedDps)`) and arm the SPIN_DURATION_MS
 *   timer; on expiry call `onSpinTimer()` (chains into the narrow beat). On
 *   `spin {active: false}` stop the loop and clear the timer. NOTE: each
 *   setBearing fires a synchronous moveend (jumpTo path) — those arrive while
 *   beatKind is "spin" and are ignored by the controller.
 * - Reveal hold: on the `reveal-hold` intent, arm the REVEAL_HOLD_MS timer;
 *   on expiry call `onRevealHoldTimer()` (starts the settle beat). Skipped
 *   under reduced motion (the controller jumps instead).
 * - Narrow beat style load: set-projection throws before style load, so the
 *   adapter gates every projection swap on `map.isStyleLoaded()`, deferring
 *   to the style `load` event. Camera intents are transform-only and must NOT
 *   be gated on style load: gating jump-to caused a never-fires race in the
 *   reduced-motion intro (the intent is emitted synchronously after
 *   `new Map()`; the deferred `once("load")` handler never ran and the map
 *   stayed at zoom 1 while the live region announced the region view).
 *   fly-to/ease-to keep their historical gate — they fire ~1200 ms into the
 *   intro when the style is loaded in practice, and that path is verified.
 * - Gate every set-projection on `map.isStyleLoaded()` (it throws otherwise);
 *   treat set-projection as idempotent (a redundant swap is a no-op).
 * - The controller updates its tracked projection optimistically when it emits
 *   a swap; adapter-reported snapshots are the truth and reconverge tracking.
 * - Relock beat: T_IN fires at the gesture's zoomend, BEFORE the gesture's
 *   trailing moveend. The controller consumes that trailing moveend via the
 *   still-latched gestureStartZoom (returns []), so the beat completes only on
 *   the ease's own moveend — the maxBounds lock can never land mid-ease and snap.
 *
 * --- Surface notes (reconciled with design Appendix R3) ---
 * - Edition + prefersReducedMotion are constructor options (per-run
 *   invariants); requestNarrow takes (region, settleZoom). settleZoom is an
 *   adapter-computed input (min(fitZoom(bounds, 15% padding), cap)) because
 *   the swap timing is a function of it and the pure core has no viewport.
 * - Reveal: `requestReveal(request)` takes one DTO carrying the choreography
 *   inputs (pin/spot, settle framing, tileFailed, projection) plus the
 *   opaque variation payload. The CONTROLLER classifies "big miss" from
 *   pin/spot geometry (design §6: pin→spot > 500 km, or > 1.5 × the region's
 *   greater side in km), so the choreography rule cannot drift between call
 *   sites. `clearReveal()` is the ungated clear-variation path.
 * - Reveal hold: the `reveal-hold {durationMs}` intent arms the hold-timer
 *   half of the spin-timer pattern (design §6 hold has no other controller
 *   surface); on expiry the adapter calls `onRevealHoldTimer()`.
 * - paint-highlight is emitted at narrow completion (not at 70% of the beat):
 *   one fewer timer input; the 700 ms paint transition still lands the
 *   highlight as the camera settles ("narrow → highlight → stop").
 */

import type {
  LngLat,
  RegionBounds,
  RegionGeometryDTO,
} from "./region-index.ts";
// Big-miss predicate reuses the existing game helpers (design §6): one
// source of truth shared with the scoring radius. Precedent: globe-mesh.ts
// and paint-scene.ts already import runtime values from ../game/.
import { distanceKm } from "../game/geo.ts";
import { greaterSideKm } from "../game/regions.ts";

/** T_OUT arm: REGION→SPACE release fires only below this zoom (and zooming out). */
export const Z_GLOBE_OUT = 2.2;
/** T_IN arm: SPACE→REGION relock fires only above this zoom. */
export const Z_FLAT_IN = 3.2;
/** Intro spin speed, degrees/second — one stately revolution per minute. Tunable in QA. */
export const SPIN_SPEED_DPS = 6;
/** Adapter arms this timer on `spin {active: true}`; expiry → onSpinTimer(). */
export const SPIN_DURATION_MS = 1200;
/** Narrow-in flyTo duration. */
export const NARROW_DURATION_MS = 2400;
/** Relock ease duration (center already outside bounds → ease home first). */
export const RELOCK_DURATION_MS = 600;
/** Big-miss pull-back ease duration. */
export const PULLBACK_DURATION_MS = 1400;
/** Settle pause between pull-back and the reveal framing; skipped under reduced motion. */
export const REVEAL_HOLD_MS = 500;
/** Reveal settle (existing M8 fitBounds beat) duration. */
export const REVEAL_SETTLE_DURATION_MS = 2200;
/** Big-miss predicate (design §6): pin→spot farther than this is always a big miss. */
const BIG_MISS_KM = 500;
/** Big-miss predicate (design §6): …or farther than this × the region's greater side. */
const BIG_MISS_REGION_RATIO = 1.5;
/** Globe-edition home framing (degenerate narrow-in target). */
export const GLOBE_HOME: { readonly center: LngLat; readonly zoom: number } = {
  center: [0, 0],
  zoom: 1.5,
};

export type ZoomSpaceState = "INTRO" | "REGION" | "SPACE" | "GLOBE";
export type BeatKind = "spin" | "narrow" | "pullback" | "settle" | "relock";
export type ProjectionType = "globe" | "mercator";
export type ZoomSpaceEdition = "state" | "country" | "globe";

export interface ZoomSnapshot {
  zoom: number;
  projection: ProjectionType;
  /** [lon, lat] — forwarded when cheap (map.getCenter().toArray()); last-known wins. */
  center?: LngLat;
}

export type ZoomSpaceIntent =
  | { type: "set-projection"; projection: ProjectionType }
  | { type: "set-max-bounds"; bounds: RegionBounds | null }
  | { type: "gestures"; enabled: boolean }
  | { type: "tap-handlers"; enabled: boolean }
  | {
      type: "fly-to";
      center: LngLat;
      zoom: number;
      bearing: number;
      durationMs: number;
      easing: "easeInOutCubic";
    }
  | {
      type: "ease-to";
      center: LngLat;
      zoom?: number;
      bearing?: number;
      durationMs: number;
      easing: "easeInOutCubic";
    }
  | { type: "jump-to"; center: LngLat; zoom: number }
  | { type: "paint-highlight"; feature: RegionGeometryDTO }
  | { type: "clear-highlight" }
  | { type: "paint-variation"; variation: unknown }
  | { type: "clear-variation" }
  | { type: "rearm-tiles" }
  | { type: "a11y-intro"; active: boolean }
  | { type: "announce"; message: string }
  | { type: "spin"; active: boolean; speedDps?: number }
  | { type: "reveal-hold"; durationMs: number };

/**
 * The single reveal request DTO. The controller — never the caller —
 * classifies "big miss" from pin/spot via the design §6 predicate (haversine
 * > 500 km, or > 1.5 × the region's greater side in km), so the choreography
 * rule cannot drift between call sites.
 */
export interface RevealRequest {
  /** Opaque to the controller — the adapter paints it via its variation layers. */
  variation: unknown;
  pin: LngLat;
  spot: LngLat;
  /** Adapter-computed final framing (existing M8 fitBounds → center+zoom). */
  settleCenter: LngLat;
  settleZoom: number;
  /** Honesty gate: no choreography over the error overlay. */
  tileFailed: boolean;
  /** Camera truth at request time (resyncs tracked projection). */
  projection: ProjectionType;
}

export interface ZoomSpaceOptions {
  edition: ZoomSpaceEdition;
  prefersReducedMotion: boolean;
}

function pointInBounds(point: LngLat, bounds: RegionBounds): boolean {
  const [lon, lat] = point;
  const [w, s, e, n] = bounds;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

/** Naive midpoint — pins are game-local; dateline-straddling misses are out of scope. */
function midpoint(a: LngLat, b: LngLat): LngLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Single-run controller: construct per run (replay/leave/new run remounts),
 * drive with requestNarrow/requestReveal + the map event inputs, execute the
 * returned intents in order.
 */
export class ZoomSpaceController {
  private readonly edition: ZoomSpaceEdition;
  private readonly reducedMotion: boolean;

  // Tracked camera truth: adapter snapshots win; optimistic updates apply when
  // the controller itself emits a set-projection (adapter gates on style load).
  private trackedProjection: ProjectionType = "globe";
  private trackedZoom = 1.0;
  private trackedCenter: LngLat = [0, 0];

  private hasRequestedNarrow = false;
  private beatActiveFlag = false;
  private beatKindFlag: BeatKind | null = null;
  private revealDoneFlag = false;

  /** Latched from the first onMove snapshot of a user gesture; cleared on completion. */
  private gestureStartZoom: number | null = null;
  private narrowCrossingArmed = false;
  /** One-shot T_OUT suppression for the just-completed narrow beat (redundant
   * with the direction gate, kept per design R3). */
  private suppressTOutOnce = false;

  private region: RegionGeometryDTO | null = null;
  private settleZoom = 0;
  private pendingReveal: RevealRequest | null = null;
  /**
   * A commit that landed while a beat was active (see requestReveal).
   * Distinct from pendingReveal — that is the big-miss hold payload the
   * pull-back beat carries into the settle; this is a whole reveal request
   * deferred to the next beat completion.
   */
  private queuedReveal: RevealRequest | null = null;

  constructor(options: ZoomSpaceOptions) {
    this.edition = options.edition;
    this.reducedMotion = options.prefersReducedMotion;
  }

  get state(): ZoomSpaceState {
    if (!this.hasRequestedNarrow) return "INTRO";
    if (this.edition === "globe") return "GLOBE";
    return this.trackedProjection === "mercator" ? "REGION" : "SPACE";
  }

  get beatActive(): boolean {
    return this.beatActiveFlag;
  }

  get beatKind(): BeatKind | null {
    return this.beatKindFlag;
  }

  get revealDone(): boolean {
    return this.revealDoneFlag;
  }

  get projection(): ProjectionType {
    return this.trackedProjection;
  }

  private get flat(): boolean {
    return this.edition !== "globe";
  }

  private track(snapshot: ZoomSnapshot): void {
    this.trackedZoom = snapshot.zoom;
    this.trackedProjection = snapshot.projection;
    if (snapshot.center !== undefined) this.trackedCenter = snapshot.center;
  }

  /**
   * Begin the intro chain: spin → narrow(-in) → REGION (or the degenerate
   * globe-edition path). settleZoom is adapter-computed
   * (min(fitZoom(regionBounds, 15% padding), cap)); the narrow-in swap timing
   * is a function of it, never floored at 3.2.
   */
  requestNarrow(
    region: RegionGeometryDTO | null,
    settleZoom: number,
  ): ZoomSpaceIntent[] {
    if (this.hasRequestedNarrow) return [];
    if (this.flat && region === null) return [];
    if (!Number.isFinite(settleZoom)) return [];
    this.hasRequestedNarrow = true;
    this.region = region;
    this.settleZoom = settleZoom;
    // A stale direction latch must never leak into the run (defensive; the
    // intro has no gestures, so this is normally a no-op).
    this.gestureStartZoom = null;

    const intents: ZoomSpaceIntent[] = [
      // Physical disarm first, at every beat start (uniform even though
      // construction-time `interactive: false` already disarms narrow-in).
      { type: "gestures", enabled: false },
    ];

    if (this.reducedMotion) {
      // Tile-honesty re-arm opens the narrow phase: the region's set gets its
      // own verdict + full budget. No spin exists on this path, so the re-arm
      // stays here (the animated path emits it at the narrow beat's start).
      intents.push({ type: "rearm-tiles" });
      // Respectful, never a frozen mid-spin frame: no spin, no animation.
      if (this.flat && region !== null) {
        intents.push({ type: "set-projection", projection: "mercator" });
        this.trackedProjection = "mercator";
        intents.push({
          type: "jump-to",
          center: region.center,
          zoom: settleZoom,
        });
        this.trackedZoom = settleZoom;
        this.trackedCenter = region.center;
      } else {
        intents.push({
          type: "jump-to",
          center: GLOBE_HOME.center,
          zoom: GLOBE_HOME.zoom,
        });
        this.trackedZoom = GLOBE_HOME.zoom;
        this.trackedCenter = GLOBE_HOME.center;
      }
      intents.push(...this.narrowCompletionIntents());
      intents.push(...this.evaluateThresholds(this.trackedZoom));
      return intents;
    }

    this.beatActiveFlag = true;
    this.beatKindFlag = "spin";
    intents.push({ type: "spin", active: true, speedDps: SPIN_SPEED_DPS });
    return intents;
  }

  /**
   * Post-commit reveal choreography. The controller — not the caller —
   * classifies "big miss" from pin/spot geometry (design §6: haversine
   * > 500 km, or > 1.5 × the region's greater side in km): a big miss pulls
   * back toward the globe, holds REVEAL_HOLD_MS (the `reveal-hold` intent arms
   * the adapter timer), then settles; anything smaller gets a single settle beat.
   * Under reduced motion both jump straight to the final framing.
   * Tile-honesty gate: no choreography over the error overlay.
   */
  requestReveal(request: RevealRequest): ZoomSpaceIntent[] {
    if (request.tileFailed) return [];
    if (this.beatActiveFlag) {
      // A commit landed mid-beat (reachable: Drop pin inside the 600 ms
      // relock beat — the canvas tap handlers are detached there, but the
      // DropPinButton stays rendered). Queue it instead of dropping the
      // reveal with no recovery: the beat's completion flushes it (see
      // flushQueuedReveal). Latest request wins. The gesture latch is left
      // alone — the in-flight beat still needs it to recognize its own
      // trailing moveend.
      this.queuedReveal = request;
      return [];
    }
    this.trackedProjection = request.projection;
    // The commit ends any gesture by definition: a stale direction latch must
    // not be mistaken for a trailing moveend by a later beat's completion.
    this.gestureStartZoom = null;
    return this.revealIntents(request);
  }

  /**
   * Flush a request queued by a mid-beat commit. Called only from beat
   * completions that clear the beat flags, so the tracked projection is the
   * post-beat truth — the flush must NOT resync it from the request's stale
   * projection snapshot the way requestReveal does.
   */
  private flushQueuedReveal(): ZoomSpaceIntent[] {
    const queued = this.queuedReveal;
    this.queuedReveal = null;
    if (queued === null) return [];
    this.gestureStartZoom = null;
    return this.revealIntents(queued);
  }

  /**
   * The reveal intent builder shared by requestReveal and the mid-beat queue
   * flush. Assumes the beat flags are clear on entry (both call sites
   * guarantee it) and arms the pullback/settle beat on exit.
   */
  private revealIntents(request: RevealRequest): ZoomSpaceIntent[] {
    const intents: ZoomSpaceIntent[] = [
      { type: "gestures", enabled: false },
      // Post-commit taps can't re-aim during pullback/settle (design N1).
      { type: "tap-handlers", enabled: false },
    ];
    const bigMiss = this.isBigMiss(request.pin, request.spot);

    if (bigMiss && this.flat && this.trackedProjection === "mercator") {
      // REGION→SPACE release at pull-back start: the camera was going to
      // leave the bounds anyway; the release is the honest version of a
      // maxZoom cap. Belt-and-braces order: projection first, then null bounds.
      intents.push({ type: "set-projection", projection: "globe" });
      intents.push({ type: "set-max-bounds", bounds: null });
      this.trackedProjection = "globe";
    }
    intents.push({ type: "paint-variation", variation: request.variation });

    if (this.reducedMotion) {
      // Pull-back and hold are dropped; instant jump to the final framing.
      // revealDone is still set; tap handlers stay detached (aim phase over).
      intents.push({
        type: "jump-to",
        center: request.settleCenter,
        zoom: request.settleZoom,
      });
      intents.push({ type: "gestures", enabled: true });
      this.revealDoneFlag = true;
      this.trackedZoom = request.settleZoom;
      return intents;
    }

    if (bigMiss) {
      this.beatActiveFlag = true;
      this.beatKindFlag = "pullback";
      this.pendingReveal = request;
      intents.push({
        type: "ease-to",
        center: midpoint(request.pin, request.spot),
        zoom: 2.0,
        durationMs: PULLBACK_DURATION_MS,
        easing: "easeInOutCubic",
      });
    } else {
      // The existing single M8 fitBounds beat, unchanged in spirit —
      // the adapter translated its framing to center+zoom.
      this.beatActiveFlag = true;
      this.beatKindFlag = "settle";
      intents.push({
        type: "ease-to",
        center: request.settleCenter,
        zoom: request.settleZoom,
        durationMs: REVEAL_SETTLE_DURATION_MS,
        easing: "easeInOutCubic",
      });
    }
    return intents;
  }

  /** Ungated: clear the painted variation (menu dismissal, round reset). */
  clearReveal(): ZoomSpaceIntent[] {
    return [{ type: "clear-variation" }];
  }

  /**
   * Per-place reset for continue-to-next-place. Multi-place runs share one
   * map instance (only replay/leave remounts), so the terminal revealDone
   * latch must not leak into the next place's aim phase: without this, the
   * T_OUT / T_IN auto-thresholds stay inert after the first reveal and
   * zoom-to-space morphing silently stops working for places 2+.
   *
   * Clears the per-place transient state — the revealDone latch, beat flags,
   * gesture direction latch, one-shot suppressions, and any queued mid-beat
   * reveal — and returns no intents (pure state reset; the adapter's
   * existing clear-variation and tap re-arm intents cover the DOM side).
   * Preserves run-scoped state: the region (and its painted highlight),
   * projection tracking, and camera continuity. The intro cannot re-fire:
   * hasRequestedNarrow stays latched and the spin→narrow chain is only ever
   * entered via requestNarrow().
   */
  resetForNextPlace(): ZoomSpaceIntent[] {
    this.revealDoneFlag = false;
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.gestureStartZoom = null;
    this.narrowCrossingArmed = false;
    this.suppressTOutOnce = false;
    this.pendingReveal = null;
    this.queuedReveal = null;
    return [];
  }

  /**
   * Design §6 big-miss predicate: pin→spot > 500 km, or > 1.5 × the region's
   * greater side in km. No region (globe edition) is never a big miss — the
   * camera is already in space.
   *
   * The geometry comes from the shared game helpers (geo.distanceKm,
   * regions.greaterSideKm) — one source of truth with the scoring radius, so
   * the choreography predicate can never drift from it. The west<east
   * assumption inside greaterSideKm is safe for the shipped atlas (no region
   * crosses the antimeridian).
   */
  private isBigMiss(pin: LngLat, spot: LngLat): boolean {
    const region = this.region;
    if (region === null) return false;
    const distance = distanceKm(pin, spot);
    return (
      distance > BIG_MISS_KM ||
      distance > BIG_MISS_REGION_RATIO * greaterSideKm(region.bounds)
    );
  }

  /**
   * The adapter's 1200 ms spin timer expired: stop the spin, chain into the
   * narrow beat. Swap timing is a function of the computed settle zoom.
   */
  onSpinTimer(): ZoomSpaceIntent[] {
    if (!this.beatActiveFlag || this.beatKindFlag !== "spin") return [];
    const intents: ZoomSpaceIntent[] = [{ type: "spin", active: false }];
    this.beatKindFlag = "narrow";

    if (!this.flat) {
      // Degenerate narrow-in: no region, no swap, no highlight.
      intents.push({
        type: "ease-to",
        center: GLOBE_HOME.center,
        zoom: GLOBE_HOME.zoom,
        bearing: 0,
        durationMs: 800,
        easing: "easeInOutCubic",
      });
      return intents;
    }

    const region = this.region;
    if (region === null) {
      this.beatActiveFlag = false;
      this.beatKindFlag = null;
      return intents;
    }
    // Tile-honesty re-arm opens the narrow phase (full 15 s watchdog budget
    // from narrow start, not from the intro spin).
    intents.push({ type: "rearm-tiles" });
    if (this.settleZoom < Z_FLAT_IN) {
      // Large-country path: swap synchronously at beat start, masked by the
      // flight's initial motion. Completion belt-and-braces re-checks.
      // (Internal note: the in-flight flyTo frame closure keeps
      // interpolating while applyUpdatedTransform value-copies onto the
      // post-swap transform — re-verify on any maplibre-gl upgrade.)
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
    } else {
      // Standard path: arm the one-shot crossing swap; onMove fires it at ≥3.2.
      this.narrowCrossingArmed = true;
    }
    intents.push({
      type: "fly-to",
      center: region.center,
      zoom: this.settleZoom,
      bearing: 0,
      durationMs: NARROW_DURATION_MS,
      easing: "easeInOutCubic",
    });
    return intents;
  }

  /**
   * The adapter armed REVEAL_HOLD_MS on the `reveal-hold` intent and its
   * timer expired: start the settle beat. The pull-back beat is still active
   * (only its own timer can start the settle), so a stray input cannot wedge
   * the choreography.
   */
  onRevealHoldTimer(): ZoomSpaceIntent[] {
    if (!this.beatActiveFlag || this.beatKindFlag !== "pullback") return [];
    const details = this.pendingReveal;
    this.pendingReveal = null;
    if (details === null) {
      this.beatActiveFlag = false;
      this.beatKindFlag = null;
      return [];
    }
    this.beatKindFlag = "settle";
    return [
      {
        type: "ease-to",
        center: details.settleCenter,
        zoom: details.settleZoom,
        durationMs: REVEAL_SETTLE_DURATION_MS,
        easing: "easeInOutCubic",
      },
    ];
  }

  /**
   * Single move-listener input: latches gestureStartZoom on the
   * settled→moving transition (never during a beat — gestures are physically
   * disarmed, so a mid-beat move is the beat's own) and runs the narrow-in
   * crossing detection.
   */
  onMove(snapshot: ZoomSnapshot): ZoomSpaceIntent[] {
    this.track(snapshot);
    if (!this.beatActiveFlag && this.gestureStartZoom === null) {
      this.gestureStartZoom = snapshot.zoom;
    }
    if (
      this.beatKindFlag === "narrow" &&
      this.narrowCrossingArmed &&
      snapshot.zoom >= Z_FLAT_IN
    ) {
      this.narrowCrossingArmed = false;
      this.trackedProjection = "mercator"; // optimistic; adapter gates on style load
      return [{ type: "set-projection", projection: "mercator" }];
    }
    return [];
  }

  /**
   * Zoom-based threshold watcher: user gestures only. A beat's own zoomend
   * fires before its moveend, so beatActive is the defense-in-depth guard
   * (physical disarm is the real one).
   */
  onZoomEnd(snapshot: ZoomSnapshot): ZoomSpaceIntent[] {
    this.track(snapshot);
    if (this.beatActiveFlag) return [];
    return this.evaluateThresholds(snapshot.zoom);
  }

  /** Every controller beat completes on moveend (plus the completion choke point). */
  onMoveEnd(snapshot: ZoomSnapshot): ZoomSpaceIntent[] {
    this.track(snapshot);
    if (!this.beatActiveFlag) {
      // User-gesture moveend: thresholds are zoom-based and zoomend already
      // handled them — clear the direction latch.
      this.gestureStartZoom = null;
      return [];
    }
    // T_IN starts the relock beat at the gesture's zoomend, BEFORE the
    // gesture's trailing moveend. That trailing moveend is recognizable — the
    // gesture latch is still set — and must NOT complete the beat, or the
    // maxBounds lock would land mid-ease and snap via constrainInternal().
    if (this.gestureStartZoom !== null) {
      this.gestureStartZoom = null;
      return [];
    }
    switch (this.beatKindFlag) {
      case "narrow":
        return this.completeNarrow(snapshot.zoom);
      case "pullback":
        return this.completePullback(snapshot.zoom);
      case "settle":
        return this.completeSettle();
      case "relock":
        return this.completeRelock(snapshot.zoom);
      case "spin":
        // Spin completes via onSpinTimer(), never moveend (each setBearing
        // frame fires a synchronous moveend on the jumpTo path — ignored).
        return [];
      default:
        return [];
    }
  }

  /**
   * Shared directed-trigger evaluation. Callers: onZoomEnd (user gestures)
   * and beat completions (explicit, with map.getZoom()). Globe edition and
   * the terminal revealDone latch make thresholds inert.
   */
  private evaluateThresholds(zoom: number): ZoomSpaceIntent[] {
    if (this.revealDoneFlag) return [];
    if (!this.flat) return [];
    if (this.trackedProjection === "mercator") {
      // T_OUT — direction-gated (R3 BLOCKING 1).
      const suppress = this.suppressTOutOnce;
      this.suppressTOutOnce = false; // one-shot: consumed by the first evaluation
      if (
        !suppress &&
        this.gestureStartZoom !== null &&
        zoom < this.gestureStartZoom &&
        zoom < Z_GLOBE_OUT
      ) {
        // Escape: projection first, then the explicit null-bounds release.
        this.trackedProjection = "globe";
        return [
          { type: "set-projection", projection: "globe" },
          { type: "set-max-bounds", bounds: null },
          { type: "announce", message: "Space view" },
        ];
      }
      return [];
    }
    // T_IN.
    if (zoom > Z_FLAT_IN) return this.startRelock();
    return [];
  }

  /** T_IN: the choreographed return. Zero-length when the camera is already home. */
  private startRelock(): ZoomSpaceIntent[] {
    const region = this.region;
    if (region === null) return [];
    const intents: ZoomSpaceIntent[] = [
      { type: "gestures", enabled: false },
      { type: "tap-handlers", enabled: false },
    ];
    if (pointInBounds(this.trackedCenter, region.bounds)) {
      // Zero-length beat: lock + swap immediately, no ease to complete.
      // (The direction gate guarantees no T_OUT re-fire: the gesture zoomed in.)
      intents.push({ type: "set-max-bounds", bounds: region.bounds });
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
      intents.push({ type: "gestures", enabled: true });
      intents.push({ type: "tap-handlers", enabled: true });
      intents.push({ type: "announce", message: `${region.name} view` });
      return intents;
    }
    this.beatActiveFlag = true;
    this.beatKindFlag = "relock";
    intents.push({
      type: "ease-to",
      center: region.center,
      durationMs: RELOCK_DURATION_MS,
      easing: "easeInOutCubic",
    });
    return intents;
  }

  /** Narrow completion IS the REGION transition. */
  private completeNarrow(zoom: number): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.narrowCrossingArmed = false;
    const intents = this.narrowCompletionIntents();
    this.suppressTOutOnce = true;
    intents.push(...this.evaluateThresholds(zoom));
    // A commit that landed mid-beat (queued by requestReveal) runs now —
    // the relock window is the realistic case, the others are harmless.
    intents.push(...this.flushQueuedReveal());
    return intents;
  }

  private narrowCompletionIntents(): ZoomSpaceIntent[] {
    const intents: ZoomSpaceIntent[] = [];
    const region = this.region;
    // Belt-and-braces: flat edition + still globe → the crossing swap never
    // fired; swap + lock immediately. maxBounds lands at completion, never
    // mid-beat (mid-beat setMaxBounds snaps via constrainInternal()).
    if (this.flat && this.trackedProjection === "globe") {
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
    }
    if (this.flat && region !== null) {
      intents.push({ type: "set-max-bounds", bounds: region.bounds });
      intents.push({ type: "paint-highlight", feature: region });
    }
    intents.push({ type: "gestures", enabled: true });
    intents.push({ type: "tap-handlers", enabled: true });
    intents.push({ type: "a11y-intro", active: false });
    intents.push({
      type: "announce",
      message:
        this.flat && region !== null ? `${region.name} view` : "Globe view",
    });
    return intents;
  }

  /** Pull-back moveend: hold the beat active through the settle pause. */
  private completePullback(zoom: number): ZoomSpaceIntent[] {
    // Explicit evaluation (expect: no trigger — the camera is in SPACE by
    // design), then the `reveal-hold` intent: the adapter arms a one-shot
    // hold timer and calls onRevealHoldTimer() on expiry. beatActive stays
    // set through the hold, so a stray input cannot wedge the choreography.
    const intents = this.evaluateThresholds(zoom);
    intents.push({ type: "reveal-hold", durationMs: REVEAL_HOLD_MS });
    return intents;
  }

  /** Settle completion is terminal: revealDone suppresses all auto-return. */
  private completeSettle(): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.revealDoneFlag = true;
    // Tap handlers stay detached — the aim phase is over (design N1).
    const intents: ZoomSpaceIntent[] = [{ type: "gestures", enabled: true }];
    // A commit that landed mid-beat (queued by requestReveal) chains here.
    intents.push(...this.flushQueuedReveal());
    return intents;
  }

  private completeRelock(zoom: number): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    const region = this.region;
    const intents: ZoomSpaceIntent[] = [];
    if (region !== null) {
      // Retain/return: the center was eased in-bounds first, so the lock's
      // synchronous constrainInternal() has nothing to snap. Bounds first,
      // then projection (the new transform inherits the bounds via apply()).
      intents.push({ type: "set-max-bounds", bounds: region.bounds });
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
    }
    intents.push({ type: "gestures", enabled: true });
    intents.push({ type: "tap-handlers", enabled: true });
    intents.push({
      type: "announce",
      message: region !== null ? `${region.name} view` : "Region view",
    });
    intents.push(...this.evaluateThresholds(zoom));
    // The realistic mid-beat commit lands here: Drop pin inside the 600 ms
    // relock beat queues the reveal, and it flushes now — lock + swap +
    // re-enable first, then the reveal's own disarm + paint + settle beat.
    intents.push(...this.flushQueuedReveal());
    return intents;
  }
}
