import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CAPITALS_PACK_ID,
  COLDTRAIL_PACK_CAPITALS_STORAGE_KEY,
  capitalsPackCaseCount,
  getCapitalsPackCase,
} from "./cases-pack.ts";
import { coldtrailCaseCount, getColdtrailCase } from "./cases.ts";
import { QUARTER_CIRCUMFERENCE_KM } from "../loop/rings.ts";

/**
 * The 17 curated capitals that can never anchor a pack case, measured
 * 2026-11-03 from the names index populations (16 state capitals under
 * 300,000 plus Reykjavik). The generator test in
 * scripts/build-coldtrail-capitals.test.mjs re-derives this set from
 * the dataset; this pin guards the shipped pack file itself.
 */
const NON_ANCHOR_IDS = new Set([
  "gn-3413829", "gn-5106834", "gn-5490263", "gn-5554072", "gn-4250542",
  "gn-4781708", "gn-4347242", "gn-5261457", "gn-5780993", "gn-5750162",
  "gn-5805687", "gn-5586437", "gn-5656882", "gn-5821086", "gn-5072006",
  "gn-4853828", "gn-4119403",
]);

test("the pack deck has cases and wraps around itself", () => {
  const n = capitalsPackCaseCount();
  assert.ok(n > 0, "pack deck is non-empty");
  const first = getCapitalsPackCase(0);
  const wrapped = getCapitalsPackCase(n);
  assert.ok(first && wrapped, "pack cases resolve");
  assert.equal(first.caseNo, wrapped.caseNo);
  assert.equal(getCapitalsPackCase(-1)?.caseNo, getCapitalsPackCase(n - 1)?.caseNo);
});

test("every pack case is a valid triangulation with capital anchors only", () => {
  const n = capitalsPackCaseCount();
  const hideouts = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = getCapitalsPackCase(i)!;
    assert.equal(c.packId, CAPITALS_PACK_ID, `case ${c.caseNo}: stamped with the pack id`);
    assert.ok(c.hideout.name.length > 0, `case ${c.caseNo}: hideout named`);
    assert.equal(c.sightings.length, 3, `case ${c.caseNo}: 3 sightings`);
    hideouts.add(c.hideout.placeId);
    const octants = new Set(c.sightings.map((s) => s.octant));
    assert.equal(octants.size, 3, `case ${c.caseNo}: distinct octants`);
    for (const s of c.sightings) {
      assert.ok(s.radiusKm > 0, `case ${c.caseNo}: positive radius`);
      assert.ok(
        s.radiusKm < QUARTER_CIRCUMFERENCE_KM,
        `case ${c.caseNo}: radius under the far-ring reframe threshold`,
      );
      assert.notEqual(s.cityId, c.hideout.placeId, `case ${c.caseNo}: witness != hideout`);
      assert.ok(
        !NON_ANCHOR_IDS.has(s.cityId),
        `case ${c.caseNo}: ${s.cityName} is under the anchor population rule and must never anchor`,
      );
      assert.ok(s.text.includes(s.cityName), `case ${c.caseNo}: text names the city`);
      assert.ok(s.text.includes("km"), `case ${c.caseNo}: text states the radius`);
    }
  }
  assert.equal(hideouts.size, n, "no hideout repeats in the pack deck");
});

test("the pack deck and the core deck stay separate", () => {
  // The core deck is untouched by the pack: same count, and no core
  // case carries a pack stamp. The pack loader wraps over the pack
  // deck's own length, proven by the wrap test above.
  assert.equal(coldtrailCaseCount(), 60, "core deck still has its 60 cases");
  for (let i = 0; i < coldtrailCaseCount(); i++) {
    assert.equal(
      getColdtrailCase(i)?.packId,
      undefined,
      `core case ${i}: no pack stamp`,
    );
  }
  assert.equal(
    COLDTRAIL_PACK_CAPITALS_STORAGE_KEY,
    "meridian.coldtrail.pack.capitals.v1",
    "the pack store key is the design's key",
  );
  assert.notEqual(
    COLDTRAIL_PACK_CAPITALS_STORAGE_KEY,
    "meridian.coldtrail.v2",
    "the pack store key is not the core store key",
  );
});

test("getCapitalsPackCase fails closed on a non-integer index", () => {
  assert.equal(getCapitalsPackCase(Number.NaN), null);
});
