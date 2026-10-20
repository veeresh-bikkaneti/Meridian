import { strict as assert } from "node:assert";
import { test } from "node:test";
import { coldtrailCaseCount, getColdtrailCase } from "./cases.ts";
import { QUARTER_CIRCUMFERENCE_KM } from "../loop/rings.ts";

test("the bundled deck has cases and wraps around", () => {
  const n = coldtrailCaseCount();
  assert.ok(n > 0, "deck is non-empty");
  const first = getColdtrailCase(0);
  const wrapped = getColdtrailCase(n);
  assert.ok(first && wrapped, "cases resolve");
  assert.equal(first.caseNo, wrapped.caseNo);
  assert.equal(getColdtrailCase(-1)?.caseNo, getColdtrailCase(n - 1)?.caseNo);
});

test("every case is a valid triangulation puzzle", () => {
  const n = coldtrailCaseCount();
  const hideouts = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    assert.ok(c.hideout.name.length > 0, `case ${c.caseNo}: hideout named`);
    assert.equal(c.sightings.length, 3, `case ${c.caseNo}: 3 sightings`);
    hideouts.add(c.hideout.placeId);
    const octants = new Set(c.sightings.map((s) => s.octant));
    assert.equal(octants.size, 3, `case ${c.caseNo}: distinct octants`);
    for (const s of c.sightings) {
      assert.ok(s.radiusKm > 0, `case ${c.caseNo}: positive radius`);
      assert.notEqual(s.cityId, c.hideout.placeId, `case ${c.caseNo}: witness != hideout`);
      assert.ok(s.text.includes(s.cityName), `case ${c.caseNo}: text names the city`);
      assert.ok(s.text.includes("km"), `case ${c.caseNo}: text states the radius`);
    }
  }
  assert.equal(hideouts.size, n, "no hideout repeats in the deck");
});

test("getColdtrailCase fails closed on a non-integer index", () => {
  assert.equal(getColdtrailCase(Number.NaN), null);
});

test("every witness radius stays under the far-ring reframe threshold (issue #166)", () => {
  // Witness rings share ringPolygon with GeoDetective guess rings. Past
  // QUARTER_CIRCUMFERENCE_KM, ringPolygon reframes around the antipode —
  // right for a guess ring, wrong for a witness ring (it would silently
  // move the evidence). Nothing in code clamps witness radii; the only
  // scaling on the way in (effectiveRadius) shrinks them. So this pins
  // the SHIPPED DATA: if a future deck ever ships a radius at or over
  // the threshold, this test fails and the witness path needs a code
  // guard before that deck can go out.
  const n = coldtrailCaseCount();
  assert.ok(n > 0, "deck is non-empty");
  let max = 0;
  for (let i = 0; i < n; i++) {
    const c = getColdtrailCase(i)!;
    for (const s of c.sightings) max = Math.max(max, s.radiusKm);
  }
  assert.ok(
    max < QUARTER_CIRCUMFERENCE_KM,
    `max witness radius ${max} km must stay under ${QUARTER_CIRCUMFERENCE_KM} km`,
  );
});
