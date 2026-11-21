/**
 * Math answers — thin compatibility export from the Phase 3 records.
 *
 * The records live in ./items.ts (MATH_RECORDS); this module only projects
 * them into the MATH_ANSWERS shape existing consumers import. One release
 * only: the next math PR deletes this file.
 */
import { MATH_RECORDS, toAnswerEntry } from "./items.ts";
import type { SubjectAnswer } from "./items.ts";

export type MathAnswerEntry = SubjectAnswer;

export const MATH_ANSWERS: Record<string, MathAnswerEntry> = Object.fromEntries(
  MATH_RECORDS.map((record) => [record.id, toAnswerEntry(record)]),
);

export function answerFor(itemId: string): MathAnswerEntry | null {
  return MATH_ANSWERS[itemId] ?? null;
}
