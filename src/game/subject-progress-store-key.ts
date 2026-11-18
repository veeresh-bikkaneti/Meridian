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
 * load should not grow). subject-progress.ts imports and
 * re-exports this module's clear and key, so the store's public
 * API still lives in one place.
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

/**
 * Clear every subject's record (the "Start over" reset's step).
 * Removal follows the other stores' precedent: where removal
 * fails, overwrite with the empty document so a stale blob
 * cannot resurrect progress. Returns true only when a re-read
 * proves the store is empty — the raw key is either gone or
 * holds exactly the empty document the fallback writes.
 *
 * No change-bus event here (the bus lives in subject-progress.ts,
 * with the picker): a successful full reset closes the subjects
 * branch outright (GameApp's reset handler), so no mounted
 * picker is left showing stale progress, and a failed reset
 * cleared nothing there was to announce.
 */
export function clearAllSubjectProgress(storage?: SubjectProgressStorage): boolean {
  const s = resolveSubjectProgressStorage(storage);
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
  try {
    const raw = s.getItem(SUBJECT_PROGRESS_KEY);
    return raw === null || raw === "{}";
  } catch {
    return false;
  }
}
