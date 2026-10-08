/**
 * build-coldtrail.mjs tests: radius vagueness and deck determinism.
 * Run: node --test scripts/build-coldtrail.test.mjs
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildDeck, vagueRadius } from "./build-coldtrail.mjs";

test("vagueRadius rounds by hideout difficulty", () => {
  assert.equal(vagueRadius(412, 2), 400); // tier 2 -> nearest 25
  assert.equal(vagueRadius(418, 2), 425);
  assert.equal(vagueRadius(412, 3), 400); // tier 3 -> nearest 50
  assert.equal(vagueRadius(438, 3), 450);
  assert.ok(vagueRadius(3, 2) >= 25, "never collapses to zero");
});

test("buildDeck is deterministic and well-formed", () => {
  const a = buildDeck();
  const b = buildDeck();
  assert.deepEqual(a, b);
  assert.ok(a.length >= 60, `deck has ${a.length} cases`);
  for (const c of a) {
    assert.equal(c.sightings.length, 3);
    const octants = new Set(c.sightings.map((s) => s.octant));
    assert.equal(octants.size, 3, `case ${c.caseNo}: spread octants`);
  }
  const hideouts = new Set(a.map((c) => c.hideout.placeId));
  assert.equal(hideouts.size, a.length, "unique hideouts");
});
