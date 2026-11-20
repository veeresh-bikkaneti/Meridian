/**
 * Math records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as math.test.ts.
 *
 * (a)/(b) are failing-first: ./validate.ts does not exist yet, so this
 * file fails to load until the builder adds it. The validator contract
 * the builder must satisfy: validateMathRecords(records) throws an
 * Error naming the record id and the rule when any record fails.
 * (c) passes trivially pre-change: the fixture was captured by running
 * the old code, so it deep-equals the old exports by construction.
 * After the move it proves the new projection changed nothing.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateMathRecords } from "./validate.ts";
import { mathUnits } from "./items.ts";
import { MATH_ANSWERS } from "./answers.ts";
import fixture from "./__fixtures__/main-7bc4d8f2.json" with { type: "json" };

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
