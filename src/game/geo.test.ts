import assert from "node:assert/strict";
import test from "node:test";
import { initialBearing, octantOf, windName8 } from "./geo.ts";

const NYC: [number, number] = [-74.006, 40.7128];
const LONDON: [number, number] = [-0.1278, 51.5074];
const SYDNEY: [number, number] = [151.2093, -33.8688];
const TOKYO: [number, number] = [139.6917, 35.6895];

/** initialBearing is null only for coincident points — assert non-null in tests. */
function bearing(a: [number, number], b: [number, number]): number {
  const v = initialBearing(a, b);
  assert.ok(v !== null, `expected a bearing from ${a} to ${b}, got null`);
  return v;
}

// ---------------------------------------------------------------------------
// initialBearing + octantOf (GeoDetective bearing feedback)
// ---------------------------------------------------------------------------

test("initialBearing: NYC to London is ~51 degrees (north-east)", () => {
  const b = bearing(NYC, LONDON);
  assert.ok(b > 50 && b < 53, `expected ~51, got ${b}`);
  assert.equal(octantOf(b), "north-east");
});

test("initialBearing: Sydney to Tokyo is just west of due north", () => {
  const b = bearing(SYDNEY, TOKYO);
  assert.ok(b > 345 && b < 355, `expected ~350, got ${b}`);
  assert.equal(octantOf(b), "north");
});

test("initialBearing: the four cardinals from the equator", () => {
  assert.equal(initialBearing([0, 0], [0, 10]), 0); // due north
  assert.equal(initialBearing([0, 0], [10, 0]), 90); // due east
  assert.equal(initialBearing([0, 0], [0, -10]), 180); // due south
  assert.equal(initialBearing([0, 0], [-10, 0]), 270); // due west
});

test("initialBearing: always in [0, 360)", () => {
  const pts: [number, number][] = [
    [0, 0],
    [179, 89],
    [-179, -89],
    [45, 45],
  ];
  for (const a of pts) {
    for (const b of pts) {
      if (a[0] === b[0] && a[1] === b[1]) continue; // coincident → null
      const bng = bearing(a, b);
      assert.ok(bng >= 0 && bng < 360, `out of range: ${bng}`);
      assert.equal(octantOf(bng).length > 0, true);
    }
  }
});

test("octantOf: 8 winds at their centers", () => {
  assert.equal(octantOf(0), "north");
  assert.equal(octantOf(45), "north-east");
  assert.equal(octantOf(90), "east");
  assert.equal(octantOf(135), "south-east");
  assert.equal(octantOf(180), "south");
  assert.equal(octantOf(225), "south-west");
  assert.equal(octantOf(270), "west");
  assert.equal(octantOf(315), "north-west");
});

test("octantOf: sector boundaries (N = 337.5–22.5, NE = 22.5–67.5, …)", () => {
  assert.equal(octantOf(22.4), "north");
  assert.equal(octantOf(22.5), "north-east");
  assert.equal(octantOf(67.4), "north-east");
  assert.equal(octantOf(67.5), "east");
  assert.equal(octantOf(112.5), "south-east");
  assert.equal(octantOf(337.4), "north-west");
  assert.equal(octantOf(337.5), "north");
  assert.equal(octantOf(359.9), "north");
});

test("octantOf: wraps negatives and >360", () => {
  assert.equal(octantOf(-45), "north-west");
  assert.equal(octantOf(360), "north");
  assert.equal(octantOf(405), "north-east");
  assert.equal(octantOf(720 + 200), "south");
});

// ---------------------------------------------------------------------------
// initialBearing + windName8 (reveal-card bearing, e.g. "457 km northeast")
// ---------------------------------------------------------------------------

const CLOSE = 0.01;
function near(actual: number | null, expected: number): void {
  assert.ok(
    actual !== null && Math.abs(actual - expected) < CLOSE,
    `expected bearing ≈ ${expected}°, got ${actual}`,
  );
}

test("initialBearing: the four diagonals snap to the right winds", () => {
  // On a sphere the great-circle initial bearing for a diagonal target is
  // not exactly 45° (44.56° here); the wind snap absorbs that — the wind
  // is what the card shows, so the wind is the contract.
  const cases: Array<[number, number, string]> = [
    [10, 10, "northeast"],
    [10, -10, "southeast"],
    [-10, -10, "southwest"],
    [-10, 10, "northwest"],
  ];
  for (const [lon, lat, wind] of cases) {
    const b = initialBearing([0, 0], [lon, lat]);
    assert.ok(b !== null, `bearing from (0,0) to (${lon},${lat}) must exist`);
    assert.equal(windName8(b), wind);
  }
});

test("initialBearing: coincident points return null", () => {
  assert.equal(initialBearing([0, 0], [0, 0]), null);
  assert.equal(initialBearing([-96.7, 40.8], [-96.7, 40.8]), null);
});

test("windName8: all eight winds at their wedge centers", () => {
  assert.equal(windName8(0), "north");
  assert.equal(windName8(45), "northeast");
  assert.equal(windName8(90), "east");
  assert.equal(windName8(135), "southeast");
  assert.equal(windName8(180), "south");
  assert.equal(windName8(225), "southwest");
  assert.equal(windName8(270), "west");
  assert.equal(windName8(315), "northwest");
});

test("windName8: boundary angles round up to the next wind", () => {
  assert.equal(windName8(22.5), "northeast");
  assert.equal(windName8(67.5), "east");
  assert.equal(windName8(112.5), "southeast");
  assert.equal(windName8(157.5), "south");
  assert.equal(windName8(202.5), "southwest");
  assert.equal(windName8(247.5), "west");
  assert.equal(windName8(292.5), "northwest");
  assert.equal(windName8(337.5), "north");
});

test("windName8: just inside the previous wedge stays there", () => {
  assert.equal(windName8(22.4), "north");
  assert.equal(windName8(337.4), "northwest");
  assert.equal(windName8(67.4), "northeast");
});

test("windName8: normalizes out-of-range inputs", () => {
  assert.equal(windName8(360), "north");
  assert.equal(windName8(405), "northeast");
  assert.equal(windName8(-22.5), "north");
  assert.equal(windName8(-45), "northwest");
  assert.equal(windName8(720), "north");
});

test("initialBearing + windName8 compose for real miss vectors", () => {
  // Player in Lincoln, NE misses a place due north of them.
  const b = initialBearing([-96.7, 40.8], [-96.7, 44.0]);
  assert.ok(b !== null);
  assert.equal(windName8(b), "north");
  // Player in Lincoln misses a place in the southeastern US.
  const b2 = initialBearing([-96.7, 40.8], [-80.0, 32.0]);
  assert.ok(b2 !== null);
  assert.equal(windName8(b2), "southeast");
});
