/**
 * Capitals pack records — the authoring gates as a test.
 *
 * Every curated input in scripts/packs/capitals/inputs/ must have a case
 * record in scripts/packs/capitals/cases/ that passes validatePackCase
 * (the repo clue validator on a clues.v1 view, the Hyderabad gate through
 * the real check wiring, the chunk identity match, and the pack reveal
 * rules). See validate-pack.mjs for what each check is and where it
 * comes from.
 *
 * Run: node --experimental-strip-types --test scripts/packs/pack-records.test.mjs
 * (the strip-types flag matches how prebuild invokes
 * check-generated-places.mjs, which imports the same TypeScript modules).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { listInputIds, loadCase, validatePackCase } from "./validate-pack.mjs";

const ids = listInputIds();

test("the curated set is complete: 110 inputs (60 countries, 50 US states)", () => {
  // Wave 1 shipped 72 (44 + 28); Capitals & Flags wave 2 (issue #344)
  // grew the pack to the ratified 60:50 mix — all 50 state capitals
  // and 60 famous country capitals.
  assert.equal(ids.length, 110, `expected 110 inputs, found ${ids.length}`);
  const kinds = ids.map((id) => loadCase(id).input.subject.kind);
  assert.equal(kinds.filter((k) => k === "country").length, 60);
  assert.equal(kinds.filter((k) => k === "state").length, 50);
});

for (const id of ids) {
  test(`capitals case ${id} passes every authoring gate`, () => {
    const { input, record } = loadCase(id);
    assert.ok(record, `missing case file scripts/packs/capitals/cases/${id}.json`);
    const result = validatePackCase(record, input);
    assert.deepEqual(result.reasons, [], `${id} failed:\n${result.reasons.join("\n")}`);
  });
}
