/**
 * Unit tests for the zoom-space state machine — pure, node-testable like
 * `tile-status.test.ts`. The adapter (satellite-map.tsx) is exercised by E2E;
 * here we pin the transition logic: directed thresholds, the hysteresis band,
 * beat choreography, and the reveal latch (terminal per place, reset on
 * continue-to-next-place).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETURN_DURATION_MS,
  REVEAL_DURATION_MS,
  SPIN_DURATION_MS,
  SPIN_SPEED_DPS,
  Z_FLAT_IN,
  Z_GLOBE_OUT,
  ZoomSpaceController,
} from "./zoom-space.ts";
import type { LngLat, RegionGeometryDTO } from "./region-index.ts";
import type {
  ProjectionType,
  RevealRequest,
  ZoomSnapshot,
} from "./zoom-space.ts";

const NEBRASKA: RegionGeometryDTO = {
  id: "31",
  name: "Nebraska",
  bounds: [-104, 40, -95.3, 43],
  center: [-99.65, 41.5],
  polygonCoords: { type: "Polygon", coordinates: [] },
};

const PARIS: LngLat = [2.35, 48.85];

function snap(
  zoom: number,
  projection: ProjectionType = "mercator",
  center?: LngLat,
): ZoomSnapshot {
  return center === undefined ? { zoom, projection } : { zoom, projection, center };
}

function flatController(reducedMotion = false): ZoomSpaceController {
  return new ZoomSpaceController({
    edition: "state",
    prefersReducedMotion: reducedMotion,
  });
}

const REVEAL_REQUEST: RevealRequest = {
  variation: { label: "miss-line" },
  pin: [-99.0, 41.0] as LngLat,
  spot: [-98.0, 42.0] as LngLat,
  settleCenter: [-98.5, 41.5] as LngLat,
  settleZoom: 6,
  hit: false,
  tileFailed: false,
  projection: "mercator",
};

/** A hit: same request shape, scored inside the radius. */
const HIT_REQUEST: RevealRequest = { ...REVEAL_REQUEST, hit: true };

/** Pin→spot Nebraska→Paris ≈ 7500 km: trips the 500 km big-miss rule. */
const BIG_MISS_REQUEST: RevealRequest = {
  ...REVEAL_REQUEST,
  spot: PARIS,
};

/** ~1°×1° region (greater side ≈ 111 km) for the big-miss ratio branch. */
const SMALL_REGION: RegionGeometryDTO = {
  id: "t1",
  name: "Tiny",
  bounds: [0, 0, 1, 1],
  center: [0.5, 0.5],
  polygonCoords: { type: "Polygon", coordinates: [] },
};

/** Drive requestNarrow → spin → narrow to REGION, via the crossing swap. */
function narrowToRegion(
  c: ZoomSpaceController,
  settleZoom = 4.5,
  region: RegionGeometryDTO = NEBRASKA,
): void {
  const start = c.requestNarrow(region, settleZoom);
  if (c.state === "REGION") return; // reduced motion: synchronous narrow-in.
  assert.equal(start[1]?.type, "spin");
  // The narrow beat swaps to mercator synchronously at beat start (no
  // mid-flight crossing): the swap intent is part of onSpinTimer's output.
  const chained = c.onSpinTimer();
  assert.ok(
    chained.some(
      (i) => i.type === "set-projection" && i.projection === "mercator",
    ),
    "narrow beat should swap to mercator at beat start",
  );
  const done = c.onMoveEnd(snap(settleZoom, "mercator", region.center));
  assert.ok(
    done.some((i) => i.type === "announce"),
    "narrow-in should complete",
  );
  assert.equal(c.state, "REGION");
}

test("threshold and spin constants", () => {
  assert.equal(Z_GLOBE_OUT, 2.2);
  assert.equal(Z_FLAT_IN, 3.2);
  assert.equal(SPIN_SPEED_DPS, 30);
});

test("intro spin turns a clearly visible angle during the spin beat", () => {
  // Total rotation over the beat: must read as motion (>= 20°) but stay
  // comfortable (<= 90° in ~1 s). Guards against regressions to an
  // imperceptible spin like the old 6 dps (7.2°).
  const totalDegrees = (SPIN_SPEED_DPS * SPIN_DURATION_MS) / 1000;
  assert.ok(totalDegrees >= 20, `intro spin ${totalDegrees}° is too subtle`);
  assert.ok(totalDegrees <= 90, `intro spin ${totalDegrees}° is too fast`);
});

test("fresh controller is INTRO with no beat", () => {
  const c = flatController();
  assert.equal(c.state, "INTRO");
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);
  assert.equal(c.revealDone, false);
});

test("requestNarrow emits disarm + spin; narrow phase re-arms tiles", () => {
  const c = flatController();
  assert.deepEqual(c.requestNarrow(NEBRASKA, 4.5), [
    { type: "gestures", enabled: false },
    { type: "spin", active: true, speedDps: SPIN_SPEED_DPS },
  ]);
  assert.equal(c.beatActive, true);
  assert.equal(c.beatKind, "spin");
});

test("requestNarrow is single-shot; second call is a no-op", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(c.requestNarrow(NEBRASKA, 4.5), []);
});

test("spin timer chains into the narrow beat (synchronous swap at beat start)", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(c.onSpinTimer(), [
    { type: "spin", active: false },
    // Tile-honesty re-arm opens the narrow phase (full watchdog budget from
    // narrow start, not from the intro spin).
    { type: "rearm-tiles" },
    // Synchronous swap for all cases: the mid-flight crossing was racy, so
    // the beat swaps at start, masked by the flight's initial motion.
    { type: "set-projection", projection: "mercator" },
    {
      type: "fly-to",
      center: NEBRASKA.center,
      zoom: 4.5,
      bearing: 0,
      durationMs: 2400,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "narrow");
  assert.equal(c.projection, "mercator");
});

test("narrow beat: no mid-flight crossing swap — onMove never swaps", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  // Mid-flight moves at any zoom are plain tracking; the swap already
  // happened at beat start.
  assert.deepEqual(c.onMove(snap(2.5, "globe")), []);
  assert.deepEqual(c.onMove(snap(3.4, "globe")), []);
  assert.deepEqual(c.onMove(snap(4.0, "mercator")), []);
  assert.equal(c.projection, "mercator");
});

test("narrow completion locks, highlights, enables, announces", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  c.onMove(snap(4.5, "mercator"));
  assert.deepEqual(c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center)), [
    { type: "paint-highlight", feature: NEBRASKA },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "a11y-intro", active: false },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
  assert.equal(c.beatActive, false);
});

test("narrow completion belt-and-braces: swap when crossing never fired", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  // No onMove ≥ 3.2 was ever forwarded: projection is still globe.
  const done = c.onMoveEnd(snap(4.5, "globe", NEBRASKA.center));
  assert.deepEqual(done[0], { type: "set-projection", projection: "mercator" });
  // Note: set-max-bounds is intentionally NOT emitted — it blocks zoomOut().
  assert.equal(c.state, "REGION");
});

test("sub-2.2 settle: synchronous swap at narrow beat start, no duplicate at completion", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 1.9);
  assert.deepEqual(c.onSpinTimer(), [
    { type: "spin", active: false },
    { type: "rearm-tiles" },
    { type: "set-projection", projection: "mercator" },
    {
      type: "fly-to",
      center: NEBRASKA.center,
      zoom: 1.9,
      bearing: 0,
      durationMs: 2400,
      easing: "easeInOutCubic",
    },
  ]);
  const done = c.onMoveEnd(snap(1.9, "mercator", NEBRASKA.center));
  assert.ok(done.every((i) => i.type !== "set-projection"));
  assert.equal(c.state, "REGION");
});

test("T_OUT is direction-gated: zoom-IN below 2.2 never fires (R3 BLOCKING 1)", () => {
  const c = flatController();
  narrowToRegion(c, 1.9); // large-country settle below Z_GLOBE_OUT
  // Gesture 1: pinch IN 1.9 → 2.0 (ends below 2.2 but zoomed IN).
  c.onMove(snap(1.9));
  assert.deepEqual(c.onZoomEnd(snap(2.0)), []);
  c.onMoveEnd(snap(2.0));
  assert.equal(c.state, "REGION");
});

test("T_OUT fires on a genuine zoom-OUT below 2.2", () => {
  const c = flatController();
  narrowToRegion(c, 1.9);
  c.onMove(snap(2.0));
  assert.deepEqual(c.onZoomEnd(snap(1.5)), [
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "announce", message: "Space view" },
  ]);
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "SPACE");
});

test("hysteresis band: no swap inside [2.2, 3.2] either direction", () => {
  const c = flatController();
  narrowToRegion(c, 2.5);
  // REGION: zoom out but hold above 2.2.
  c.onMove(snap(2.5));
  assert.deepEqual(c.onZoomEnd(snap(2.3)), []);
  c.onMoveEnd(snap(2.3));
  assert.equal(c.state, "REGION");
  // SPACE: zoom in but hold below 3.2.
  c.onMove(snap(2.3));
  c.onZoomEnd(snap(1.5));
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "SPACE");
  c.onMove(snap(1.5, "globe"));
  assert.deepEqual(c.onZoomEnd(snap(2.9, "globe")), []);
  c.onMoveEnd(snap(2.9, "globe"));
  assert.equal(c.state, "SPACE");
});

test("T_IN starts the relock beat; trailing moveend does not complete it", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.onMove(snap(1.5, "globe"));
  c.onZoomEnd(snap(1.5, "globe"));
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "SPACE");
  // Pinch in past 3.2 with the center outside the region (Paris), and below
  // the region framing: the relock beat eases home AND up to the framing, so
  // the lock lands snap-free.
  c.onMove(snap(1.5, "globe", PARIS));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", PARIS)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    {
      type: "ease-to",
      center: NEBRASKA.center,
      zoom: 4.5,
      durationMs: 600,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "relock");
  // The gesture's trailing moveend: consumed, beat stays active.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", PARIS)), []);
  assert.equal(c.beatActive, true);
  // The ease's own moveend: completion — lock, swap, re-enable, announce.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
});

test("T_IN eases up to the region framing when below it (snap-safe relock)", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.onMove(snap(1.5, "globe"));
  c.onZoomEnd(snap(1.5, "globe"));
  c.onMoveEnd(snap(1.5, "globe"));
  // Pinch in past 3.2 with the center already in-bounds but the zoom below
  // the region framing: locking maxBounds here would snap via
  // constrainInternal(), so the relock beat eases up to the framing first.
  c.onMove(snap(1.5, "globe", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    {
      type: "ease-to",
      center: NEBRASKA.center,
      zoom: 4.5,
      durationMs: 600,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "relock");
  // The gesture's trailing moveend: consumed, beat stays active.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", NEBRASKA.center)), []);
  assert.equal(c.beatActive, true);
  // The ease's own moveend: completion — lock lands snap-free at the framing.
  assert.deepEqual(c.onMoveEnd(snap(4.5, "globe", NEBRASKA.center)), [
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
});

test("T_IN is zero-length when the camera is already at/above the framing", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.onMove(snap(1.5, "globe"));
  c.onZoomEnd(snap(1.5, "globe"));
  c.onMoveEnd(snap(1.5, "globe"));
  // One fast gesture from space to zoom 5 (above the 4.5 framing), center home.
  c.onMove(snap(1.5, "globe", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(5, "globe", NEBRASKA.center)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.beatActive, false);
  assert.equal(c.state, "REGION");
  // Trailing gesture moveend: plain no-op.
  assert.deepEqual(c.onMoveEnd(snap(5, "mercator", NEBRASKA.center)), []);
});

test("onZoomStart releases the region maxBounds so T_OUT is reachable", () => {
  const c = flatController();
  narrowToRegion(c, 7);
  assert.equal(c.state, "REGION");
  // A zoom gesture begins: the lock releases before any zoom delta, so
  // MapLibre's defaultConstrain cannot pin the zoom at the bounds' fit floor.
  assert.deepEqual(c.onZoomStart(), [
    { type: "set-max-bounds", bounds: null },
  ]);
  // The gesture zooms out past Z_GLOBE_OUT: T_OUT fires as designed, and its
  // own null-bounds emit is idempotent after the zoomstart release.
  c.onMove(snap(7, "mercator", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(1.5, "mercator", NEBRASKA.center)), [
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "announce", message: "Space view" },
  ]);
  assert.equal(c.state, "SPACE");
});

test("onZoomStart is inert outside the user-zoom REGION case", () => {
  // During a beat (a beat's own flyTo/easeTo also fires zoomstart).
  const c = flatController();
  c.requestNarrow(NEBRASKA, 7);
  assert.deepEqual(c.onZoomStart(), []);
  // Globe edition never sets region bounds.
  const g = new ZoomSpaceController({
    edition: "globe",
    prefersReducedMotion: false,
  });
  assert.deepEqual(g.onZoomStart(), []);
  // SPACE state: already released, nothing to do.
  const s = flatController();
  narrowToRegion(s, 7);
  s.onZoomStart();
  s.onMove(snap(7, "mercator", NEBRASKA.center));
  s.onZoomEnd(snap(1.5, "mercator", NEBRASKA.center));
  assert.equal(s.state, "SPACE");
  assert.deepEqual(s.onZoomStart(), []);
  // Post-reveal: thresholds are terminally inert, bounds untouched.
  const r = flatController();
  narrowToRegion(r, 7);
  r.requestReveal(REVEAL_REQUEST);
  assert.deepEqual(r.onZoomStart(), []);
});

test("a beat's own zoomend is ignored (fires before its moveend)", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  assert.deepEqual(c.onZoomEnd(snap(3.0, "globe")), []);
  assert.equal(c.beatKind, "narrow");
});

test("per-frame spin moveends (setBearing jumpTo path) never complete the spin", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(c.onMoveEnd(snap(1.0, "globe")), []);
  assert.equal(c.beatKind, "spin");
});

test("requestReveal during the intro beats is queued, not dropped", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5); // spin beat active
  assert.deepEqual(c.requestReveal(REVEAL_REQUEST), []);
  // The narrow beat completes; the queued reveal flushes as the gap-view
  // reveal beat (paint-variation + ease-to present, beat armed).
  // Note: the projection swap is now synchronous at narrow start (not via
  // the racy mid-flight crossing), so onMove does not emit set-projection.
  c.onSpinTimer();
  const done = c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center));
  assert.ok(
    done.some((i) => i.type === "paint-variation"),
    "queued reveal flushes at narrow completion",
  );
  assert.equal(c.beatKind, "reveal");
});

test("requestReveal during relock beat is queued, not dropped", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // Aim in SPACE, then pinch back in past 3.2 with the center outside the
  // region (Paris) → the 600 ms relock beat starts.
  c.onMove(snap(1.5, "globe"));
  c.onZoomEnd(snap(1.5, "globe"));
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "SPACE");
  c.onMove(snap(1.5, "globe", PARIS));
  c.onZoomEnd(snap(3.6, "globe", PARIS));
  assert.equal(c.beatKind, "relock");
  // The gesture's trailing moveend arrives; the beat stays active.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", PARIS)), []);
  assert.equal(c.beatActive, true);
  // Drop pin lands mid-beat (the adapter passes the live "globe"
  // projection): nothing emitted — but nothing dropped either.
  const midBeat = { ...REVEAL_REQUEST, projection: "globe" as ProjectionType };
  assert.deepEqual(c.requestReveal(midBeat), []);
  // The ease's own moveend completes the relock, then the queued reveal
  // flushes: lock + swap + re-enable, then the gap-view reveal beat.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: midBeat.variation },
    { type: "announce", message: "Showing your pin and the true spot." },
    {
      type: "ease-to",
      center: midBeat.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "reveal");
  // The reveal recovers fully: the gap-view ease completes and latches
  // terminal (reveal-done) — no further choreography.
  const revealDoneIntents = c.onMoveEnd(snap(6, "mercator"));
  assert.ok(
    revealDoneIntents.some((i) => i.type === "reveal-done"),
    "reveal beat should complete with reveal-done",
  );
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
});

test("miss reveal: single gap-view ease to the pin+spot framing, terminal at reveal-done", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // REVEAL_REQUEST pin→spot ≈ 139 km: under both big-miss branches → the
  // gap-view framing from buildRevealRequest (settleCenter/settleZoom).
  assert.deepEqual(c.requestReveal(REVEAL_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: REVEAL_REQUEST.variation },
    { type: "announce", message: "Showing your pin and the true spot." },
    {
      type: "ease-to",
      center: REVEAL_REQUEST.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "reveal");
  // The gap-view ease's moveend completes the reveal: terminal, latch set.
  assert.deepEqual(c.onMoveEnd(snap(6, "mercator")), [
    { type: "reveal-done" },
  ]);
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
  // Thresholds stay inert after the latch (no auto-return).
  c.onMove(snap(6));
  assert.deepEqual(c.onZoomEnd(snap(1.0)), []);
  c.onMoveEnd(snap(1.0, "globe"));
});

test("hit: light confirmation, synchronous, no camera move", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  assert.deepEqual(c.requestReveal(HIT_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: HIT_REQUEST.variation },
    { type: "announce", message: "Hit." },
    { type: "reveal-done" },
  ]);
  // No beat ever started: the camera stays where the pin landed.
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);
  assert.equal(c.revealDone, true);
  // A stale moveend cannot disturb the terminal state.
  assert.deepEqual(c.onMoveEnd(snap(4.5, "mercator")), []);
});

test("resetForNextPlace: T_OUT/T_IN evaluate again for the next place", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // Place 1: miss reveal → gap-view ease → terminal latch.
  c.requestReveal(REVEAL_REQUEST);
  c.onMoveEnd(snap(6, "mercator", NEBRASKA.center));
  assert.equal(c.revealDone, true);
  c.onMoveEnd(snap(1.0, "mercator"));

  // Continue → next place: per-place reset, no intents of its own.
  assert.deepEqual(c.resetForNextPlace(), []);
  assert.equal(c.revealDone, false);
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);

  // T_OUT fires again on a genuine zoom-out below 2.2.
  c.onMove(snap(6, "mercator", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(1.5, "mercator")), [
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "announce", message: "Space view" },
  ]);
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "SPACE");

  // T_IN fires again: the camera is below the framing, so the relock beat
  // eases up to it instead of snapping the lock on.
  c.onMove(snap(1.5, "globe", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    {
      type: "ease-to",
      center: NEBRASKA.center,
      zoom: 4.5,
      durationMs: 600,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "relock");
  // The gesture's trailing moveend: consumed, beat stays active.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", NEBRASKA.center)), []);
  assert.equal(c.beatActive, true);
  // The ease's own moveend: completion — lock lands snap-free at the framing.
  assert.deepEqual(c.onMoveEnd(snap(4.5, "globe", NEBRASKA.center)), [
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
});

test("resetForNextPlace: intro cannot re-fire", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.requestReveal(REVEAL_REQUEST);
  c.onMoveEnd(snap(6, "mercator", NEBRASKA.center));
  c.resetForNextPlace();
  // The intro stays single-shot per run: spin→narrow is requestNarrow-only.
  assert.deepEqual(c.requestNarrow(NEBRASKA, 4.5), []);
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);
  assert.equal(c.state, "REGION");
});

test("resetForNextPlace: region + projection survive — place 2 big-miss still pulls back", () => {
  const c = flatController();
  narrowToRegion(c, 6, SMALL_REGION);
  // Pin→spot ≈ 221 km: under the 500 km absolute line, but SMALL_REGION's
  // greater side is ≈ 111 km so 1.5 × 111 ≈ 167 km is crossed → big miss.
  const place1: RevealRequest = {
    variation: { label: "miss-line" },
    pin: [0, 0] as LngLat,
    spot: [0, 2] as LngLat,
    settleCenter: [0.5, 1] as LngLat,
    settleZoom: 6,
    hit: false,
    tileFailed: false,
    projection: "mercator",
  };
  // Place 1: big miss → release, then the single gap-view ease (camera left
  // at the pin+spot framing in the globe projection).
  c.requestReveal(place1);
  assert.equal(c.beatKind, "reveal");
  c.onMoveEnd(snap(6, "globe"));
  assert.equal(c.revealDone, true);
  assert.equal(c.projection, "globe");
  assert.equal(c.state, "SPACE");

  c.resetForNextPlace();
  // Camera continuity + projection tracking preserved …
  assert.equal(c.projection, "globe");
  assert.equal(c.state, "SPACE");
  // … and the region is still known: place 2's identical miss (now from the
  // space view, as the adapter would report) still releases to the globe and
  // runs the single gap-view ease.
  const place2: RevealRequest = { ...place1, projection: "globe" };
  assert.deepEqual(c.requestReveal(place2), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: place2.variation },
    { type: "announce", message: "Showing your pin and the true spot." },
    {
      type: "ease-to",
      center: [0.5, 1],
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "reveal");
});

test("big-miss reveal: release to globe, then the single gap-view ease", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // BIG_MISS_REQUEST pin→spot ≈ 7500 km: the core classifies the big miss
  // itself (no kind argument from the caller). A big miss releases to the
  // globe projection so both points fit honestly, then runs the same single
  // gap-view ease as a standard miss.
  assert.deepEqual(c.requestReveal(BIG_MISS_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: BIG_MISS_REQUEST.variation },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "announce", message: "Showing your pin and the true spot." },
    {
      type: "ease-to",
      center: BIG_MISS_REQUEST.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "reveal");
  // The gap-view ease's moveend completes the reveal: terminal, latch set.
  assert.deepEqual(c.onMoveEnd(snap(6, "globe")), [
    { type: "reveal-done" },
  ]);
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
});

test("big-miss ratio branch: 221 km miss on a 111 km region still releases", () => {
  const c = flatController();
  narrowToRegion(c, 6, SMALL_REGION);
  // Pin→spot ≈ 221 km: under the 500 km absolute line, but SMALL_REGION's
  // greater side is ≈ 111 km so 1.5 × 111 ≈ 167 km is crossed → big miss.
  const request: RevealRequest = {
    variation: { label: "miss-line" },
    pin: [0, 0] as LngLat,
    spot: [0, 2] as LngLat,
    settleCenter: [0.5, 1] as LngLat,
    settleZoom: 6,
    hit: false,
    tileFailed: false,
    projection: "mercator",
  };
  const intents = c.requestReveal(request);
  assert.equal(c.beatKind, "reveal");
  assert.ok(
    intents.some(
      (i) => i.type === "set-projection" && i.projection === "globe",
    ),
    "ratio-branch big miss releases to the globe",
  );
});

test("globe edition: no region → never a big miss", () => {
  const c = new ZoomSpaceController({
    edition: "globe",
    prefersReducedMotion: false,
  });
  c.requestNarrow(null, 0);
  c.onSpinTimer();
  c.onMoveEnd(snap(1.5, "globe", [0, 0]));
  assert.equal(c.state, "GLOBE");
  // Even a 7500 km pin→spot is a single gap-view ease — the camera is in
  // space and the framing fits both points.
  const intents = c.requestReveal(BIG_MISS_REQUEST);
  assert.equal(c.beatKind, "reveal");
  assert.ok(
    intents.every((i) => i.type !== "set-projection"),
    "no release swap in globe edition",
  );
});

test("requestReveal is gated on tile status; clearReveal is ungated", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  const failed = { ...REVEAL_REQUEST, tileFailed: true };
  assert.deepEqual(c.requestReveal(failed), []);
  assert.deepEqual(c.requestReveal({ ...BIG_MISS_REQUEST, tileFailed: true }), []);
  assert.equal(c.beatActive, false);
  assert.deepEqual(c.clearReveal(), [{ type: "clear-variation" }]);
});

test("clearReveal fires even mid-beat", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5); // spin beat active
  assert.deepEqual(c.clearReveal(), [{ type: "clear-variation" }]);
});

test("reduced motion: no spin, synchronous jump + immediate completion", () => {
  const c = flatController(true);
  const intents = c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(intents, [
    { type: "gestures", enabled: false },
    { type: "rearm-tiles" },
    { type: "set-projection", projection: "mercator" },
    { type: "jump-to", center: NEBRASKA.center, zoom: 4.5 },
    { type: "paint-highlight", feature: NEBRASKA },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "a11y-intro", active: false },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.ok(intents.every((i) => i.type !== "spin"));
  assert.equal(c.beatActive, false);
  assert.equal(c.state, "REGION");
});

test("reduced motion: miss jumps straight to the gap framing, synchronously complete", () => {
  const c = flatController(true);
  narrowToRegion(c, 4.5);
  // Big miss (classified by the core) still releases to the globe, then a
  // single jump cut lands the gap framing — no timers, no animation, no
  // further beats.
  assert.deepEqual(c.requestReveal(BIG_MISS_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: BIG_MISS_REQUEST.variation },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "announce", message: "Showing your pin and the true spot." },
    {
      type: "jump-to",
      center: BIG_MISS_REQUEST.settleCenter,
      zoom: BIG_MISS_REQUEST.settleZoom,
    },
    { type: "reveal-done" },
  ]);
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);
});

test("reduced motion: hit completes synchronously with no camera intent", () => {
  const c = flatController(true);
  narrowToRegion(c, 4.5);
  const intents = c.requestReveal(HIT_REQUEST);
  assert.deepEqual(intents, [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: HIT_REQUEST.variation },
    { type: "announce", message: "Hit." },
    { type: "reveal-done" },
  ]);
  assert.ok(
    !intents.some((i) => i.type === "jump-to" || i.type === "ease-to"),
    "hit never moves the camera",
  );
  assert.equal(c.revealDone, true);
});

test("globe edition: degenerate narrow-in, thresholds inert", () => {
  const c = new ZoomSpaceController({
    edition: "globe",
    prefersReducedMotion: false,
  });
  c.requestNarrow(null, 0);
  assert.equal(c.beatKind, "spin");
  assert.deepEqual(c.onSpinTimer(), [
    { type: "spin", active: false },
    {
      type: "ease-to",
      center: [0, 0],
      zoom: 1.5,
      bearing: 0,
      durationMs: 800,
      easing: "easeInOutCubic",
    },
  ]);
  assert.deepEqual(c.onMoveEnd(snap(1.5, "globe")), [
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "a11y-intro", active: false },
    { type: "announce", message: "Globe view" },
  ]);
  assert.equal(c.state, "GLOBE");
  c.onMove(snap(1.5, "globe"));
  assert.deepEqual(c.onZoomEnd(snap(4.0, "globe")), []);
  c.onMoveEnd(snap(4.0, "globe"));
  assert.equal(c.state, "GLOBE");
});

/* --- Gap-view answer reveal --- */

function globeController(reducedMotion = false): ZoomSpaceController {
  return new ZoomSpaceController({
    edition: "globe",
    prefersReducedMotion: reducedMotion,
  });
}

/** Drive requestNarrow for the globe edition (degenerate narrow-in). */
function narrowToGlobe(c: ZoomSpaceController): void {
  const start = c.requestNarrow(null, 1.5);
  if (!c.beatActive) return; // reduced motion: synchronous narrow-in.
  assert.equal(start[1]?.type, "spin");
  c.onSpinTimer();
  c.onMoveEnd(snap(1.5, "globe"));
  assert.equal(c.state, "GLOBE");
}

/** Complete the gap-view reveal beat after its start (ease → reveal-done). */
function completeReveal(
  c: ZoomSpaceController,
  zoom: number,
  projection: ProjectionType = "mercator",
): void {
  assert.equal(c.beatKind, "reveal");
  const done = c.onMoveEnd(snap(zoom, projection));
  assert.ok(
    done.some((i) => i.type === "reveal-done"),
    "reveal should end with reveal-done",
  );
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
}

/** Run a miss reveal through to the gap-view beat start. */
function startReveal(c: ZoomSpaceController): void {
  c.requestReveal(REVEAL_REQUEST);
  assert.equal(c.beatKind, "reveal");
}

test("reveal constants", () => {
  assert.equal(REVEAL_DURATION_MS, 2200);
  assert.equal(RETURN_DURATION_MS, 1200);
});

test("reveal: skip during the gap-view beat jumps to the end state", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.requestReveal(REVEAL_REQUEST);
  assert.equal(c.beatKind, "reveal");
  assert.deepEqual(c.skipChoreography(), [
    {
      type: "jump-to",
      center: REVEAL_REQUEST.settleCenter,
      zoom: REVEAL_REQUEST.settleZoom,
    },
    { type: "reveal-done" },
  ]);
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
});

test("reveal: skip during the big-miss beat jumps to the gap framing", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.requestReveal(BIG_MISS_REQUEST);
  assert.equal(c.beatKind, "reveal");
  const skipped = c.skipChoreography();
  assert.ok(
    skipped.some(
      (i) =>
        i.type === "jump-to" &&
        i.center[0] === BIG_MISS_REQUEST.settleCenter[0] &&
        i.center[1] === BIG_MISS_REQUEST.settleCenter[1],
    ),
    "skip should jump to the gap-view framing",
  );
  assert.ok(
    skipped.some((i) => i.type === "reveal-done"),
    "skip should end the reveal",
  );
  assert.equal(c.revealDone, true);
});

test("reveal: skip is a no-op outside the reveal beat", () => {
  const c = flatController();
  assert.deepEqual(c.skipChoreography(), []);
  narrowToRegion(c, 4.5);
  assert.deepEqual(c.skipChoreography(), []);
  // A hit completes synchronously — no beat to skip.
  c.requestReveal(HIT_REQUEST);
  assert.deepEqual(c.skipChoreography(), []);
  // After the miss reveal completes, skipping does nothing.
  c.resetForNextPlace();
  c.requestReveal(REVEAL_REQUEST);
  c.onMoveEnd(snap(6, "mercator"));
  assert.deepEqual(c.skipChoreography(), []);
});

test("reveal: a queued mid-beat commit flushes with no intermediate reveal-done", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.requestReveal(REVEAL_REQUEST);
  // A commit landing mid-beat queues; the flush starts a fresh reveal beat
  // with the latest framing.
  const second = { ...REVEAL_REQUEST, settleZoom: 7 };
  c.requestReveal(second);
  const flushed = c.onMoveEnd(snap(6, "mercator"));
  assert.ok(
    !flushed.some((i) => i.type === "reveal-done"),
    "no intermediate reveal-done when a queued reveal flushes",
  );
  assert.ok(
    flushed.some((i) => i.type === "ease-to" && i.zoom === 7),
    "queued reveal flushes as a fresh gap-view beat",
  );
  assert.equal(c.beatKind, "reveal");
  assert.equal(c.revealDone, false);
  // The flushed beat completes terminally on its own moveend.
  assert.deepEqual(c.onMoveEnd(snap(7, "mercator")), [
    { type: "reveal-done" },
  ]);
  assert.equal(c.revealDone, true);
  // Skip during the flushed beat targets the latest framing.
  c.resetForNextPlace();
  c.requestReveal(REVEAL_REQUEST);
  c.requestReveal(second);
  c.onMoveEnd(snap(6, "mercator"));
  const skipped = c.skipChoreography();
  assert.ok(
    skipped.some((i) => i.type === "jump-to" && i.zoom === 7),
    "skip should jump to the latest reveal framing",
  );
  assert.ok(skipped.some((i) => i.type === "reveal-done"));
});

test("return: continue eases back to the region framing, re-arms taps", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  startReveal(c);
  completeReveal(c, 6, "mercator");
  assert.equal(c.revealDone, true);
  // Continue → next place.
  assert.deepEqual(c.resetForNextPlace(), []);
  assert.equal(c.revealDone, false);
  // Tap handlers re-arm immediately on continue (the reveal left them
  // detached); the user can place the next pin while the camera eases back.
  assert.deepEqual(c.beginReturn(), [
    { type: "tap-handlers", enabled: true },
    {
      type: "ease-to",
      center: NEBRASKA.center,
      zoom: 4.5,
      durationMs: 1200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "return");
  // Return completion re-arms the aim gesture model; the next place's
  // thresholds evaluate again.
  const done = c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center));
  assert.ok(
    done.some((i) => i.type === "tap-handlers" && i.enabled === true),
    "return should re-arm tap handlers",
  );
  assert.ok(
    done.some((i) => i.type === "gestures" && i.enabled === true),
    "return should re-enable gestures",
  );
  assert.equal(c.beatActive, false);
  assert.equal(c.beatKind, null);
  // The next reveal still runs the gap-view beat.
  c.requestReveal(REVEAL_REQUEST);
  assert.equal(c.beatKind, "reveal");
});

test("return: reduced motion is a jump cut with immediate re-arm", () => {
  const c = flatController(true);
  narrowToRegion(c, 4.5);
  c.requestReveal(REVEAL_REQUEST);
  assert.equal(c.revealDone, true);
  c.resetForNextPlace();
  assert.deepEqual(c.beginReturn(), [
    { type: "jump-to", center: NEBRASKA.center, zoom: 4.5 },
    { type: "tap-handlers", enabled: true },
    { type: "gestures", enabled: true },
  ]);
  assert.equal(c.beatActive, false);
});

test("return: globe edition eases home and re-arms on completion", () => {
  const c = globeController();
  narrowToGlobe(c);
  c.requestReveal({ ...REVEAL_REQUEST, projection: "globe" });
  completeReveal(c, 6, "globe");
  c.resetForNextPlace();
  const ret = c.beginReturn();
  assert.ok(
    ret.some(
      (i) =>
        i.type === "ease-to" &&
        i.center[0] === 0 &&
        i.center[1] === 0 &&
        i.zoom === 1.5,
    ),
    "globe return should ease home",
  );
  const done = c.onMoveEnd(snap(1.5, "globe"));
  assert.ok(
    done.some((i) => i.type === "tap-handlers" && i.enabled === true),
    "globe return should re-arm tap handlers",
  );
  assert.ok(
    done.some((i) => i.type === "gestures" && i.enabled === true),
    "globe return should re-enable gestures",
  );
  assert.equal(c.beatActive, false);
});

test("return: mid-return commit queues and flushes on completion", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // Place 1: miss reveal → gap-view beat → done.
  c.requestReveal(REVEAL_REQUEST);
  completeReveal(c, 6, "mercator");
  // Continue → return beat starts.
  c.resetForNextPlace();
  c.beginReturn();
  assert.equal(c.beatKind, "return");
  // Fast player commits mid-return: queued, not dropped.
  assert.deepEqual(c.requestReveal(REVEAL_REQUEST), []);
  // Return completes: the queued reveal flushes into a fresh gap-view beat.
  const done = c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center));
  assert.ok(
    done.some((i) => i.type === "ease-to"),
    "queued reveal should flush as a new beat",
  );
  assert.equal(c.beatKind, "reveal");
});
