/**
 * subject-progress-store-key.ts — the storage key, the storage
 * resolution and the "clear everything" half of the per-subject
 * progress store, kept in their own small module on purpose —
 * and housed under src/game/, because the layering runs one way:
 * subjects depend on game, never the reverse (the boundary is
 * lint-guarded; see eslint/game-boundary-rule.mjs).
 *
 * The "Start over" reset (src/game/reset-history.ts) composes
 * this clear into its wipe, and reset-history ships in the
 * first-load bundle. The rest of the progress store — reading,
 * recording, the change bus — lives in
 * src/subjects/shared/subject-progress.ts and is only ever used
 * by the Why Learn picker and its cases, which load lazily.
 * Keeping the clear here, with just the storage key and the
 * storage resolution it needs, means the first-load bundle
 * carries this one function instead of the whole picker store
 * (the entry-size budget's rule: subjects load lazily, so first
 * load should not grow). The one addition is the cleared hook
 * below — a single function slot the picker store wires its
 * change-bus emit into, so this clear announces itself without
 * the bus moving into first load. subject-progress.ts imports
 * and re-exports this module's clear and key, so the store's
 * public API still lives in one place.
 */

export const SUBJECT_PROGRESS_KEY = "meridian.subject-progress.v1";

/** The storage shape every progress-store function accepts. */
export type SubjectProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Resolve the storage to use: the injected one, else the global. */
export function resolveSubjectProgressStorage(
  explicit?: SubjectProgressStorage,
): SubjectProgressStorage | undefined {
  if (explicit) return explicit;
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// The cleared hook. Every store change announces itself exactly
// once, this clear included — but the change bus lives with the
// picker store (src/subjects/shared/subject-progress.ts), which
// this module may not import (subjects depend on game, never the
// reverse). So the bus reaches back through this single slot:
// subject-progress.ts wires its emit in at import, and a clear
// that actually removed data calls it. One slot, one wiring —
// the bus itself stays in one module.
// ---------------------------------------------------------------------------

let subjectProgressClearedHook: (() => void) | undefined;

/** Wire the change bus's emit (called once, by subject-progress.ts). */
export function setSubjectProgressClearedHook(hook: () => void): void {
  subjectProgressClearedHook = hook;
}

/**
 * Clear every subject's record (the "Start over" reset's step).
 * Removal follows the other stores' precedent: where removal
 * fails, overwrite with the empty document so a stale blob
 * cannot resurrect progress. Returns true only when a re-read
 * proves the store is empty — the raw key is either gone or
 * holds exactly the empty document the fallback writes.
 *
 * The clear announces itself through the cleared hook exactly
 * once, and only when data actually went away: the store held a
 * non-empty document before and re-reads empty now. An
 * already-empty store changes nothing and announces nothing,
 * and a failed clear cleared nothing there was to announce.
 */
export function clearAllSubjectProgress(storage?: SubjectProgressStorage): boolean {
  const s = resolveSubjectProgressStorage(storage);
  if (!s) return true; // No storage = nothing was ever persisted.
  let rawBefore: string | null | undefined;
  try {
    rawBefore = s.getItem(SUBJECT_PROGRESS_KEY);
  } catch {
    rawBefore = undefined; // Unreadable: no change can be proven, so none is announced.
  }
  try {
    s.removeItem(SUBJECT_PROGRESS_KEY);
  } catch {
    try {
      s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify({}));
    } catch {
      // Both paths blocked; the verification below reports it.
    }
  }
  try {
    const raw = s.getItem(SUBJECT_PROGRESS_KEY);
    const empty = raw === null || raw === "{}";
    // The hook is the bus's own emit, which isolates listener
    // errors itself — a listener's failure never fails the clear.
    if (empty && rawBefore && rawBefore !== "{}") subjectProgressClearedHook?.();
    return empty;
  } catch {
    return false;
  }
}
