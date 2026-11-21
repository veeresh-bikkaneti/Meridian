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
 * blocked or absent, and the storage port's change announcements
 * (src/platform/storage) so the picker can re-render the moment
 * a case records a solve. The reads, writes and announcements
 * all go through the port now: its registry entry for this key
 * carries the same validation the hand-rolled reader used.
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
  setSubjectProgressClearedHook,
  type SubjectProgressStorage,
} from "../../game/subject-progress-store-key.ts";
import {
  createBrowserStoragePort,
  getStorageItem,
  notifyStorageChanged,
  setStorageItem,
  subscribeStorage,
} from "../../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../../platform/storage/keys.ts";

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
 * string arrays, is not progress — the registry entry's schema
 * checks exactly that, and the port reads anything missing,
 * corrupt or off-schema back as the empty document. (Record
 * writes only ever append a new id to a subject's list, so
 * stored lists hold no duplicates to clean up.)
 *
 * With a caller-passed storage the read runs on a port over
 * that storage alone; with none it runs on the shared port.
 */
export function readSubjectProgress(storage?: StorageLike): SubjectProgress {
  return storage
    ? createBrowserStoragePort({ backend: storage }).getItem(STORAGE_KEYS.subjectProgress)
    : getStorageItem(STORAGE_KEYS.subjectProgress);
}

function writeSubjectProgress(progress: SubjectProgress, storage?: StorageLike): void {
  // The port never throws when storage is blocked or absent;
  // the game must never break on progress data.
  if (storage) {
    createBrowserStoragePort({ backend: storage }).setItem(STORAGE_KEYS.subjectProgress, progress);
  } else {
    setStorageItem(STORAGE_KEYS.subjectProgress, progress);
  }
}

// ---------------------------------------------------------------------------
// Change announcements: the storage port owns the one event
// system — its subscribe covers this tab's announcements and
// other tabs' storage events alike (the port attaches its
// cross-tab listener with the first subscriber and detaches it
// with the last; where there is no window it never attaches).
// Writers here announce through the port at exactly the points
// the old in-memory bus emitted, and listener errors are
// isolated by the port — one bad subscriber never breaks the
// store write that announced.
// ---------------------------------------------------------------------------

/** Subscribe to progress changes. Returns an unsubscribe function. */
export function onSubjectProgressChanged(listener: () => void): () => void {
  return subscribeStorage(SUBJECT_PROGRESS_KEY, listener);
}

// The game-side clear-all (subject-progress-store-key.ts) cannot
// import this store's announcements — subjects depend on game,
// never the reverse — so it announces through a hook, wired
// here, once, at import.
setSubjectProgressClearedHook(() => notifyStorageChanged(SUBJECT_PROGRESS_KEY));

/**
 * Record one solved unit under its subject. Idempotent by set
 * semantics: recording the same unit twice changes nothing and
 * emits nothing.
 */
export function recordUnitComplete(subjectId: string, unitId: string, storage?: StorageLike): void {
  // Copy before writing: a read of an empty store hands back
  // the registry's shared fallback object, which must never be
  // mutated — the writers here only ever replace top-level
  // entries, so a shallow copy is the whole fix.
  const progress: SubjectProgress = { ...readSubjectProgress(storage) };
  const units = progress[subjectId] ?? [];
  if (units.includes(unitId)) return;
  progress[subjectId] = [...units, unitId];
  writeSubjectProgress(progress, storage);
  notifyStorageChanged(SUBJECT_PROGRESS_KEY);
}

/** True when the subject has at least one recorded solved unit. */
export function hasSubjectProgress(subjectId: string, storage?: StorageLike): boolean {
  return (readSubjectProgress(storage)[subjectId]?.length ?? 0) > 0;
}

/**
 * Clear ONE subject's record; every other subject's record stays
 * byte-identical. Returns true only when a re-read proves that
 * subject is gone. A clear that actually removed the subject
 * emits exactly one change event — subscribers (the picker)
 * re-read on the announcement alone — and clearing a subject with
 * nothing recorded changes nothing and emits nothing.
 */
export function clearSubjectProgress(subjectId: string, storage?: StorageLike): boolean {
  // Copy before deleting, for the same reason recordUnitComplete
  // copies: the read may hand back the shared fallback object.
  const progress: SubjectProgress = { ...readSubjectProgress(storage) };
  if (!(subjectId in progress)) return true; // Nothing recorded = already clear.
  delete progress[subjectId];
  writeSubjectProgress(progress, storage);
  const cleared = !(subjectId in readSubjectProgress(storage));
  if (cleared) notifyStorageChanged(SUBJECT_PROGRESS_KEY);
  return cleared;
}
