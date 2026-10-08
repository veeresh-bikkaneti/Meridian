import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  effectiveRadius,
  INFORMANT_COST,
  scoreIntercept,
  SOLVE_REWARD,
  STARTING_STARS,
  verdictFor,
} from "./engine.ts";
import type { ColdTrailSighting } from "./types.ts";

const sighting = (radiusKm: number): ColdTrailSighting => ({
  id: "s1",
  timestamp: "Tue 08:14",
  cityId: "gn-1",
  cityName: "Denver",
  cityLon: -104.99,
  cityLat: 39.74,
  radiusKm,
  octant: "east",
  text: "Last seen refueling 400 km east of Denver.",
});

test("effectiveRadius halves the ring while the informant is on it", () => {
  assert.equal(effectiveRadius(sighting(400), false), 400);
  assert.equal(effectiveRadius(sighting(400), true), 200);
});

test("scoreIntercept is 0 on the hideout and ~306 km Denver-area to Boston", () => {
  assert.equal(scoreIntercept(-104.99, 39.74, -104.99, 39.74), 0);
  // New York -> Boston is ~306 km; the score rounds the true haversine.
  const nycBoston = scoreIntercept(-74.006, 40.7128, -71.0589, 42.3601);
  assert.ok(nycBoston >= 300 && nycBoston <= 315, `nyc->bos ${nycBoston}`);
});

test("verdictFor bands: caught under 300 km", () => {
  assert.equal(verdictFor(0).caught, true);
  assert.equal(verdictFor(100).caught, true);
  assert.equal(verdictFor(101).caught, true);
  assert.equal(verdictFor(300).caught, true);
  assert.equal(verdictFor(301).caught, false);
  assert.equal(verdictFor(800).caught, false);
  assert.equal(verdictFor(801).caught, false);
  assert.match(verdictFor(50).title, /Caught red-handed/);
  assert.match(verdictFor(5000).title, /vanished/);
});

test("economy constants are sane", () => {
  assert.equal(INFORMANT_COST, 1);
  assert.equal(SOLVE_REWARD, 1);
  assert.ok(STARTING_STARS >= INFORMANT_COST, "fresh wallet affords one informant");
});
