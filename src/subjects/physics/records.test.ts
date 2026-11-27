/**
 * Physics records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as physics.test.ts.
 *
 * The validator contract: validatePhysicsRecords(records) throws an
 * Error naming the record id and the rule when any record fails. The
 * projection test proves the move changed nothing: the fixture was
 * captured by running the old code, so it deep-equals the old exports
 * by construction, and the new projection deep-equals it.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validatePhysicsRecords } from "./validate.ts";
import { physicsUnits, PHYSICS_RECORDS } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { PHYSICS_ANSWERS } from "./answers.ts";
import fixture from "./__fixtures__/main-64071587.json" with { type: "json" };

// Pin: the zod mirror (SubjectAnswer) must stay the same shape as the
// shared AnswerEntry. Strict type equality is impossible by design —
// the mirror is one level only (a follow-up has no follow-up), while
// AnswerEntry recurses — so the pin checks key equality plus
// assignability in both directions. If any of these fail to compile,
// the mirror has drifted. (Test files are exempt from the layer rule:
// eslint/layer-rule.mjs classify() returns null for *.test.ts, so this
// import adds no baseline entry.)
type _EqualKeys<A, B> =
  keyof A extends keyof B ? (keyof B extends keyof A ? true : false) : false;
type _AnswerKeysPin = _EqualKeys<SubjectAnswer, AnswerEntry>;
const _answerKeysPin: _AnswerKeysPin = true;
type _MirrorFitsShared = SubjectAnswer extends AnswerEntry ? true : false;
const _mirrorFitsShared: _MirrorFitsShared = true;
type _SharedFitsMirrorOneLevel =
  Omit<AnswerEntry, "followUp"> extends Omit<SubjectAnswer, "followUp"> ? true : false;
const _sharedFitsMirrorOneLevel: _SharedFitsMirrorOneLevel = true;

const DROP_ID = "physics:drop:down";

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = physicsUnits().find((u) => u.id === DROP_ID);
  assert.ok(unit, `no unit for ${DROP_ID}`);
  const answer = PHYSICS_ANSWERS[DROP_ID];
  assert.ok(answer, `no answer for ${DROP_ID}`);
  return {
    ...unit,
    answer,
    provenance: "UNVERIFIED" as const,
    media: [] as string[],
    leadPolicy: "answer-not-in-lead" as const,
  };
}

it("validator rejects a record whose lead contains its correct answer", () => {
  const good = goodRecord();
  // The appended sentence is the record's own correct choice, built
  // programmatically: it appears nowhere in the original why, and
  // appending it leaks the answer (the token "down").
  const leaked = { ...good, why: `${good.why} ${good.answer.correct}.` };
  assert.throws(
    () => validatePhysicsRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(DROP_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validatePhysicsRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error && error.message.includes(DROP_ID),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validatePhysicsRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(DROP_ID) &&
      error.message.includes("duplicate id"),
  );
});

it("validator rejects a follow-up answer leaked in the lead", () => {
  const good = goodRecord();
  // The follow-up's correct choice ("The left side") is unique to it:
  // its token "left" sits in the lead, while the main answer stays
  // clean, so only the follow-up check can fire.
  const followUp = {
    prompt: "After that, which side holds more?",
    choices: ["The left side", "The right side"],
    correct: "The left side",
    derivation: "Both sides match, so the left side is the bigger share.",
  };
  const leaked = {
    ...good,
    why: `${good.why} The left side.`,
    answer: { ...good.answer, followUp },
  };
  assert.throws(
    () => validatePhysicsRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(DROP_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator accepts the live records, known giveaway case included", () => {
  // physics:push:equal-pushes leaks its answer in the lead; that case
  // is baselined in scripts/lint-subject-leads-baseline.json, so the
  // validator names it as a known case and does not throw.
  validatePhysicsRecords(PHYSICS_RECORDS);
});

it("projection preserves the frozen main fixture for all 24 original physics items", () => {
  const units = physicsUnits();
  const fixtureIds = new Set((fixture.units as { id: string }[]).map((u) => u.id));
  assert.equal(units.length, 26);
  assert.equal(Object.keys(PHYSICS_ANSWERS).length, 26);
  assert.deepEqual(units.slice(0, fixture.units.length), fixture.units);
  for (const [id, expected] of Object.entries(fixture.answers)) {
    assert.deepEqual(PHYSICS_ANSWERS[id], expected, id);
  }
  // Original deal order is preserved as a prefix/subset.
  assert.deepEqual(
    units.filter((u) => fixtureIds.has(u.id)).map((u) => u.id),
    (fixture.units as { id: string }[]).map((u) => u.id),
  );
});
