import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  effectiveRadius,
  INFORMANT_COST,
  scoreBand,
  scoreIntercept,
  SOLVE_REWARD,
  STARTING_STARS,
} from "./engine.ts";
import { THEMES, verdictForTheme } from "./themes.ts";
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
  region: { continent: "North America", country: "United States", subdivision: "Colorado" },
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

test("scoreBand boundaries: caught under 300 km (bands 0-1)", () => {
  assert.equal(scoreBand(0), 0);
  assert.equal(scoreBand(100), 0);
  assert.equal(scoreBand(101), 1);
  assert.equal(scoreBand(300), 1);
  assert.equal(scoreBand(301), 2);
  assert.equal(scoreBand(800), 2);
  assert.equal(scoreBand(801), 3);
  // Caught equivalence via verdictForTheme, for each shipped theme
  // (per-theme title assertions live in themes.test.ts).
  for (const theme of Object.values(THEMES)) {
    assert.equal(verdictForTheme(theme, 0).caught, true);
    assert.equal(verdictForTheme(theme, 100).caught, true);
    assert.equal(verdictForTheme(theme, 101).caught, true);
    assert.equal(verdictForTheme(theme, 300).caught, true);
    assert.equal(verdictForTheme(theme, 301).caught, false);
    assert.equal(verdictForTheme(theme, 800).caught, false);
    assert.equal(verdictForTheme(theme, 801).caught, false);
  }
});

test("economy constants are sane", () => {
  assert.equal(INFORMANT_COST, 1);
  assert.equal(SOLVE_REWARD, 1);
  assert.ok(STARTING_STARS >= INFORMANT_COST, "fresh wallet affords one informant");
});
