/**
 * Journals records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as
 * chemistry/records.test.ts.
 *
 * The validator contract: validateJournalRecords(records) throws an
 * Error naming the record id and the rule when any record fails. The
 * projection test proves the move changed nothing: the fixture was
 * captured by running the old code (answers at the pinned year
 * recorded in the fixture), so it deep-equals the old exports by
 * construction, and the new projection deep-equals it.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateJournalRecords } from "./validate.ts";
import { journalUnits, JOURNAL_RECORDS } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { journalAnswers } from "./answers.ts";
import fixture from "./__fixtures__/main-7c04e3a7.json" with { type: "json" };

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

const ENIAC_ID = "technology:eniac";
const FIRST_PHONE_ID = "technology:first-phone";

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = journalUnits().find((u) => u.id === ENIAC_ID);
  assert.ok(unit, `no unit for ${ENIAC_ID}`);
  const answer = journalAnswers(fixture.pinnedYear)[ENIAC_ID];
  assert.ok(answer, `no answer for ${ENIAC_ID}`);
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
  // appending it leaks the answer (the token "1500").
  const leaked = { ...good, why: `${good.why} ${good.answer.correct}.` };
  assert.throws(
    () => validateJournalRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(ENIAC_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validateJournalRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error && error.message.includes(ENIAC_ID),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validateJournalRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(ENIAC_ID) &&
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
    () => validateJournalRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(ENIAC_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a year-gap record that lost its anchor placeholders", () => {
  const record = JOURNAL_RECORDS.find((r) => r.id === FIRST_PHONE_ID);
  assert.ok(record, `no record for ${FIRST_PHONE_ID}`);
  // The generator fills {year} and {years} from the anchor year at
  // play time; a prompt that no longer carries {year} has lost the
  // anchor data the computation is fed by.
  const broken = {
    ...record,
    answer: { ...record.answer, prompt: record.answer.prompt.replace("{year}", "this year") },
  };
  assert.throws(
    () => validateJournalRecords([broken]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(FIRST_PHONE_ID) &&
      error.message.includes("anchor"),
  );
});

it("validator accepts the live records", () => {
  validateJournalRecords(JOURNAL_RECORDS);
});

it("projection equals the frozen main fixture for all 16 journals items", () => {
  assert.equal(journalUnits().length, 16);
  assert.equal(Object.keys(journalAnswers(fixture.pinnedYear)).length, 16);
  assert.deepEqual(journalUnits(), fixture.units);
  assert.deepEqual(journalAnswers(fixture.pinnedYear), fixture.answers);
  // Deal order is part of the projection, not just the set of ids.
  assert.deepEqual(
    journalUnits().map((u) => u.id),
    (fixture.units as { id: string }[]).map((u) => u.id),
  );
});
