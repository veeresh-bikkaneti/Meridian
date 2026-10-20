import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  HALF_CIRCUMFERENCE_KM,
  QUARTER_CIRCUMFERENCE_KM,
  destination,
  guessArrow,
  ringPolygon,
} from "./rings.ts";
import { distanceKm, pointInRing } from "../geo.ts";

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

test("ringPolygon reframes a far ring around the antipode, exactly (issue #166)", () => {
  // Point Nemo → Ankara: a 17,895 km miss, far past the quarter-planet
  // threshold. The true circle is the same point set as a 2,120 km circle
  // around Nemo's antipode (48.8766, 56.6067) — the reframe must draw
  // THAT loop, in the primary world copy (every longitude inside
  // [-180, 180]), not a loop stranded at unwrapped longitudes.
  const guess: [number, number] = [-123.3933, -48.8766];
  const antipode: [number, number] = [56.6067, 48.8766];
  const poly = ringPolygon(guess[0], guess[1], 17895);
  const ring = poly.coordinates[0]!;
  assert.equal(ring.length, 73);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  const reframedKm = HALF_CIRCUMFERENCE_KM - 17895;
  for (const pt of ring) {
    const ll = pt as [number, number];
    assert.ok(Math.abs(ll[0]) <= 180, `longitude ${ll[0]} escaped the world copy`);
    assert.ok(Math.abs(distanceKm(guess, ll) - 17895) < 5, `ring point ${distanceKm(guess, ll)} km from guess`);
    assert.ok(
      Math.abs(distanceKm(antipode, ll) - reframedKm) < 5,
      `ring point ${distanceKm(antipode, ll)} km from antipode`,
    );
  }
});

test("ringPolygon threshold: below frames the guess, above frames the antipode", () => {
  // Frame containment is the observable the renderer depends on: the
  // traced loop must enclose the point it was traced around. (Signed
  // area is NOT asserted — its sign depends on the winding convention.)
  const below = ringPolygon(0, 0, 10006).coordinates[0]! as [number, number][];
  assert.ok(pointInRing([0, 0], below), "10,006 km ring frames its centre");
  for (const pt of below) {
    assert.ok(Math.abs(distanceKm([0, 0], pt) - 10006) < 5, `ring point ${distanceKm([0, 0], pt)} km`);
  }
  const above = ringPolygon(0, 0, 10009).coordinates[0]! as [number, number][];
  const antipode: [number, number] = [-180, 0];
  assert.ok(pointInRing(antipode, above), "10,009 km ring frames the antipode");
  assert.ok(!pointInRing([0, 0], above), "10,009 km ring no longer frames the guess");
  for (const pt of above) {
    assert.ok(
      Math.abs(distanceKm(antipode, pt) - (HALF_CIRCUMFERENCE_KM - 10009)) < 5,
      `ring point ${distanceKm(antipode, pt)} km from antipode`,
    );
  }
  assert.ok(QUARTER_CIRCUMFERENCE_KM > 10006 && QUARTER_CIRCUMFERENCE_KM < 10009);
});

test("ringPolygon near-antipodal miss draws a tiny loop at the antipode", () => {
  // 19,500 km from (0,0): the answer is ~515 km from the antipode
  // (180, 0). The loop must be small, finite, and closed — never a
  // degenerate polygon.
  const poly = ringPolygon(0, 0, 19500);
  const ring = poly.coordinates[0]!;
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const pt of ring) {
    const ll = pt as [number, number];
    assert.ok(Number.isFinite(ll[0]) && Number.isFinite(ll[1]), `vertex ${ll}`);
    assert.ok(
      Math.abs(distanceKm([180, 0], ll) - (HALF_CIRCUMFERENCE_KM - 19500)) < 5,
      `ring point ${distanceKm([180, 0], ll)} km from antipode`,
    );
  }
  // A distance a hair over HALF (geo.ts uses a slightly larger Earth
  // radius, so a true antipodal miss can arrive ~0.03 km over) clamps
  // to the 1 km loop instead of going negative.
  const over = ringPolygon(0, 0, HALF_CIRCUMFERENCE_KM + 0.05).coordinates[0]!;
  for (const pt of over) {
    const ll = pt as [number, number];
    assert.ok(Number.isFinite(ll[0]) && Number.isFinite(ll[1]), `vertex ${ll}`);
  }
});

test("ring label point stays on the reframed ring (issue #166)", () => {
  // LoopMap places the km label at destination(guess, 0, distKm) — the
  // ring's northmost point. That point is a vertex of the true circle,
  // so it must sit at the reframed radius from the antipode, i.e. ON
  // the drawn loop, or the label would float away from its ring.
  const guess: [number, number] = [-123.3933, -48.8766];
  const antipode: [number, number] = [56.6067, 48.8766];
  const label = destination(guess[0], guess[1], 0, 17895);
  assert.ok(
    Math.abs(distanceKm(antipode, label) - (HALF_CIRCUMFERENCE_KM - 17895)) < 5,
    `label ${distanceKm(antipode, label)} km from antipode`,
  );
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
