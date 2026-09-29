/**
 * Unit tests for the zoom-space state machine — pure, node-testable like
 * `tile-status.test.ts`. The adapter (satellite-map.tsx) is exercised by E2E;
 * here we pin the transition logic: directed thresholds, the hysteresis band,
 * beat choreography, and the terminal reveal latch.
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
  RevealDetails,
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

const REVEAL_DETAILS: RevealDetails = {
  variation: { label: "miss-line" },
  pin: [-99.0, 41.0] as LngLat,
  spot: [-98.0, 42.0] as LngLat,
  settleCenter: [-98.5, 41.5] as LngLat,
  settleZoom: 6,
  tileFailed: false,
  projection: "mercator",
};

/** Drive requestNarrow → spin → narrow to REGION, via the crossing swap. */
function narrowToRegion(
  c: ZoomSpaceController,
  settleZoom = 4.5,
): void {
  const start = c.requestNarrow(NEBRASKA, settleZoom);
  if (c.state === "REGION") return; // reduced motion: synchronous narrow-in.
  assert.equal(start[2]?.type, "spin");
  c.onSpinTimer();
  if (settleZoom >= Z_FLAT_IN) {
    const crossed = c.onMove(snap(settleZoom, "globe"));
    assert.deepEqual(crossed, [
      { type: "set-projection", projection: "mercator" },
    ]);
  }
  const done = c.onMoveEnd(snap(settleZoom, "mercator", NEBRASKA.center));
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

test("requestNarrow emits disarm + tile re-arm + spin (uniform first intent)", () => {
  const c = flatController();
  assert.deepEqual(c.requestNarrow(NEBRASKA, 4.5), [
    { type: "gestures", enabled: false },
    { type: "rearm-tiles" },
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

test("onSpinHalt stops the spin without chaining (variant-A surface)", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5);
  assert.deepEqual(c.onSpinHalt(), [{ type: "spin", active: false }]);
  assert.equal(c.beatActive, false);
  assert.deepEqual(c.onSpinTimer(), []);
});

test("standard reveal: single settle beat, terminal latch, thresholds inert", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  assert.deepEqual(c.requestReveal("standard", REVEAL_DETAILS), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "paint-variation", variation: REVEAL_DETAILS.variation },
    {
      type: "ease-to",
      center: REVEAL_DETAILS.settleCenter,
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

test("big-miss reveal: release + pull-back, hold, settle", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  assert.deepEqual(c.requestReveal("big-miss", REVEAL_DETAILS), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "paint-variation", variation: REVEAL_DETAILS.variation },
    {
      type: "ease-to",
      center: [-98.5, 41.5],
      zoom: 2.0,
      durationMs: 1400,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "pullback");
  // Pull-back moveend: hold — beat stays active, no intents.
  assert.deepEqual(c.onMoveEnd(snap(2.0, "globe")), []);
  assert.equal(c.beatActive, true);
  assert.equal(c.awaitingRevealHold, true);
  // Hold timer expiry: the settle beat.
  assert.deepEqual(c.onRevealHoldTimer(), [
    {
      type: "ease-to",
      center: REVEAL_DETAILS.settleCenter,
      zoom: 6,
      durationMs: 2200,
      easing: "easeInOutCubic",
    },
  ]);
  assert.equal(c.beatKind, "settle");
  assert.equal(c.awaitingRevealHold, false);
  c.onMoveEnd(snap(6, "globe"));
  assert.equal(c.revealDone, true);
});

test("requestReveal is gated on tile status; clear-variation is ungated", () => {
  const c = flatController();
  narrowToRegion(c, 4.5);
  const failed = { ...REVEAL_DETAILS, tileFailed: true };
  assert.deepEqual(c.requestReveal("standard", failed), []);
  assert.deepEqual(c.requestReveal("big-miss", failed), []);
  assert.equal(c.beatActive, false);
  assert.deepEqual(c.requestReveal("clear"), [{ type: "clear-variation" }]);
});

test("requestReveal cannot start mid-beat", () => {
  const c = flatController();
  c.requestNarrow(NEBRASKA, 4.5); // spin beat active
  assert.deepEqual(c.requestReveal("standard", REVEAL_DETAILS), []);
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
  assert.deepEqual(c.requestReveal("big-miss", REVEAL_DETAILS), [
    { type: "gestures", enabled: false },
    { type: "tap-handlers", enabled: false },
    { type: "set-projection", projection: "globe" },
    { type: "set-max-bounds", bounds: null },
    { type: "paint-variation", variation: REVEAL_DETAILS.variation },
    {
      type: "jump-to",
      center: REVEAL_DETAILS.settleCenter,
      zoom: REVEAL_DETAILS.settleZoom,
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
