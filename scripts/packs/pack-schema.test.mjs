import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loopMetaEntry, toLoopRecord, validatePackRecord } from "./schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const parisRecord = () => readJson(join(HERE, "capitals", "cases", "paris-france.json"));
const parisInput = () => readJson(join(HERE, "capitals", "inputs", "paris-france.json"));
const clone = (value) => JSON.parse(JSON.stringify(value));

test("the Paris pilot record validates clean against its authoring input", () => {
  const result = validatePackRecord(parisRecord(), { input: parisInput() });
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test("the feature-code gate rejects a country capital on a PPLA row", () => {
  const record = parisRecord();
  record.target.featureCode = "PPLA";
  const result = validatePackRecord(record, { input: parisInput() });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.code === "PACK_GATE"));
});

test("pack tier outside 1-3 is rejected", () => {
  const record = parisRecord();
  record.packTier = 4;
  const result = validatePackRecord(record, { input: parisInput() });
  assert.ok(result.reasons.some((r) => r.code === "PACK_TIER"));
});

test("a record whose input describes another place fails closed", () => {
  const input = parisInput();
  input.place.lat = 40.0;
  const result = validatePackRecord(parisRecord(), { input });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.code === "PACK_INPUT"));
});

test("no input at all fails closed: quotes cannot be traced", () => {
  const result = validatePackRecord(parisRecord(), {});
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.code === "PACK_INPUT"));
});

test("Direction A prompt must name the subject", () => {
  const record = parisRecord();
  record.prompt = { givenName: "Europe", givenKind: "country" };
  const result = validatePackRecord(record, { input: parisInput() });
  assert.ok(result.reasons.some((r) => r.code === "PACK_DIRECTION"));
});

test("Direction B1 bans the subject from every clue (it is the taught pairing)", () => {
  const record = parisRecord();
  record.direction = "B1";
  record.prompt = { givenName: "Paris", givenKind: "capital" };
  const result = validatePackRecord(record, { input: parisInput() });
  const leaks = result.reasons.filter((r) => r.code === "SUBJECT_LEAK");
  assert.ok(leaks.length > 0, "the Paris giveaway names France, which B1 must ban");
  assert.ok(leaks.every((r) => r.tier === 5));
});

test("Direction B2 bans the subject everywhere except the rung-4 confirmation clue", () => {
  const record = parisRecord();
  record.direction = "B2";
  record.prompt = { givenName: "", givenKind: "country" };
  // The shipped giveaway names France; a B2 giveaway may not. Rewrite it
  // subject-free so the baseline B2 record is clean.
  record.clues[4].text =
    "The president of this land lives and works in a palace in this city, and the laws of the land are made here too. This city is the capital of the land.";
  const baseline = validatePackRecord(record, { input: parisInput() });
  assert.deepEqual(baseline, { ok: true, reasons: [] });

  const early = clone(record);
  early.clues[0].text = `${early.clues[0].text} It sits in France.`;
  const earlyResult = validatePackRecord(early, { input: parisInput() });
  assert.ok(
    earlyResult.reasons.some((r) => r.code === "SUBJECT_LEAK" && r.tier === 1),
    "subject in clue 1 leaks",
  );

  const confirm = clone(record);
  confirm.clues[3].text = `${confirm.clues[3].text} The land is France.`;
  const confirmResult = validatePackRecord(confirm, { input: parisInput() });
  assert.ok(
    !confirmResult.reasons.some((r) => r.code === "SUBJECT_LEAK"),
    "subject at rung 4 is the designed confirmation, not a leak",
  );
});

test("toLoopRecord projects the pack record onto the shipped clue shape", () => {
  const record = parisRecord();
  const loop = toLoopRecord(record, parisInput());
  assert.equal(loop.schema, "meridian.loop.clues.v1");
  assert.equal(loop.place_id, "gn-2988507");
  assert.deepEqual(loop.answer, {
    name: "Paris",
    aliases: ["Lutetia"],
    country: "France",
    subdivision: "Île-de-France",
    lat: 48.85341,
    lon: 2.3488,
    difficulty: 1,
  });
  assert.equal(loop.clues, record.clues);
});

test("loopMetaEntry carries exactly the sidecar fields", () => {
  const entry = loopMetaEntry(parisRecord());
  assert.deepEqual(Object.keys(entry).sort(), ["blurb", "direction", "prompt", "subject"]);
  assert.deepEqual(entry.subject, { kind: "country", name: "France" });
  assert.equal(entry.direction, "A");
  assert.ok(entry.blurb.endsWith("Paris is the capital of France."));
});
