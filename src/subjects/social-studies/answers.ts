/**
 * Social studies answers — thin compatibility export from the Phase 3 records.
 *
 * The records live in ./items.ts (SOCIAL_STUDIES_RECORDS); this module only
 * projects them into the SOCIAL_STUDIES_ANSWERS shape existing consumers
 * import. One release only: the next social-studies PR deletes this file.
 *
 * Each answer was derived from its row's why and objective; the
 * derivations are listed in the records themselves and were reviewed
 * for educator review alongside release (owner rule Nov 13). Numbers
 * come from the row's why wherever the why carries them; two questions
 * use an example built from the objective (area-by-squares and
 * trip-cost, the latter labelled as example prices in the question,
 * per the screened-topics limit for money questions).
 */
import { SOCIAL_STUDIES_RECORDS, toAnswerEntry } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";

export type SocialStudiesAnswerEntry = AnswerEntry;

export const SOCIAL_STUDIES_ANSWERS: Record<string, SocialStudiesAnswerEntry> = Object.fromEntries(
  SOCIAL_STUDIES_RECORDS.map((record) => [record.id, toAnswerEntry(record)]),
);

export function answerFor(itemId: string): SocialStudiesAnswerEntry | null {
  return SOCIAL_STUDIES_ANSWERS[itemId] ?? null;
}
