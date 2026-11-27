/**
 * Biology records — validator + projection contract tests.
 * Plain Node test runner, relative imports only (the src suite runs
 * under node --experimental-strip-types).
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { validateBiologyRecords } from "./validate.ts";
import {
  BIOLOGY_ITEM_IDS,
  BIOLOGY_RECORDS,
  answerFor,
  biologyUnits,
  itemsForGroup,
  toAnswerEntry,
} from "./items.ts";
import type { SubjectAnswer } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";

// Pin: the zod mirror (SubjectAnswer) must stay the same shape as the
// shared AnswerEntry.
type _EqualKeys<A, B> =
  keyof A extends keyof B ? (keyof B extends keyof A ? true : false) : false;
type _AnswerKeysPin = _EqualKeys<SubjectAnswer, AnswerEntry>;
const _answerKeysPin: _AnswerKeysPin = true;
type _MirrorFitsShared = SubjectAnswer extends AnswerEntry ? true : false;
const _mirrorFitsShared: _MirrorFitsShared = true;
type _SharedFitsMirrorOneLevel =
  Omit<AnswerEntry, "followUp"> extends Omit<SubjectAnswer, "followUp"> ? true : false;
const _sharedFitsMirrorOneLevel: _SharedFitsMirrorOneLevel = true;

const CELL_ID = "biology:life-structure:one-cell-many-jobs";

/** One good record, built from the live exports (no hand-typed content). */
function goodRecord() {
  const unit = biologyUnits().find((u) => u.id === CELL_ID);
  assert.ok(unit, `no unit for ${CELL_ID}`);
  const answer = answerFor(CELL_ID);
  assert.ok(answer, `no answer for ${CELL_ID}`);
  return {
    ...unit,
    answer,
    provenance: "UNVERIFIED" as const,
    media: [] as { id: string; kind: "clip" | "still"; revealsAnswer: boolean }[],
    leadPolicy: "answer-not-in-lead" as const,
  };
}

it("validator rejects a record whose lead contains its correct answer", () => {
  const good = goodRecord();
  // Appending the correct choice ("The mitochondrion") leaks the unique token "mitochondrion".
  const leaked = { ...good, why: `${good.why} ${good.answer.correct}.` };
  assert.throws(
    () => validateBiologyRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with no answer", () => {
  const good = goodRecord();
  const { answer: _removed, ...noAnswer } = good;
  assert.throws(
    () => validateBiologyRecords([noAnswer as typeof good]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.includes("missing answer"),
  );
});

it("validator rejects two records sharing an id", () => {
  const good = goodRecord();
  assert.throws(
    () => validateBiologyRecords([good, { ...good }]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.includes("duplicate id"),
  );
});

it("validator rejects a follow-up answer leaked in the lead", () => {
  const good = goodRecord();
  const followUp = {
    prompt: "Which gas does that organelle use to release energy?",
    choices: ["Oxygen gas", "Nitrogen gas"],
    correct: "Oxygen gas",
    derivation: "Cells use oxygen during cellular respiration.",
  };
  const leaked = {
    ...good,
    why: `${good.why} Oxygen gas.`,
    answer: { ...good.answer, followUp },
  };
  assert.throws(
    () => validateBiologyRecords([leaked]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.toLowerCase().includes("lead"),
  );
});

it("validator rejects a record with a stored current year", () => {
  const good = goodRecord();
  const dated = { ...good, why: `${good.why} Checked in 2026.` };
  assert.throws(
    () => validateBiologyRecords([dated]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.includes("stored year 2026"),
  );
});

it("validator rejects an unknown media id", () => {
  const good = goodRecord();
  const badMedia = {
    ...good,
    media: [{ id: "nonexistent-biology-still", kind: "still" as const, revealsAnswer: false }],
  };
  assert.throws(
    () => validateBiologyRecords([badMedia]),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(CELL_ID) &&
      error.message.includes("unknown still media id"),
  );
});

it("validator accepts all 14 live BIOLOGY_RECORDS", () => {
  assert.equal(BIOLOGY_RECORDS.length, 14);
  validateBiologyRecords(BIOLOGY_RECORDS);
});

it("biology projections match BIOLOGY_ITEM_IDS deal order and band counts", () => {
  assert.equal(BIOLOGY_ITEM_IDS.length, 14);
  assert.deepEqual(
    biologyUnits().map((u) => u.id),
    [...BIOLOGY_ITEM_IDS],
  );
  assert.equal(itemsForGroup("7-10").length, 4);
  assert.equal(itemsForGroup("10-18").length, 9);
  assert.equal(itemsForGroup("18+").length, 1);
  assert.equal(answerFor("biology:does-not-exist"), null);
  for (const record of BIOLOGY_RECORDS) {
    assert.deepEqual(answerFor(record.id), toAnswerEntry(record));
    assert.deepEqual(record.media, []);
    assert.equal(record.leadPolicy, "answer-not-in-lead");
  }
});
