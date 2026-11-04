/**
 * B2 rule equivalence: schema.mjs (validatePackRecord, the composer
 * gate) and validate-pack.mjs (validatePackCase, the authoring gate)
 * must reach the same verdict on the B2 subject rule — the rule both
 * headers state with the same words: the subject is banned from every
 * clue except rung 4 (index 3), where it is confirmed by design, and
 * the giveaway (index 4) bans it again.
 *
 * validatePackCase also carries the capitals v1 layer (direction must
 * be "A"), so a synthetic B2 record fails that gate overall either
 * way; the equivalence asserted here is on the B2 verdict itself —
 * whether a SUBJECT_LEAK reason is reported, and at which rung.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validatePackRecord } from "./schema.mjs";
import { validatePackCase } from "./validate-pack.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const clone = (v) => JSON.parse(JSON.stringify(v));

function syntheticB2() {
  const record = readJson(join(HERE, "capitals", "cases", "paris-france.json"));
  const input = readJson(join(HERE, "capitals", "inputs", "paris-france.json"));
  record.direction = "B2";
  record.directions = ["B2"];
  record.prompt = { givenName: "", givenKind: "country" };
  // A B2 giveaway may not name the subject; make it subject-free so
  // the baseline carries the subject only where a test puts it.
  record.clues[4].text =
    "The president of this land lives and works in a palace in this city, and the laws of the land are made here too. This city is the capital of the land.";
  return { record, input };
}

const schemaLeaks = (result) => result.reasons.filter((r) => r.code === "SUBJECT_LEAK");
const caseLeaks = (result) => result.reasons.filter((r) => r.includes("SUBJECT_LEAK"));

test("both gates reject a B2 subject leak at rung 1", () => {
  const { record, input } = syntheticB2();
  record.clues[0].text = `${record.clues[0].text} It sits in France.`;
  const schemaResult = validatePackRecord(record, { input });
  const caseResult = validatePackCase(clone(record), clone(input));
  assert.ok(schemaLeaks(schemaResult).some((r) => r.tier === 1), "schema gate leaks at tier 1");
  assert.ok(caseLeaks(caseResult).length > 0, "authoring gate leaks too");
  assert.ok(
    caseLeaks(caseResult).some((r) => r.includes("tier 1")),
    "authoring gate names tier 1",
  );
});

test("both gates accept the subject at rung 4 (the designed confirmation)", () => {
  const { record, input } = syntheticB2();
  record.clues[3].text = `${record.clues[3].text} The land is France.`;
  const schemaResult = validatePackRecord(record, { input });
  const caseResult = validatePackCase(clone(record), clone(input));
  assert.equal(schemaLeaks(schemaResult).length, 0, "schema gate: no leak at rung 4");
  assert.equal(caseLeaks(caseResult).length, 0, "authoring gate: no leak at rung 4");
});

test("both gates reject a B2 subject leak in the giveaway (rung 5)", () => {
  const { record, input } = syntheticB2();
  record.clues[4].text =
    "France's president lives and works in a palace in this city — it is the capital of France.";
  const schemaResult = validatePackRecord(record, { input });
  const caseResult = validatePackCase(clone(record), clone(input));
  assert.ok(schemaLeaks(schemaResult).some((r) => r.tier === 5), "schema gate leaks at tier 5");
  assert.ok(caseLeaks(caseResult).length > 0, "authoring gate leaks too");
});
