import { strict as assert } from "node:assert";
import { test } from "node:test";
import { distanceKm, initialBearing, octantOf } from "../geo.ts";
import { coldtrailCaseCount, getColdtrailCase } from "./cases.ts";
import { effectiveRadius, scoreIntercept, verdictFor } from "./engine.ts";
import type { ColdTrailSighting } from "./types.ts";

const mkSighting = (over: Partial<ColdTrailSighting>): ColdTrailSighting => ({
  id: "s1",
  timestamp: "Tue 08:14",
  cityId: "gn-1",
  cityName: "Denver",
  cityLon: -104.99,
  cityLat: 39.74,
  radiusKm: 400,
  octant: "east",
  text: "Last seen refueling 400 km east of Denver.",
  ...over,
});

// --- Edge 1: antimeridian scoring stays continuous (no 360°-wrap blowup) ---
test("scoreIntercept across the antimeridian is the short way around", () => {
  // 2° of longitude at the equator ≈ 222 km, not ~39,800 km.
  const km = scoreIntercept(179, 0, -179, 0);
  assert.ok(km >= 215 && km <= 230, `antimeridian 2° gap = ${km} km`);
  assert.equal(scoreIntercept(179, 0, 179, 0), 0);
});

// --- Edge 2: exact verdict band boundaries ---
test("verdictFor exact boundaries and titles", () => {
  assert.equal(verdictFor(100).title, "Caught red-handed!");
  assert.equal(verdictFor(101).caught, true);
  assert.equal(verdictFor(300).title, "Warm trail — so close!");
  assert.equal(verdictFor(301).title, "The trail went cold.");
  assert.equal(verdictFor(800).title, "The trail went cold.");
  assert.equal(verdictFor(801).title, "The smuggler vanished.");
  // Negative scores are impossible; huge scores still classify.
  assert.equal(verdictFor(0).caught, true);
  assert.equal(verdictFor(20_000).caught, false);
});

// --- Edge 3: halving is exact on odd radii (no integer truncation) ---
test("effectiveRadius halves odd radii without truncation", () => {
  assert.equal(effectiveRadius(mkSighting({ radiusKm: 401 }), true), 200.5);
  assert.equal(effectiveRadius(mkSighting({ radiusKm: 1 }), true), 0.5);
});

// --- Edge 4: score is symmetric and never negative ---
test("scoreIntercept is symmetric and non-negative", () => {
  const a = scoreIntercept(-74, 40.7, 2.35, 48.85);
  const b = scoreIntercept(2.35, 48.85, -74, 40.7);
  assert.equal(a, b);
  assert.ok(a >= 0, `score ${a}`);
});

// --- Edge 5: hideout at coordinate extremes stays in bounds ---
test("every case's hideout and witness cities are valid coordinates", () => {
  const n = coldtrailCaseCount();
  assert.ok(n > 0);
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    assert.ok(c.hideout.lon >= -180 && c.hideout.lon <= 180, `case ${c.caseNo}: hideout lon`);
    assert.ok(c.hideout.lat >= -90 && c.hideout.lat <= 90, `case ${c.caseNo}: hideout lat`);
    for (const s of c.sightings) {
      assert.ok(s.cityLon >= -180 && s.cityLon <= 180, `case ${c.caseNo}: witness lon`);
      assert.ok(s.cityLat >= -90 && s.cityLat <= 90, `case ${c.caseNo}: witness lat`);
    }
  }
});

// --- Edge 6: radius vagueness is a difficulty-2 step (multiple of 25 km) ---
test("every sighting radius is vague-rounded (multiple of 25 km)", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    for (const s of c.sightings) {
      assert.equal(s.radiusKm % 25, 0, `case ${c.caseNo} ${s.cityName}: radius ${s.radiusKm}`);
    }
  }
});

// --- Edge 7: the octant on the card matches the true bearing to the hideout ---
test("every sighting's octant agrees with the true bearing", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    for (const s of c.sightings) {
      const bearing = initialBearing([s.cityLon, s.cityLat], [c.hideout.lon, c.hideout.lat]);
      assert.ok(bearing !== null, `case ${c.caseNo}: bearing computable`);
      assert.equal(octantOf(bearing!), s.octant, `case ${c.caseNo} ${s.cityName}: octant`);
    }
  }
});

// --- Edge 8: witness distance window (not a giveaway, not absurd) ---
test("every witness city is 250–4000 km from the hideout", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    for (const s of c.sightings) {
      const trueKm = distanceKm([s.cityLon, s.cityLat], [c.hideout.lon, c.hideout.lat]);
      assert.ok(trueKm >= 200, `case ${c.caseNo} ${s.cityName}: ${trueKm} km too close`);
      assert.ok(trueKm <= 4050, `case ${c.caseNo} ${s.cityName}: ${trueKm} km too far`);
      // The vague radius still approximates the truth (step 25 rounding).
      assert.ok(Math.abs(s.radiusKm - trueKm) <= 25, `case ${c.caseNo}: radius ${s.radiusKm} vs true ${trueKm}`);
    }
  }
});

// --- Edge 9: three DISTINCT witness cities per case (no duplicate sightings) ---
test("every case names three distinct witness cities", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    const cities = new Set(c.sightings.map((s) => s.cityId));
    assert.equal(cities.size, 3, `case ${c.caseNo}: distinct witness cities`);
    const times = new Set(c.sightings.map((s) => s.timestamp));
    assert.equal(times.size, 3, `case ${c.caseNo}: distinct timestamps`);
    for (const s of c.sightings) {
      assert.ok(s.timestamp.length > 0, `case ${c.caseNo}: non-empty timestamp`);
    }
  }
});

// --- Edge 10: difficulty field present on hideouts ---
test("every hideout carries a difficulty tier", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    assert.ok(Number.isInteger(c.hideout.difficulty) && c.hideout.difficulty >= 1, `case ${c.caseNo}`);
  }
});

// --- Edge 11: the vague ring never undershoots the truth by more than step/2 ---
// Design contract (build-coldtrail.mjs): vagueRadius = Math.round(true/25)*25
// for difficulty 2, so a rounded-down ring can sit up to 12.5 km inside the
// true distance. QA note (P1, design call): Math.ceil would guarantee the
// hideout is always inside its ring; the current rounding leaves 92/180
// sightings with the hideout marginally outside its ring (worst 12.17 km).
test("every vague ring undershoots the true distance by at most 12.5 km", () => {
  const n = coldtrailCaseCount();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    for (const s of c.sightings) {
      const trueKm = distanceKm([s.cityLon, s.cityLat], [c.hideout.lon, c.hideout.lat]);
      assert.ok(
        trueKm <= s.radiusKm + 12.5,
        `case ${c.caseNo} ${s.cityName}: hideout ${trueKm} km undershoots ring ${s.radiusKm} km by > 12.5 km`,
      );
    }
  }
});
