/**
 * Social studies records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as social-studies.test.ts.
 *
 * The validator contract: validateSocialStudiesRecords(records) throws an
 * Error naming the record id and the rule when any record fails. The
 * projection test proves the move changed nothing: the fixture was
 * captured by running the old code, so it deep-equals the old exports
 * by construction, and the new projection deep-equals it.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateSocialStudiesRecords } from "./validate.ts";
import { socialStudiesUnits, SOCIAL_STUDIES_RECORDS } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { SOCIAL_STUDIES_ANSWERS } from "./answers.ts";
import fixture from "./__fixtures__/main-38468953.json" with { type: "json" };

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

const AREA_ID = "social-studies:region:area-by-squares";

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = socialStudiesUnits().find((u) => u.id === AREA_ID);
  assert.ok(unit, `no unit for ${AREA_ID}`);
  const answer = SOCIAL_STUDIES_ANSWERS[AREA_ID];
  assert.ok(answer, `no answer for ${AREA_ID}`);
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
  // appending it leaks the answer (the token "first").
  const leaked = { ...good, why: `${good.why} ${good.answer.correct}.` };
  assert.throws(
    () => validateSocialStudiesRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(AREA_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validateSocialStudiesRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error && error.message.includes(AREA_ID),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validateSocialStudiesRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(AREA_ID) &&
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
    () => validateSocialStudiesRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(AREA_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator accepts the live records", () => {
  validateSocialStudiesRecords(SOCIAL_STUDIES_RECORDS);
});

it("projection preserves the frozen main fixture for all 12 original social-studies items", () => {
  const units = socialStudiesUnits();
  const fixtureIds = new Set((fixture.units as { id: string }[]).map((u) => u.id));
  assert.equal(units.length, 14);
  assert.equal(Object.keys(SOCIAL_STUDIES_ANSWERS).length, 14);
  assert.deepEqual(units.slice(0, fixture.units.length), fixture.units);
  for (const [id, expected] of Object.entries(fixture.answers)) {
    assert.deepEqual(SOCIAL_STUDIES_ANSWERS[id], expected, id);
  }
  // Original deal order is preserved as a prefix/subset.
  assert.deepEqual(
    units.filter((u) => fixtureIds.has(u.id)).map((u) => u.id),
    (fixture.units as { id: string }[]).map((u) => u.id),
  );
});
