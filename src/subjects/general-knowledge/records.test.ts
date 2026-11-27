/**
 * General-knowledge records (Phase 3) — validator + projection equality.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types), same style as
 * chemistry/records.test.ts.
 *
 * The validator contract: validateGeneralKnowledgeRecords(records)
 * throws an Error naming the record id and the rule when any record
 * fails. The projection test proves the move changed nothing: the
 * fixture was captured by running the old code (answers frozen at
 * the fixture's pinned year, 2026), so it deep-equals the old exports
 * by construction, and the new projection deep-equals it.
 *
 * The opera-years item is the one computed case: its play-time
 * answer comes from operaYearsEntry(currentYear()) and is never
 * stored, so the static answers map holds the other nine ids and
 * the opera entry is pinned against its generator at the fixture
 * year instead. Its record carries the generator's output at the
 * lint system's pinned year (2091) as the specimen of the answer's
 * shape — the same year lint:subjects evaluates the item at.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateGeneralKnowledgeRecords } from "./validate.ts";
import { generalKnowledgeUnits, GENERAL_KNOWLEDGE_ITEM_IDS, GENERAL_KNOWLEDGE_RECORDS } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { GENERAL_KNOWLEDGE_ANSWERS, operaYearsEntry } from "./answers.ts";
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

const EIFFEL_ID = "general-knowledge:mixed:eiffel-antennas";
const OPERA_ID = "general-knowledge:mixed:opera-years-ago";
/** The year scripts/lint-subject-leads.mjs pins the clock to. */
const LINT_PIN_YEAR = 2091;

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = generalKnowledgeUnits().find((u) => u.id === EIFFEL_ID);
  assert.ok(unit, `no unit for ${EIFFEL_ID}`);
  const answer = GENERAL_KNOWLEDGE_ANSWERS[EIFFEL_ID];
  assert.ok(answer, `no answer for ${EIFFEL_ID}`);
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
  // appending it leaks the answer (the token "59").
  const leaked = { ...good, why: `${good.why} ${good.answer.correct}.` };
  assert.throws(
    () => validateGeneralKnowledgeRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EIFFEL_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validateGeneralKnowledgeRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error && error.message.includes(EIFFEL_ID),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validateGeneralKnowledgeRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EIFFEL_ID) &&
      error.message.includes("duplicate id"),
  );
});

it("validator rejects a follow-up answer leaked in the lead", () => {
  const good = goodRecord();
  // The follow-up's correct choice ("The northern side") is unique to
  // it: its token "northern" sits in the lead, while the main answer
  // stays clean, so only the follow-up check can fire.
  const followUp = {
    prompt: "After that, which side of the river is the tower on?",
    choices: ["The northern side", "The southern side"],
    correct: "The northern side",
    derivation: "The tower stands on the northern side of the river.",
  };
  const leaked = {
    ...good,
    why: `${good.why} The northern side.`,
    answer: { ...good.answer, followUp },
  };
  assert.throws(
    () => validateGeneralKnowledgeRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(EIFFEL_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator accepts the live records and deal order matches GENERAL_KNOWLEDGE_ITEM_IDS", () => {
  validateGeneralKnowledgeRecords(GENERAL_KNOWLEDGE_RECORDS);
  assert.deepEqual(
    GENERAL_KNOWLEDGE_RECORDS.map((r) => r.id),
    [...GENERAL_KNOWLEDGE_ITEM_IDS],
  );
  // Every Wave A item (after the original 10) carries verified provenance.
  for (const record of GENERAL_KNOWLEDGE_RECORDS.slice(10)) {
    assert.ok(
      typeof record.provenance === "object" &&
        record.provenance.source.startsWith("https://") &&
        record.provenance.verifiedOn === "2026-11-26",
      `expected verified provenance on ${record.id}`,
    );
  }
});

it("projection preserves the frozen main fixture for the original 10 general-knowledge items", () => {
  assert.equal(generalKnowledgeUnits().length, 21);
  assert.equal(GENERAL_KNOWLEDGE_RECORDS.length, 21);
  assert.equal(Object.keys(GENERAL_KNOWLEDGE_ANSWERS).length, 20);
  // Original 10 items remain an exact prefix of generalKnowledgeUnits().
  assert.deepEqual(generalKnowledgeUnits().slice(0, 10), fixture.units);
  // The static answers map includes every entry of the frozen fixture
  // minus the computed opera entry; the opera entry is pinned against its
  // generator at the fixture's pinned year (2026).
  const { [OPERA_ID]: operaFrozen, ...staticFrozen } = fixture.answers;
  for (const [id, expected] of Object.entries(staticFrozen)) {
    assert.deepEqual(GENERAL_KNOWLEDGE_ANSWERS[id], expected, `frozen answer mismatch for ${id}`);
  }
  assert.deepEqual(operaYearsEntry(fixture.pinnedYear), operaFrozen);
  // The opera record's specimen answer is the generator's output at
  // the lint pin year — never a stored play-time answer.
  const operaRecord = GENERAL_KNOWLEDGE_RECORDS.find((r) => r.id === OPERA_ID);
  assert.ok(operaRecord, `no record for ${OPERA_ID}`);
  assert.deepEqual(operaRecord.answer, operaYearsEntry(LINT_PIN_YEAR));
  // Deal order of the original 10 items is preserved as a prefix.
  assert.deepEqual(
    generalKnowledgeUnits()
      .slice(0, 10)
      .map((u) => u.id),
    (fixture.units as { id: string }[]).map((u) => u.id),
  );
});
