/**
 * Math records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as math.test.ts.
 *
 * The validator contract: validateMathRecords(records) throws an Error
 * naming the record id and the rule when any record fails. The
 * projection test proves the move changed nothing: the fixture was
 * captured by running the old code, so it deep-equals the old exports
 * by construction, and the new projection deep-equals it.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateMathRecords } from "./validate.ts";
import { mathUnits } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { MATH_ANSWERS } from "./answers.ts";
import fixture from "./__fixtures__/main-7bc4d8f2.json" with { type: "json" };

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

const EQUIV_ID = "math-number:fractions:equivalent";

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = mathUnits().find((u) => u.id === EQUIV_ID);
  assert.ok(unit, `no unit for ${EQUIV_ID}`);
  const answer = MATH_ANSWERS[EQUIV_ID];
  assert.ok(answer, `no answer for ${EQUIV_ID}`);
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
  // "They have the same amount" is the correct choice and appears
  // nowhere in the original why; appending it leaks the answer.
  const leaked = { ...good, why: `${good.why} They have the same amount.` };
  assert.throws(
    () => validateMathRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EQUIV_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validateMathRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error && error.message.includes(EQUIV_ID),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validateMathRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EQUIV_ID) &&
      error.message.includes("duplicate id"),
  );
});

it("validator rejects a follow-up answer leaked in the lead", () => {
  const good = goodRecord();
  // The follow-up's correct choice ("The left pile") is unique to it:
  // its token "left" sits in the lead, while the main answer stays
  // clean, so only the follow-up check can fire.
  const followUp = {
    prompt: "After that, which pile holds more?",
    choices: ["The left pile", "The right pile"],
    correct: "The left pile",
    derivation: "Both piles match, so the left pile is the bigger share.",
  };
  const leaked = {
    ...good,
    why: `${good.why} The left pile.`,
    answer: { ...good.answer, followUp },
  };
  assert.throws(
    () => validateMathRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EQUIV_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("projection equals the frozen main fixture for all 53 math items", () => {
  assert.equal(mathUnits().length, 53);
  assert.equal(Object.keys(MATH_ANSWERS).length, 53);
  assert.deepEqual(mathUnits(), fixture.units);
  assert.deepEqual(MATH_ANSWERS, fixture.answers);
  // Deal order is part of the projection, not just the set of ids.
  assert.deepEqual(
    mathUnits().map((u) => u.id),
    (fixture.units as { id: string }[]).map((u) => u.id),
  );
});
