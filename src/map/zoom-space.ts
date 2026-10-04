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
 * ("spin" | "narrow" | "reveal" | "return" | "relock"),
 * plus the terminal latch `revealDone`.
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
 *     Reachability: the adapter forwards `zoomstart`→onZoomStart, which
 *     releases the region maxBounds at zoom-gesture start — otherwise
 *     MapLibre's defaultConstrain pins the zoom at the bounds' fit floor and
 *     T_OUT is unreachable from settled small/medium regions.
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
 *
 * --- Adapter contract (satellite-map.tsx) ---
 * - Forward every map `move` to `onMove({zoom, projection, center})` on the ONE
 *   existing move listener: it carries the T_OUT latch.
 *   Forward `zoomend`→onZoomEnd,
 *   `moveend`→onMoveEnd with the same snapshot shape. Forward `zoomstart`→
 *   onZoomStart (fires before any zoom delta for wheel, pinch, +/-, and
 *   keyboard zoom): the controller releases the region maxBounds there so
 *   the gesture's zoom-out can reach T_OUT; pure pans never fire zoomstart,
 *   so the region framing guardrail survives them.
 * - Spin: on `spin {active: true}` start the rAF loop
 *   (`map.setBearing(bearing + dt * speedDps)`) and arm the SPIN_DURATION_MS
 *   timer; on expiry call `onSpinTimer()` (chains into the narrow beat). On
 *   `spin {active: false}` stop the loop and clear the timer. NOTE: each
 *   setBearing fires a synchronous moveend (jumpTo path) — those arrive while
 *   beatKind is "spin" and are ignored by the controller.
 * - Gap-view reveal (Veeresh: the reveal must educate, not perform): on a
 *   miss, one `ease-to` to the pin+spot fit framing — the player sees their
 *   guess and the true spot in a single frame, and the framing scales with
 *   the error. Its moveend → completeReveal latches revealDone and emits
 *   `reveal-done` (the app shows the result card). On a hit there is no
 *   camera move: the variation paints, the controller announces, and
 *   `reveal-done` fires synchronously. A tap during the miss beat →
 *   skipChoreography() jumps to the framing. Under reduced motion the miss
 *   is a synchronous jump cut. After the reveal, continuing starts the
 *   return beat (beginReturn → ease back to the region framing;
 *   completeReturn re-arms taps) so the next question never starts at the
 *   gap-view framing.
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
 *   inputs (pin/spot, settle framing, hit flag, tileFailed, projection) plus
 *   the opaque variation payload. The CONTROLLER classifies "big miss" from
 *   pin/spot geometry (design §6: pin→spot > 500 km, or > 1.5 × the region's
 *   greater side in km) for the REGION→SPACE release, so the choreography
 *   rule cannot drift between call sites. `clearReveal()` is the ungated
 *   clear-variation path.
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
/** Intro spin speed, degrees/second. 30 dps turns 36° over the 1200 ms intro —
 *  one revolution per 12 s: clearly alive, still comfortable (0.5°/frame @60fps).
 *  (Was 6 dps = 7.2° — imperceptible; F3 tune, 2026-09-30.) */
export const SPIN_SPEED_DPS = 30;
/** Adapter arms this timer on `spin {active: true}`; expiry → onSpinTimer(). */
export const SPIN_DURATION_MS = 1200;
/** Narrow-in flyTo duration. */
export const NARROW_DURATION_MS = 2400;
/** Relock ease duration (center already outside bounds → ease home first). */
export const RELOCK_DURATION_MS = 600;
/** Gap-view reveal ease duration (single beat to the pin+spot framing). */
export const REVEAL_DURATION_MS = 2200;
/** Return beat: ease back out to the region framing duration. */
export const RETURN_DURATION_MS = 1200;
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
export type BeatKind = "spin" | "narrow" | "reveal" | "return" | "relock";
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
  /**
   * Gap-view reveal end/skip: the reveal reached its end state — the adapter
   * notifies the app (result card appears over the pin+spot framing).
   */
  | { type: "reveal-done" };

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
  /** Hit (within radius) vs miss — drives the light-confirmation vs gap-view branch. */
  hit: boolean;
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
  /** One-shot T_OUT suppression for the just-completed narrow beat (redundant
   * with the direction gate, kept per design R3). */
  private suppressTOutOnce = false;

  private region: RegionGeometryDTO | null = null;
  private settleZoom = 0;
  /**
   * The gap-view framing for the active reveal beat (skip target). Set by
   * revealIntents for every miss; cleared per place by resetForNextPlace.
   */
  private revealFraming: { center: LngLat; zoom: number } | null = null;
  /**
   * A commit that landed while a beat was active (see requestReveal).
   * This is a whole reveal request deferred to the next beat completion.
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
   * > 500 km, or > 1.5 × the region's greater side in km): a big miss
   * releases back to the globe projection first so the pin+spot fit is
   * honest, then the single gap-view ease runs. Under reduced motion the
   * gap framing is a synchronous jump cut. Tile-honesty gate: no
   * choreography over the error overlay.
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
   * guarantee it).
   *
   * Two branches (Veeresh: the reveal must educate, not perform):
   * - Hit: light confirmation — paint the variation, announce, and complete
   *   synchronously. The camera is already on the pin; no move is needed.
   * - Miss: the gap view — one ease to the pin+spot fit framing so the
   *   player sees their guess and the true spot in a single frame. The
   *   framing scales with the error: a near miss barely moves the camera,
   *   an intercontinental whiff pulls back to the globe.
   */
  private revealIntents(request: RevealRequest): ZoomSpaceIntent[] {
    const intents: ZoomSpaceIntent[] = [
      { type: "gestures", enabled: false },
      // Post-commit taps can't re-aim during the reveal (design N1).
      { type: "tap-handlers", enabled: false },
      { type: "paint-variation", variation: request.variation },
    ];
    if (request.hit) {
      intents.push({ type: "announce", message: "Hit." });
      this.revealDoneFlag = true;
      intents.push({ type: "reveal-done" });
      // The result card is up: the player can pan/zoom to inspect the spot.
      // (Tap handlers stay detached — the aim phase is over; only gestures
      // come back. Thresholds are inert once revealDone latches.)
      intents.push({ type: "gestures", enabled: true });
      return intents;
    }
    // Miss: the gap-view framing (and the skip target) for this reveal.
    this.revealFraming = { center: request.settleCenter, zoom: request.settleZoom };
    const bigMiss = this.isBigMiss(request.pin, request.spot);

    if (bigMiss && this.flat && this.trackedProjection === "mercator") {
      // REGION→SPACE release at reveal start: the camera was going to
      // leave the bounds anyway; the release is the honest version of a
      // maxZoom cap. Belt-and-braces order: projection first, then null bounds.
      intents.push({ type: "set-projection", projection: "globe" });
      intents.push({ type: "set-max-bounds", bounds: null });
      this.trackedProjection = "globe";
    }
    intents.push({ type: "announce", message: "Showing your pin and the true spot." });

    if (this.reducedMotion) {
      // Jump cut: land the gap framing and complete synchronously (no
      // timers, no animation). revealDone is still set; tap handlers stay
      // detached (aim phase over).
      intents.push({
        type: "jump-to",
        center: request.settleCenter,
        zoom: request.settleZoom,
      });
      this.trackedZoom = request.settleZoom;
      this.trackedCenter = request.settleCenter;
      this.revealDoneFlag = true;
      this.revealFraming = null;
      intents.push({ type: "reveal-done" });
      // Reduced-motion jump cut lands the framing; gestures come back so the
      // player can still pan/zoom around the result.
      intents.push({ type: "gestures", enabled: true });
      return intents;
    }

    this.beatActiveFlag = true;
    this.beatKindFlag = "reveal";
    intents.push({
      type: "ease-to",
      center: request.settleCenter,
      zoom: request.settleZoom,
      durationMs: REVEAL_DURATION_MS,
      easing: "easeInOutCubic",
    });
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
   * gesture direction latch, one-shot suppressions, the gap-view framing, and
   * any queued mid-beat reveal — and returns no intents (pure state reset; the
   * adapter's existing clear-variation and tap re-arm intents cover the DOM
   * side). Preserves run-scoped state: the region (and its painted
   * highlight), projection tracking, and camera continuity. The intro cannot
   * re-fire: hasRequestedNarrow stays latched and the spin→narrow chain is
   * only ever entered via requestNarrow().
   */
  resetForNextPlace(): ZoomSpaceIntent[] {
    this.revealDoneFlag = false;
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.gestureStartZoom = null;
    this.suppressTOutOnce = false;
    this.queuedReveal = null;
    this.revealFraming = null;
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
    // Synchronous swap for all cases: the previous mid-flight crossing swap
    // (fired from onMove at zoom >= Z_FLAT_IN) was racy — if onMove didn't
    // fire at exactly the crossing zoom, the projection stayed "globe",
    // breaking T_OUT and the zoom buttons (maxBounds constraint). The swap
    // at beat start is masked by the flight's initial motion.
    // (Internal note: the in-flight flyTo frame closure keeps
    // interpolating while applyUpdatedTransform value-copies onto the
    // post-swap transform — re-verify on any maplibre-gl upgrade.)
    intents.push({ type: "set-projection", projection: "mercator" });
    this.trackedProjection = "mercator";
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
   * Single move-listener input: latches gestureStartZoom on the
   * settled→moving transition (never during a beat — gestures are physically
   * disarmed, so a mid-beat move is the beat's own). The narrow-beat
   * projection swap is synchronous at beat start (see onSpinTimer), so no
   * mid-flight crossing detection lives here.
   */
  onMove(snapshot: ZoomSnapshot): ZoomSpaceIntent[] {
    this.track(snapshot);
    if (!this.beatActiveFlag && this.gestureStartZoom === null) {
      this.gestureStartZoom = snapshot.zoom;
    }
    return [];
  }

  /**
   * Zoom-gesture start: the adapter forwards MapLibre `zoomstart` (fires for
   * wheel, pinch, +/- buttons, and keyboard zoom, before any zoom delta is
   * applied). Releases the region maxBounds so the gesture's zoom deltas run
   * unconstrained — without this, MapLibre's defaultConstrain forces the zoom
   * back up to the bounds' fit floor (`result.zoom += scaleZoom(scale)` in
   * maplibre-gl 6.11.2), so T_OUT (zoom < Z_GLOBE_OUT) can never fire from a
   * settled small/medium region and the `set-max-bounds` null escape inside
   * T_OUT is dead code.
   *
   * User-gesture-only by construction: beats physically disarm gestures, and
   * beatActiveFlag is the defense-in-depth guard (a beat's own flyTo/easeTo
   * also fires zoomstart). The reduced-motion reveal sets revealDoneFlag
   * before its jump-to executes, so that path is guarded too. Pure pans never
   * fire zoomstart, so the region framing guardrail survives pans. Idempotent:
   * set-max-bounds{null} on an already-released map is a no-op in the adapter.
   *
   * Re-entrancy note: the reduced-motion narrow-in emits jump-to BEFORE
   * set-max-bounds{bounds} in one intent batch, and jumpTo fires a synchronous
   * zoomstart when the zoom changes. The release emitted here is therefore
   * always overwritten by the batch's own bounds intent — the ordering is
   * pinned by the "synchronous jump + immediate completion" unit test.
   */
  onZoomStart(): ZoomSpaceIntent[] {
    if (this.beatActiveFlag) return [];
    if (this.revealDoneFlag) return [];
    if (!this.flat) return [];
    if (this.region === null) return [];
    if (this.trackedProjection !== "mercator") return [];
    return [{ type: "set-max-bounds", bounds: null }];
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
      case "reveal":
        return this.completeReveal();
      case "return":
        return this.completeReturn(snapshot.zoom);
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
    if (zoom > Z_FLAT_IN) return this.startRelock(zoom);
    return [];
  }

  /**
   * T_IN: the choreographed return. Snap-safe by construction: the maxBounds
   * lock is only ever applied where the lock's synchronous constrainInternal()
   * is a no-op. Locking below the bounds' fit floor would snap the camera
   * (zoom forced up to the floor AND center to the bounds center, per
   * defaultConstrain) — so when the gesture left the camera below the region
   * framing, the relock beat eases it up to the framing first and
   * completeRelock applies the lock where it cannot snap.
   */
  private startRelock(zoom: number): ZoomSpaceIntent[] {
    const region = this.region;
    if (region === null) return [];
    const intents: ZoomSpaceIntent[] = [
      { type: "gestures", enabled: false },
      { type: "tap-handlers", enabled: false },
    ];
    if (pointInBounds(this.trackedCenter, region.bounds) && zoom >= this.settleZoom) {
      // Zero-length beat: the camera is already at/above the region framing,
      // so the lock lands snap-free. (The direction gate guarantees no T_OUT
      // re-fire: the gesture zoomed in.)
      // Note: do NOT set maxBounds — it blocks map.zoomOut(), preventing
      // the user from zooming back out to space. The thresholds handle
      // region/space transitions.
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
      intents.push({ type: "gestures", enabled: true });
      intents.push({ type: "tap-handlers", enabled: true });
      intents.push({ type: "announce", message: `${region.name} view` });
      return intents;
    }
    // Choreographed return: ease home, and up to the region framing when the
    // gesture left the camera below it. completeRelock then applies the lock
    // at the framing, where constrainInternal() has nothing to fix.
    this.beatActiveFlag = true;
    this.beatKindFlag = "relock";
    intents.push({
      type: "ease-to",
      center: region.center,
      ...(zoom < this.settleZoom ? { zoom: this.settleZoom } : {}),
      durationMs: RELOCK_DURATION_MS,
      easing: "easeInOutCubic",
    });
    return intents;
  }

  /** Narrow completion IS the REGION transition. */
  private completeNarrow(zoom: number): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
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
    // Belt-and-braces: flat edition + still globe → the beat-start swap was
    // lost; swap + lock immediately. maxBounds lands at completion, never
    // mid-beat (mid-beat setMaxBounds snaps via constrainInternal()).
    if (this.flat && this.trackedProjection === "globe") {
      intents.push({ type: "set-projection", projection: "mercator" });
      this.trackedProjection = "mercator";
    }
    if (this.flat && region !== null) {
      // Do NOT set maxBounds here: MapLibre's setMaxBounds constrains zoom
      // as well as pan — it blocks map.zoomOut() entirely, preventing the
      // user from zooming out to space (T_OUT never fires because the zoom
      // never changes). The region highlight + T_OUT/T_IN thresholds are
      // sufficient; panning outside is handled by the threshold logic.
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

  /**
   * Gap-view reveal completion is terminal: revealDone latches, the adapter
   * shows the result card over the pin+spot framing. A queued mid-beat
   * commit takes precedence: it starts a fresh reveal beat. Tap handlers
   * stay detached — the aim phase is over (design N1). They re-arm on the
   * return beat (continue) or a remount (replay/leave).
   */
  private completeReveal(): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.revealFraming = null;
    // A commit that landed mid-beat (queued by requestReveal) flushes now.
    // When it does, the flushed reveal owns the terminal state — a hit
    // latches synchronously inside revealIntents, a miss latches when its
    // beat completes — so no intermediate reveal-done is emitted and the
    // latch is not set under the new beat.
    const hadQueued = this.queuedReveal !== null;
    const intents: ZoomSpaceIntent[] = [];
    intents.push(...this.flushQueuedReveal());
    if (!hadQueued) {
      this.revealDoneFlag = true;
      intents.unshift({ type: "reveal-done" });
      // The gap-view beat is done: hand pan/zoom back so the player can
      // inspect both pins (and zoom out further). Thresholds are inert once
      // revealDone latches, so this cannot start a new beat.
      intents.push({ type: "gestures", enabled: true });
    }
    return intents;
  }

  /**
   * Skip the gap-view reveal beat: jump straight to the reveal's end state
   * — the result card over the pin+spot framing. Callable only from the
   * reveal beat; a no-op anywhere else (the adapter only arms the skip
   * listener while choreography can run).
   */
  skipChoreography(): ZoomSpaceIntent[] {
    if (!this.beatActiveFlag || this.beatKindFlag !== "reveal") return [];
    const framing = this.revealFraming;
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    this.revealDoneFlag = true;
    this.revealFraming = null;
    const intents: ZoomSpaceIntent[] = [];
    if (framing !== null) {
      intents.push({ type: "jump-to", center: framing.center, zoom: framing.zoom });
      this.trackedZoom = framing.zoom;
      this.trackedCenter = framing.center;
    }
    intents.push({ type: "reveal-done" });
    // Skip lands on the gap framing; gestures come back with it.
    intents.push({ type: "gestures", enabled: true });
    return intents;
  }

  /**
   * Return beat: continuing to the next place eases the camera back out to
   * the region framing (globe home for the globe edition) so the next
   * question doesn't start at the gap-view framing. The projection is left
   * as the reveal left it — the existing T_OUT/T_IN thresholds re-converge
   * it on the next aim phase. Under reduced motion it's a jump cut. Tap
   * handlers stay detached until the return completes (completeReturn
   * re-arms them).
   */
  beginReturn(): ZoomSpaceIntent[] {
    const intents: ZoomSpaceIntent[] = [];
    const target =
      this.flat && this.region !== null
        ? { center: this.region.center, zoom: this.settleZoom }
        : { center: GLOBE_HOME.center, zoom: GLOBE_HOME.zoom };
    if (this.reducedMotion) {
      intents.push({ type: "jump-to", center: target.center, zoom: target.zoom });
      this.trackedZoom = target.zoom;
      this.trackedCenter = target.center;
      intents.push({ type: "tap-handlers", enabled: true });
      intents.push({ type: "gestures", enabled: true });
      return intents;
    }
    this.beatActiveFlag = true;
    this.beatKindFlag = "return";
    // Re-arm tap handlers immediately: the reveal left them detached (aim was
    // over), and the next question's aim phase starts now. The user can place
    // the next pin while the camera eases back; a mid-return commit queues
    // behind the beat and flushes on completion. Gestures stay off so drags
    // don't fight the animation.
    intents.push({ type: "tap-handlers", enabled: true });
    intents.push({
      type: "ease-to",
      center: target.center,
      zoom: target.zoom,
      durationMs: RETURN_DURATION_MS,
      easing: "easeInOutCubic",
    });
    return intents;
  }

  /** Return completion: re-arm the aim gesture model for the next place. */
  private completeReturn(zoom: number): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    const intents: ZoomSpaceIntent[] = [
      { type: "tap-handlers", enabled: true },
      { type: "gestures", enabled: true },
    ];
    intents.push(...this.evaluateThresholds(zoom));
    // A commit that landed mid-return (taps are armed during the ease)
    // flushes now — otherwise the round soft-locks with a placed pin.
    intents.push(...this.flushQueuedReveal());
    return intents;
  }

  private completeRelock(zoom: number): ZoomSpaceIntent[] {
    this.beatActiveFlag = false;
    this.beatKindFlag = null;
    const region = this.region;
    const intents: ZoomSpaceIntent[] = [];
    if (region !== null) {
      // Retain/return: the center was eased in-bounds first.
      // Note: do NOT set maxBounds — it blocks map.zoomOut(), preventing
      // the user from zooming back out to space. The thresholds handle
      // region/space transitions.
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
