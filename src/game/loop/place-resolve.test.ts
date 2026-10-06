import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildPlaceGrid, nearestPlace } from "./place-resolve.ts";
import type { LoopNameEntry } from "./types.ts";

function entry(id: string, lon: number, lat: number): LoopNameEntry {
  return { n: id, id, lon, lat, r: "", p: 1 };
}

const ENTRIES = [
  entry("a", 2.35, 48.85), // Paris-ish
  entry("b", -0.12, 51.5), // London-ish
  entry("c", 139.7, 35.7), // Tokyo-ish
];

test("nearestPlace finds the closest entry within range", () => {
  const grid = buildPlaceGrid(ENTRIES);
  const hit = nearestPlace(grid, ENTRIES, 2.4, 48.9, 150);
  assert.equal(hit?.id, "a");
});

test("nearestPlace returns null past the range (ocean tap)", () => {
  const grid = buildPlaceGrid(ENTRIES);
  // Mid-Atlantic: nothing within 150 km.
  assert.equal(nearestPlace(grid, ENTRIES, -30, 30, 150), null);
});

test("nearestPlace picks the nearer of two candidates", () => {
  const grid = buildPlaceGrid(ENTRIES);
  // Closer to London than Paris.
  const hit = nearestPlace(grid, ENTRIES, 0.5, 51.0, 500);
  assert.equal(hit?.id, "b");
});

test("nearestPlace wraps the antimeridian", () => {
  const entries = [entry("w", 179.9, 10), entry("e", -179.9, 10)];
  const grid = buildPlaceGrid(entries);
  // Tap just east of the line: the -179.9 entry is ~22 km away.
  const hit = nearestPlace(grid, entries, 179.95, 10, 150);
  assert.ok(hit);
  assert.equal(hit.id, "w");
});

test("nearestPlace works at high latitude (76°N)", () => {
  // Longitude degrees shrink with cos(lat): at 76°N a place 113 km east
  // sits 3 cells away — the old equatorial ring bound (2) never searched
  // there, resolving to null (false "ocean" hint) instead of the place.
  const entries = [entry("north-cape", 6.1, 76.0)];
  const grid = buildPlaceGrid(entries);
  const hit = nearestPlace(grid, entries, 1.9, 76.0, 150);
  assert.ok(hit, "expected a hit at 76°N despite the longitude squeeze");
  assert.equal(hit.id, "north-cape");
});

test("nearestPlace breaks ties by population", () => {
  const big: LoopNameEntry = { n: "big", id: "big", lon: 10, lat: 10, r: "", p: 1000000 };
  const small: LoopNameEntry = { n: "small", id: "small", lon: 10, lat: 10, r: "", p: 100 };
  const grid = buildPlaceGrid([small, big]);
  // Exactly equidistant: the populous entry wins, not grid order.
  const hit = nearestPlace(grid, [small, big], 10.001, 10, 150);
  assert.equal(hit?.id, "big");
});

test("nearestPlace rejects non-finite input", () => {
  const grid = buildPlaceGrid(ENTRIES);
  assert.equal(nearestPlace(grid, ENTRIES, NaN, 48.9, 150), null);
  assert.equal(nearestPlace(grid, ENTRIES, 2.4, 48.9, 0), null);
});

test("nearestPlace never misses a closer place in a farther ring", () => {
  // Dense cluster: the answer must be the true nearest, not just the
  // first cell hit. Brute-force oracle over random taps.
  const dense: LoopNameEntry[] = [];
  for (let i = 0; i < 200; i++) {
    dense.push(entry(`p${i}`, -10 + (i % 20) * 0.5, 40 + Math.floor(i / 20) * 0.5));
  }
  const grid = buildPlaceGrid(dense);
  const dist = (a: number, b: number, c: number, d: number) =>
    Math.hypot((a - c) * 111.32, (b - d) * 111.32);
  for (const [lon, lat] of [[-5.1, 42.3], [-1.7, 44.9], [-9.2, 41.1]] as const) {
    const got = nearestPlace(grid, dense, lon, lat, 500);
    let best: LoopNameEntry | null = null;
    let bestD = Infinity;
    for (const e of dense) {
      const d = dist(lon, lat, e.lon, e.lat);
      if (d < bestD && d <= 500) {
        bestD = d;
        best = e;
      }
    }
    assert.equal(got?.id, best?.id, `tap ${lon},${lat}`);
  }
});
