/**
 * Chemistry answers — thin compatibility export from the Phase 3 records.
 *
 * The records live in ./items.ts (CHEMISTRY_RECORDS); this module only
 * projects them into the CHEMISTRY_ANSWERS shape existing consumers
 * import. One release only: the next chemistry PR deletes this file.
 *
 * Wording follows docs/scaling/chemistry/fact-notes.md: salt on roads
 * is claimed only as lowering water's freezing point; no melt speed
 * and no temperature is stated. No biology in any question.
 */
import { CHEMISTRY_RECORDS, toAnswerEntry } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";

export type ChemistryAnswerEntry = AnswerEntry;

export const CHEMISTRY_ANSWERS: Record<string, ChemistryAnswerEntry> = Object.fromEntries(
  CHEMISTRY_RECORDS.map((record) => [record.id, toAnswerEntry(record)]),
);

export function answerFor(itemId: string): ChemistryAnswerEntry | null {
  return CHEMISTRY_ANSWERS[itemId] ?? null;
}
