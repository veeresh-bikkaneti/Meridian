import { strict as assert } from "node:assert";
import { test } from "node:test";
import { destination, guessArrow, ringPolygon } from "./rings.ts";
import { distanceKm } from "../geo.ts";

test("destination travels the right distance on the bearing", () => {
  // Due north 1000 km from the equator.
  const [lon, lat] = destination(0, 0, 0, 1000);
  assert.ok(Math.abs(lon) < 1e-9, `lon ${lon}`);
  assert.ok(Math.abs(lat - 8.99) < 0.05, `lat ${lat}`);
  // Round trip: distance back is ~1000 km.
  const back = distanceKm([lon, lat], [0, 0]);
  assert.ok(Math.abs(back - 1000) < 1, `back ${back}`);
});

test("ringPolygon closes and has the right radius", () => {
  const poly = ringPolygon(2.35, 48.85, 500, 36);
  assert.equal(poly.type, "Polygon");
  const ring = poly.coordinates[0]!;
  assert.equal(ring.length, 37); // steps + closing point
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  assert.deepEqual(first, last);
  for (const pt of ring) {
    const ll = pt as [number, number];
    const d = distanceKm([2.35, 48.85], ll);
    assert.ok(Math.abs(d - 500) < 2, `ring point ${d} km`);
  }
});

test("ringPolygon unwraps longitudes across the antimeridian", () => {
  // Tokyo-scale miss: the 8,764 km ring wraps the planet. Without
  // unwrapping, destination()'s [-180, 180] normalization tears the
  // polygon (350°+ jump) and the tile worker drops it (zero features).
  const poly = ringPolygon(139.6917, 35.6895, 8764.06);
  const ring = poly.coordinates[0]!;
  let maxJump = 0;
  for (let i = 1; i < ring.length; i++) {
    maxJump = Math.max(maxJump, Math.abs(ring[i]![0] - ring[i - 1]![0]));
  }
  assert.ok(maxJump < 30, `max longitude jump ${maxJump}° (torn ring)`);
  // Still an exact-km circle: every point is 8,764 km from Tokyo
  // (distanceKm handles out-of-range longitudes).
  for (const pt of ring) {
    const d = distanceKm([139.6917, 35.6895], pt as [number, number]);
    assert.ok(Math.abs(d - 8764.06) < 5, `ring point ${d} km`);
  }
});

test("guessArrow points along the bearing and scales with distance", () => {
  const { shaft, head } = guessArrow(0, 0, 90, 1000);
  // Shaft runs due east, 30% of the miss distance.
  const tip = shaft.coordinates[1]! as [number, number];
  assert.ok(Math.abs(tip[1]) < 1e-6, `tip lat ${tip[1]}`);
  assert.ok(tip[0] > 2.5 && tip[0] < 2.9, `tip lon ${tip[0]}`);
  // Head barbs straddle the tip.
  const [left, tip2, right] = head.coordinates;
  assert.deepEqual(tip2, tip);
  assert.ok(left![0] < tip[0] && right![0] < tip[0], "barbs trail the tip");
  assert.ok(left![1] * right![1] < 0, "barbs split north/south");
});

test("guessArrow never collapses on tiny distances", () => {
  const { shaft } = guessArrow(0, 0, 45, 0.2);
  const tip = shaft.coordinates[1]! as [number, number];
  const len = distanceKm([0, 0], tip);
  assert.ok(len >= 1, `arrow length ${len}`);
});
