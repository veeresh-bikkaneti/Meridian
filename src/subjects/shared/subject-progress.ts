/**
 * subject-progress.ts — the SOLE owner of the per-subject
 * progress store: which subject-case units a player has solved.
 *
 * Subjects kept no persistent progress before this module — a
 * case's state lived in memory and vanished when the player left
 * the screen. The picker's per-subject Reset needs something
 * honest to reset, so this is the smallest substrate that tells
 * the truth: one localStorage document naming, per subject, the
 * ids of the units solved in the case's main phase. Nothing else
 * is recorded — no scores, no attempts, no answers.
 *
 * The shape follows the repo's other stores (the age-profile
 * store, the learning store): one key, one JSON document, reads
 * validated on the way in (a corrupt or wrong-shaped blob reads
 * as empty, never as a crash — the age-profile store's whole-blob
 * fail-closed rule), writes that never throw when storage is
 * blocked or absent, and a tiny in-memory change bus in the
 * age-profile events pattern so the picker can re-render the
 * moment a case records a solve.
 *
 * One piece lives on the game side: clearAllSubjectProgress
 * (the "Start over" reset's step) is implemented in
 * src/game/subject-progress-store-key.ts and re-exported here,
 * so the reset composition — which ships in the first-load
 * bundle, and may not import from subjects — carries only that
 * one clear, not this whole picker store. See that file's
 * header for the full reasoning.
 */

import {
  SUBJECT_PROGRESS_KEY,
  resolveSubjectProgressStorage,
  type SubjectProgressStorage,
} from "../../game/subject-progress-store-key.ts";

export {
  clearAllSubjectProgress,
  SUBJECT_PROGRESS_KEY,
} from "../../game/subject-progress-store-key.ts";

/** Completed unit ids per subject id: `{ [subjectId]: string[] }`. */
export type SubjectProgress = { [subjectId: string]: string[] };

type StorageLike = SubjectProgressStorage;

/**
 * Read the whole store, validated on the way in. Fail closed to
 * empty: a corrupt blob, or a document whose values are not all
 * string arrays, is not progress. (Record writes only ever
 * append a new id to a subject's list, so stored lists hold no
 * duplicates to clean up.)
 */
export function readSubjectProgress(storage?: StorageLike): SubjectProgress {
  try {
    const s = resolveSubjectProgressStorage(storage);
    if (!s) return {};
    const raw = s.getItem(SUBJECT_PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const doc = parsed as Record<string, unknown>;
    for (const units of Object.values(doc)) {
      if (!Array.isArray(units) || !units.every((u) => typeof u === "string")) return {};
    }
    return doc as SubjectProgress;
  } catch {
    return {};
  }
}

function writeSubjectProgress(progress: SubjectProgress, storage?: StorageLike): void {
  try {
    const s = resolveSubjectProgressStorage(storage);
    if (s) s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked or full; the game must never break on progress data.
  }
}

// ---------------------------------------------------------------------------
// Change bus (the age-profile events pattern): the store emits, the
// picker subscribes and re-reads. Listener errors are isolated — one
// bad subscriber never breaks the store write that emitted.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

/** Subscribe to progress changes. Returns an unsubscribe function. */
export function onSubjectProgressChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitSubjectProgressChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Deliberately swallowed, like the age-profile bus.
    }
  }
}

/**
 * Record one solved unit under its subject. Idempotent by set
 * semantics: recording the same unit twice changes nothing and
 * emits nothing.
 */
export function recordUnitComplete(subjectId: string, unitId: string, storage?: StorageLike): void {
  const progress = readSubjectProgress(storage);
  const units = progress[subjectId] ?? [];
  if (units.includes(unitId)) return;
  progress[subjectId] = [...units, unitId];
  writeSubjectProgress(progress, storage);
  emitSubjectProgressChanged();
}

/** True when the subject has at least one recorded solved unit. */
export function hasSubjectProgress(subjectId: string, storage?: StorageLike): boolean {
  return (readSubjectProgress(storage)[subjectId]?.length ?? 0) > 0;
}

/**
 * Clear ONE subject's record; every other subject's record stays
 * byte-identical. Returns true only when a re-read proves that
 * subject is gone. (No change event: the one caller, the picker's
 * Reset tap, re-reads the store itself in the same tap.)
 */
export function clearSubjectProgress(subjectId: string, storage?: StorageLike): boolean {
  const progress = readSubjectProgress(storage);
  if (!(subjectId in progress)) return true; // Nothing recorded = already clear.
  delete progress[subjectId];
  writeSubjectProgress(progress, storage);
  return !(subjectId in readSubjectProgress(storage));
}
