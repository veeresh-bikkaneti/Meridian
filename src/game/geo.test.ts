import assert from "node:assert/strict";
import test from "node:test";
import { initialBearing, octantOf } from "./geo.ts";

const NYC: [number, number] = [-74.006, 40.7128];
const LONDON: [number, number] = [-0.1278, 51.5074];
const SYDNEY: [number, number] = [151.2093, -33.8688];
const TOKYO: [number, number] = [139.6917, 35.6895];

test("initialBearing: NYC to London is ~51 degrees (north-east)", () => {
  const b = initialBearing(NYC, LONDON);
  assert.ok(b > 50 && b < 53, `expected ~51, got ${b}`);
  assert.equal(octantOf(b), "north-east");
});

test("initialBearing: Sydney to Tokyo is just west of due north", () => {
  const b = initialBearing(SYDNEY, TOKYO);
  assert.ok(b > 345 && b < 355, `expected ~350, got ${b}`);
  assert.equal(octantOf(b), "north");
});

test("initialBearing: cardinal directions", () => {
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
      const bearing = initialBearing(a, b);
      assert.ok(bearing >= 0 && bearing < 360, `out of range: ${bearing}`);
      assert.equal(octantOf(bearing).length > 0, true);
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
