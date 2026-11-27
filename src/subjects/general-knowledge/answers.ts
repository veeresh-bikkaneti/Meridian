/**
 * General-knowledge answers — thin compatibility export from the
 * Phase 3 records.
 *
 * The records live in ./items.ts (GENERAL_KNOWLEDGE_RECORDS); this
 * module projects them into the GENERAL_KNOWLEDGE_ANSWERS shape
 * existing consumers import. One release only: the next
 * general-knowledge PR deletes this file.
 *
 * The opera-years-ago entry is the one computed case and is NOT in
 * the static map: it is a year-gap answer, built at play time from
 * the shared yearsSince mechanism and the device's current year —
 * the answer is never typed into content (owner rule). answerFor
 * builds it through operaYearsEntry below, exactly as before the
 * records move; the record in items.ts carries only the specimen
 * of its shape at the lint system's pinned year.
 *
 * Every derivation is listed in the PR body for educator review
 * (review runs alongside release, owner rule Nov 13).
 */
import { GENERAL_KNOWLEDGE_RECORDS, toAnswerEntry } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";
import { currentYear, yearsSince } from "../shared/years.ts";

export type GeneralKnowledgeAnswerEntry = AnswerEntry;

const OPERA_ITEM_ID = "general-knowledge:mixed:opera-years-ago";

/** The year the Sydney Opera House opened (from the item's why). */
export const OPERA_OPENED_YEAR = 1973;

/**
 * The opera-years-ago entry for a given current year. Pure, so tests
 * can pin the clock and fake two different years.
 */
export function operaYearsEntry(year: number): AnswerEntry {
  const value = yearsSince(OPERA_OPENED_YEAR, year);
  return {
    prompt: `A postcard says the Sydney Opera House opened in ${OPERA_OPENED_YEAR}. How many years ago was that?`,
    choices: [String(value - 3), String(value), String(value + 4)],
    correct: String(value),
    value,
    derivation: `${year} − ${OPERA_OPENED_YEAR} = ${value} years.`,
  };
}

/** All static entries, projected from the records. The computed
 *  opera entry is deliberately absent — see the header. */
export const GENERAL_KNOWLEDGE_ANSWERS: Record<string, GeneralKnowledgeAnswerEntry> =
  Object.fromEntries(
    GENERAL_KNOWLEDGE_RECORDS.filter((record) => record.id !== OPERA_ITEM_ID).map(
      (record) => [record.id, toAnswerEntry(record)],
    ),
  );

export function answerFor(itemId: string): GeneralKnowledgeAnswerEntry | null {
  if (itemId === OPERA_ITEM_ID) {
    return operaYearsEntry(currentYear());
  }
  return GENERAL_KNOWLEDGE_ANSWERS[itemId] ?? null;
}
