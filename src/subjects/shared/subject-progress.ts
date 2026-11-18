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
 * as empty, never as a crash), writes that never throw when
 * storage is blocked or absent, and a tiny in-memory change bus
 * in the age-profile events pattern so the picker can re-render
 * the moment a case records a solve or a reset clears a subject.
 */

export const SUBJECT_PROGRESS_KEY = "meridian.subject-progress.v1";

/** Completed unit ids per subject id: `{ [subjectId]: string[] }`. */
export type SubjectProgress = { [subjectId: string]: string[] };

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function resolveStorage(explicit?: StorageLike): StorageLike | undefined {
  if (explicit) return explicit;
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Validate a decoded payload. Fail closed to empty: anything that
 * is not a plain object of string arrays is not progress. Unit
 * lists are de-duplicated — a unit is either solved or it is not.
 */
export function parseSubjectProgress(raw: unknown): SubjectProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SubjectProgress = {};
  for (const [subjectId, units] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(units) || !units.every((u) => typeof u === "string")) continue;
    const unique = [...new Set(units as string[])];
    if (unique.length > 0) out[subjectId] = unique;
  }
  return out;
}

/** Read the whole store. Corrupt or absent storage reads as empty. */
export function readSubjectProgress(storage?: StorageLike): SubjectProgress {
  try {
    const s = resolveStorage(storage);
    if (!s) return {};
    const raw = s.getItem(SUBJECT_PROGRESS_KEY);
    if (!raw) return {};
    return parseSubjectProgress(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeSubjectProgress(progress: SubjectProgress, storage?: StorageLike): void {
  try {
    const s = resolveStorage(storage);
    if (!s) return;
    if (Object.keys(progress).length === 0) {
      s.removeItem(SUBJECT_PROGRESS_KEY);
    } else {
      s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify(progress));
    }
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
  for (const listener of [...listeners]) {
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
 * subject is gone — the picker's Reset and the "Start over"
 * composition both rely on the honest answer.
 */
export function clearSubjectProgress(subjectId: string, storage?: StorageLike): boolean {
  const progress = readSubjectProgress(storage);
  if (!(subjectId in progress)) return true; // Nothing recorded = already clear.
  delete progress[subjectId];
  writeSubjectProgress(progress, storage);
  const cleared = !(subjectId in readSubjectProgress(storage));
  if (cleared) emitSubjectProgressChanged();
  return cleared;
}

/**
 * Clear every subject's record (the "Start over" reset's step,
 * composed by src/game/reset-history.ts). Removal follows the
 * other stores' precedent: where removal fails, overwrite with
 * the empty document so a stale blob cannot resurrect progress.
 * Returns true only when a re-read proves the store is empty.
 */
export function clearAllSubjectProgress(storage?: StorageLike): boolean {
  const s = resolveStorage(storage);
  if (!s) return true; // No storage = nothing was ever persisted.
  try {
    s.removeItem(SUBJECT_PROGRESS_KEY);
  } catch {
    try {
      s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify({}));
    } catch {
      // Both paths blocked; the verification below reports it.
    }
  }
  const cleared = Object.keys(readSubjectProgress(storage)).length === 0;
  if (cleared) emitSubjectProgressChanged();
  return cleared;
}
