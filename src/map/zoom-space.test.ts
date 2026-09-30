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
  tileFailed: false,
  projection: "mercator",
};

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
  c.onSpinTimer();
  if (settleZoom >= Z_FLAT_IN) {
    const crossed = c.onMove(snap(settleZoom, "globe"));
    assert.deepEqual(crossed, [
      { type: "set-projection", projection: "mercator" },
    ]);
  }
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
  assert.equal(SPIN_SPEED_DPS, 6);
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

test("spin timer chains into the narrow beat (crossing-armed path)", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(c.onSpinTimer(), [
    { type: "spin", active: false },
    // Tile-honesty re-arm opens the narrow phase (full watchdog budget from
    // narrow start, not from the intro spin).
    { type: "rearm-tiles" },
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
  // No synchronous swap on the standard path — the crossing is armed instead.
  assert.equal(c.projection, "globe");
});

test("narrow crossing swap fires one-shot at Z_FLAT_IN via onMove", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  assert.deepEqual(c.onMove(snap(2.5, "globe")), []);
  assert.deepEqual(c.onMove(snap(3.4, "globe")), [
    { type: "set-projection", projection: "mercator" },
  ]);
  assert.deepEqual(c.onMove(snap(4.0, "mercator")), []);
});

test("narrow completion locks, highlights, enables, announces (crossing path)", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  c.onMove(snap(4.5, "mercator"));
  assert.deepEqual(c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center)), [
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
    { type: "paint-highlight", feature: NEBRASKA },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "a11y-intro", active: false },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
  assert.equal(c.beatActive, false);
});

test("narrow completion belt-and-braces: swap+lock when crossing never fired", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  c.onSpinTimer();
  // No onMove ≥ 3.2 was ever forwarded: projection is still globe.
  const done = c.onMoveEnd(snap(4.5, "globe", NEBRASKA.center));
  assert.deepEqual(done[0], { type: "set-projection", projection: "mercator" });
  assert.deepEqual(done[1], {
    type: "set-max-bounds",
    bounds: NEBRASKA.bounds,
  });
  assert.equal(c.state, "REGION");
});

test("large-country path: synchronous swap at narrow beat start", () => {
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
  // Pinch in past 3.2 with the center outside the region (Paris).
  c.onMove(snap(1.5, "globe", PARIS));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", PARIS)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    {
      type: "ease-to",
      center: NEBRASKA.center,
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
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.state, "REGION");
});

test("T_IN is zero-length when the center is already in-bounds", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  c.onMove(snap(1.5, "globe"));
  c.onZoomEnd(snap(1.5, "globe"));
  c.onMoveEnd(snap(1.5, "globe"));
  c.onMove(snap(1.5, "globe", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
  ]);
  assert.equal(c.beatActive, false);
  assert.equal(c.state, "REGION");
  // Trailing gesture moveend: plain no-op.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "mercator", NEBRASKA.center)), []);
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
  // The narrow beat completes; the queued reveal flushes as the standard
  // settle beat (paint-variation + ease-to present, beat armed).
  c.onSpinTimer();
  const crossed = c.onMove(snap(4.5, "globe"));
  assert.deepEqual(crossed, [{ type: "set-projection", projection: "mercator" }]);
  const done = c.onMoveEnd(snap(4.5, "mercator", NEBRASKA.center));
  assert.ok(
    done.some((i) => i.type === "paint-variation"),
    "queued reveal flushes at narrow completion",
  );
  assert.equal(c.beatKind, "settle");
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
  // flushes: lock + swap + re-enable, then the standard settle beat.
  assert.deepEqual(c.onMoveEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
    { type: "set-projection", projection: "mercator" },
    { type: "gestures", enabled: true },
    { type: "tap-handlers", enabled: true },
    { type: "announce", message: "Nebraska view" },
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: midBeat.variation },
    {
      type: "ease-to",
      center: midBeat.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "settle");
  // The reveal recovers fully: the settle beat completes terminally.
  assert.deepEqual(c.onMoveEnd(snap(6, "mercator")), [
    { type: "gestures", enabled: true },
  ]);
  assert.equal(c.revealDone, true);
});

test("standard reveal: single settle beat, terminal latch, thresholds inert", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // REVEAL_REQUEST pin→spot ≈ 139 km: under both big-miss branches → standard.
  assert.deepEqual(c.requestReveal(REVEAL_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: REVEAL_REQUEST.variation },
    {
      type: "ease-to",
      center: REVEAL_REQUEST.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "settle");
  assert.deepEqual(c.onMoveEnd(snap(6, "mercator")), [
    { type: "gestures", enabled: true },
  ]);
  assert.equal(c.revealDone, true);
  // No auto-return: zooming back out past the thresholds does nothing.
  c.onMove(snap(6));
  assert.deepEqual(c.onZoomEnd(snap(1.0)), []);
  c.onMoveEnd(snap(1.0, "globe"));
});

test("resetForNextPlace: T_OUT/T_IN evaluate again for the next place", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // Place 1: standard reveal → terminal latch, thresholds inert.
  c.requestReveal(REVEAL_REQUEST);
  c.onMoveEnd(snap(6, "mercator", NEBRASKA.center));
  assert.equal(c.revealDone, true);
  c.onMove(snap(6, "mercator", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(1.0, "mercator")), []);
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

  // T_IN fires again: zero-length relock, center already in-bounds.
  c.onMove(snap(1.5, "globe", NEBRASKA.center));
  assert.deepEqual(c.onZoomEnd(snap(3.6, "globe", NEBRASKA.center)), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
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
    tileFailed: false,
    projection: "mercator",
  };
  // Place 1: big miss → release, pull-back, hold, settle (camera left in space).
  c.requestReveal(place1);
  assert.equal(c.beatKind, "pullback");
  c.onMoveEnd(snap(2.0, "globe"));
  c.onRevealHoldTimer();
  c.onMoveEnd(snap(6, "globe"));
  assert.equal(c.revealDone, true);
  assert.equal(c.projection, "globe");
  assert.equal(c.state, "SPACE");

  c.resetForNextPlace();
  // Camera continuity + projection tracking preserved …
  assert.equal(c.projection, "globe");
  assert.equal(c.state, "SPACE");
  // … and the region is still known: place 2's identical miss (now from the
  // space view, as the adapter would report) still runs the pull-back beat.
  const place2: RevealRequest = { ...place1, projection: "globe" };
  assert.deepEqual(c.requestReveal(place2), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: place2.variation },
    {
      type: "ease-to",
      center: [0, 1],
      zoom: 2.0,
      durationMs: 1400,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "pullback");
});

test("big-miss reveal: release + pull-back, hold, settle", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  // BIG_MISS_REQUEST pin→spot ≈ 7500 km: the core classifies the big miss
  // itself (no kind argument from the caller).
  assert.deepEqual(c.requestReveal(BIG_MISS_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "paint-variation", variation: BIG_MISS_REQUEST.variation },
    {
      type: "ease-to",
      center: [-48.325, 44.925],
      zoom: 2.0,
      durationMs: 1400,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "pullback");
  // Pull-back moveend: the `reveal-hold` intent arms the adapter's hold
  // timer; the beat stays active through the hold.
  assert.deepEqual(c.onMoveEnd(snap(2.0, "globe")), [
    { type: "reveal-hold", durationMs: 500 },
  ]);
  assert.equal(c.beatActive, true);
  assert.equal(c.beatKind, "pullback");
  // Hold timer expiry: the settle beat.
  assert.deepEqual(c.onRevealHoldTimer(), [
    {
      type: "ease-to",
      center: BIG_MISS_REQUEST.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "settle");
  c.onMoveEnd(snap(6, "globe"));
  assert.equal(c.revealDone, true);
});

test("big-miss ratio branch: 221 km miss on a 111 km region still pulls back", () => {
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
    tileFailed: false,
    projection: "mercator",
  };
  const intents = c.requestReveal(request);
  assert.equal(c.beatKind, "pullback");
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
  // Even a 7500 km pin→spot is a standard settle — the camera is in space.
  const intents = c.requestReveal(BIG_MISS_REQUEST);
  assert.equal(c.beatKind, "settle");
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
    { type: "set-max-bounds", bounds: NEBRASKA.bounds },
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

test("reduced motion: reveal jumps straight to the final framing", () => {
  const c = flatController(true);
  narrowToRegion(c, 4.5);
  // Big miss (classified by the core) still releases, then jumps — no hold.
  assert.deepEqual(c.requestReveal(BIG_MISS_REQUEST), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "paint-variation", variation: BIG_MISS_REQUEST.variation },
    {
      type: "jump-to",
      center: BIG_MISS_REQUEST.settleCenter,
      zoom: BIG_MISS_REQUEST.settleZoom,
    },
    { type: "gestures", enabled: true },
  ]);
  assert.equal(c.revealDone, true);
  assert.equal(c.beatActive, false);
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
