import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStraightTrail,
  buildTourPath,
  pointRectDistance,
  type DocRect,
  type TourMeasurements,
} from "./grandpa-tour.ts";

function rect(left: number, top: number, right: number, bottom: number): DocRect {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Nominal 390px home layout: 3 stops, buttons inset ≥20px in the cards. */
function nominalMeasurements(): TourMeasurements {
  return {
    viewportWidth: 390,
    docHeight: 1400,
    stops: [
      { key: "difficulty", rect: rect(20, 200, 370, 300) },
      { key: "geodetective", rect: rect(20, 332, 370, 520) },
      { key: "editions", rect: rect(20, 560, 370, 800) },
    ],
    interactives: [
      rect(24, 222, 300, 266), // difficulty seg buttons
      rect(40, 440, 220, 484), // geodetective CTA
      rect(40, 700, 330, 744), // edition CTA (right edge W-60)
    ],
    originY: 60,
    stripTop: 1000,
    bench: { x: 186, y: 1170 },
  };
}

test("buildTourPath weaves alternating gutters with a stop per card", () => {
  const g = buildTourPath(nominalMeasurements());
  assert.ok(g, "expected a geometry");
  assert.equal(g.simplified, false);
  assert.deepEqual(g.stopSides, ["right", "left", "right"]);
  assert.equal(g.stopDistances.length, 3);
  // Distances strictly increase along the walk; pour sits before the end.
  assert.ok(g.stopDistances[0] > 0);
  assert.ok(g.stopDistances[1] > g.stopDistances[0]);
  assert.ok(g.stopDistances[2] > g.stopDistances[1]);
  assert.ok(g.pourDistance > g.stopDistances[2]);
  assert.ok(g.totalLength > g.pourDistance);
  assert.match(g.d, /^M /);
});

test("buildTourPath includes the review stop when present", () => {
  const m = nominalMeasurements();
  m.stops = [
    ...m.stops,
    { key: "review", rect: rect(20, 832, 370, 960) },
  ];
  m.stripTop = 1040;
  m.bench = { x: 186, y: 1210 };
  const g = buildTourPath(m);
  assert.ok(g, "expected a geometry");
  assert.deepEqual(g.stopSides, ["right", "left", "right", "left"]);
  assert.equal(g.stopDistances.length, 4);
});

test("buildTourPath rejects a missing required stop", () => {
  const m = nominalMeasurements();
  m.stops = m.stops.filter((s) => s.key !== "editions");
  assert.equal(buildTourPath(m), null);
});

test("buildTourPath rejects out-of-order stops", () => {
  const m = nominalMeasurements();
  m.stops = [m.stops[1], m.stops[0], m.stops[2]];
  assert.equal(buildTourPath(m), null);
});

test("buildTourPath rejects a gap too small for a crossing", () => {
  const m = nominalMeasurements();
  // 20px gap between geodetective and editions (< 32px minimum).
  m.stops[2] = { key: "editions", rect: rect(20, 540, 370, 800) };
  assert.equal(buildTourPath(m), null);
});

test("buildTourPath rejects when an interactive crowds the gutter", () => {
  const m = nominalMeasurements();
  // A button hugging the left edge beside the geodetective stop: the left
  // gutter run would pass within 16px of it.
  m.interactives = [
    ...m.interactives,
    rect(20, 360, 120, 404),
  ];
  assert.equal(buildTourPath(m), null);
});

test("buildTourPath rejects narrow viewports", () => {
  const m = nominalMeasurements();
  m.viewportWidth = 300;
  assert.equal(buildTourPath(m), null);
});

test("buildStraightTrail builds a stop-free right-gutter trail", () => {
  const g = buildStraightTrail(nominalMeasurements());
  assert.ok(g, "expected a geometry");
  assert.equal(g.simplified, true);
  assert.deepEqual(g.stopDistances, []);
  assert.ok(g.pourDistance > 0);
  assert.ok(g.totalLength > g.pourDistance);
  // Starts top-right, ends at the bench.
  assert.match(g.d, /^M 376 84/);
  assert.ok(g.d.endsWith("186 1170"));
});

test("buildStraightTrail rejects when the gutter is crowded", () => {
  const m = nominalMeasurements();
  // An interactive hugging the right edge along the straight run.
  m.interactives = [...m.interactives, rect(340, 400, 372, 444)];
  assert.equal(buildStraightTrail(m), null);
});

test("pointRectDistance is 0 inside, Euclidean outside", () => {
  const r = rect(10, 10, 20, 20);
  assert.equal(pointRectDistance({ x: 15, y: 15 }, r), 0);
  assert.equal(pointRectDistance({ x: 25, y: 15 }, r), 5);
  assert.equal(pointRectDistance({ x: 25, y: 25 }, r), Math.hypot(5, 5));
});
