import { strict as assert } from "node:assert";
import { test } from "node:test";
import { coldtrailCaseCount, getColdtrailCase } from "./cases.ts";

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
