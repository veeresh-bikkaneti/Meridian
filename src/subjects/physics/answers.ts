/**
 * Physics answers — thin compatibility export from the Phase 3 records.
 *
 * The records live in ./items.ts (PHYSICS_RECORDS); this module only projects
 * them into the PHYSICS_ANSWERS shape existing consumers import. One release
 * only: the next physics PR deletes this file.
 */
import { PHYSICS_RECORDS, toAnswerEntry } from "./items.ts";
import type { AnswerEntry } from "../shared/answer.ts";

export type PhysicsAnswerEntry = AnswerEntry;

export const PHYSICS_ANSWERS: Record<string, PhysicsAnswerEntry> = Object.fromEntries(
  PHYSICS_RECORDS.map((record) => [record.id, toAnswerEntry(record)]),
);

export function answerFor(itemId: string): PhysicsAnswerEntry | null {
  return PHYSICS_ANSWERS[itemId] ?? null;
}
