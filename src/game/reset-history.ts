/**
 * "Start over" reset — one wipe of the player's game history, composed
 * from the per-store clears in their owner modules (manifest
 * 2026-10-28, §2/§6). This module owns no store of its own: it calls
 * clearReviewDeck / clearLearningStore / clearTrailHistory /
 * clearLoopStore / clearColdtrailStore / clearSession /
 * clearDiscardedShadowFrom / clearAgeProfileForReset and reports an
 * honest partition — a store that could not be cleared lands in
 * `failed`, the rest still clear, and success is claimed only when
 * `failed` is empty (D4). The UI pairs this with the in-memory half:
 * replaceSession(null) plus the epoch/event refresh (D6/D14/D15).
 *
 * Amendment (2026-11-15, full reset for shared devices): the
 * age-band profile joins the wipe (the "age-profile" step, via
 * its owner module's clearAgeProfileForReset). Before this, the
 * reset deliberately kept the profile — the confirm copy's
 * "Your grown-up choices stay" — so on a shared device the next
 * player inherited the last player's band and was never asked.
 * Now a reset returns the app to first-run state: no band set
 * (the picker's pills show again), no saved or resumable game,
 * no history. Badges and the device preferences (sound, palette,
 * difficulty, map mode) still stay — they are not the player's
 * progress, saved game, band or history. The confirm copy is
 * locked text (manifest 2026-10-28 §4) and is NOT reworded here;
 * the label/copy question is flagged for the owner in the PR.
 *
 * Amendment (2026-11-18): the per-subject progress store (the
 * Why Learn picker's solved-unit records, owned by
 * subject-progress.ts) joins the wipe as the "subject-progress"
 * step, through its owner module's clear-all — a full reset
 * leaves no subject progress behind, exactly as the per-subject
 * Reset on each picker card clears just its own subject.
 *
 * The one exception to "no raw key removal here" is the paused-run keys
 * (`meridian.run` / `meridian.run.mc2` / `meridian.run.mc3` / `meridian.drop`, the "paused-run" step below): those
 * keys have no owner module — they live in the UI layer
 * (game-app.tsx) — and a surviving run would re-seed the cleared
 * session via seedSessionFromRun when its edition is reopened (D13).
 *
 * Never throws: storage can be blocked, full, or absent, and a reset
 * attempt must always end in a report, not a crash.
 */

import { clearReviewDeck, readReviewDeck, deckCounts } from "./review-deck.ts";
import { clearLearningStore, readLearningStore } from "./learning.ts";
import { clearTrailHistory } from "./trail.ts";
import { clearLoopStore } from "./loop/store.ts";
import { clearColdtrailStore } from "./coldtrail/store.ts";
import { clearSession, clearDiscardedShadowFrom, SESSION_KEY } from "./session.ts";
import { clearChallengeAttempts } from "./challenge-attempts.ts";
import {
  clearAgeProfileForReset,
  validateProfile,
  PROFILE_STORAGE_KEY,
} from "./age-profile/store.ts";
import {
  clearAllSubjectProgress,
  readSubjectProgress,
} from "../subjects/shared/subject-progress.ts";

export type ResetStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
};

export type ResetHistoryResult = {
  /** Names of the stores verified cleared, in clear order. */
  cleared: string[];
  /** Stores that could not be cleared (the UI keeps the dialog open). */
  failed: { store: string }[];
};

const RUN_KEY = "meridian.run";
const RUN_MC2_KEY = "meridian.run.mc2";
const RUN_MC3_KEY = "meridian.run.mc3";
const DROP_KEY = "meridian.drop";

function resolveLocal(explicit?: ResetStorage): ResetStorage | undefined {
  if (explicit) return explicit;
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function resolveSession(explicit?: ResetStorage): ResetStorage | undefined {
  if (explicit) return explicit;
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * The paused-run keys (D13): both run slots plus the current-place
 * drop. Removal only — there is no empty value a
 * run could be overwritten with that a reader would treat as "no run"
 * more honestly than a failed report, so a blocked removal fails the
 * step and the player can retry.
 */
function clearPausedRun(session: ResetStorage | undefined): boolean {
  if (!session) return true; // No storage = nothing was ever persisted.
  let ok = true;
  for (const key of [RUN_KEY, RUN_MC2_KEY, RUN_MC3_KEY, DROP_KEY]) {
    try {
      session.removeItem(key);
    } catch {
      ok = false;
    }
    try {
      if (session.getItem(key) !== null) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}

export function resetHistory(
  storage?: ResetStorage,
  sessionStorageArg?: ResetStorage,
): ResetHistoryResult {
  const local = resolveLocal(storage);
  const session = resolveSession(sessionStorageArg);
  const steps: { store: string; clear: () => boolean }[] = [
    { store: "review-deck", clear: () => clearReviewDeck(local) },
    { store: "learning", clear: () => clearLearningStore(local) },
    { store: "trail", clear: () => clearTrailHistory(local) },
    { store: "geodetective", clear: () => clearLoopStore(local) },
    { store: "coldtrail", clear: () => clearColdtrailStore(local) },
    { store: "challenge-attempts", clear: () => clearChallengeAttempts(local) },
    { store: "session", clear: () => clearSession(session) },
    // Fix round 2: a Start-over reset with no stored session used to
    // leave a preserved shadow behind (clearSession's hadStoredSession
    // gate, correctly, does not touch it) — and that shadow would fire
    // as a discarded-game notice on a later boot, resurrecting history
    // the player just wiped. Clear it from the INJECTED local storage
    // (never the globals — U-R6); the global clearDiscardedShadow()
    // cannot serve reset, and a raw-key removal here would violate
    // this module's documented no-raw-key rule (paused-run keys only).
    { store: "discarded-shadow", clear: () => clearDiscardedShadowFrom(local) },
    { store: "paused-run", clear: () => clearPausedRun(session) },
    // Amendment (2026-11-15, see the header note): the age-band
    // profile is part of the full clean-out, cleared through its
    // owner module's reset clear (injected local storage only —
    // U-R6). Its change event is what drops the picker back to
    // the first-run band pills in place.
    { store: "age-profile", clear: () => clearAgeProfileForReset(local) },
    // Per-subject progress (the Why Learn picker's solved-unit
    // records) joins the wipe through its owner module's
    // clear-all, in this composition's injected-storage pattern.
    { store: "subject-progress", clear: () => clearAllSubjectProgress(local) },
  ];
  const cleared: string[] = [];
  const failed: { store: string }[] = [];
  for (const step of steps) {
    let ok = false;
    try {
      ok = step.clear();
    } catch {
      ok = false; // A clear that throws is a failed store, never a crash.
    }
    if (ok) cleared.push(step.store);
    else failed.push({ store: step.store });
  }
  // Post-clear re-read verification (D4): a store whose clear reported
  // success but whose data still reads back as present is moved to
  // failed — the success toast must never fire over surviving history.
  // (The enumerated/legacy stores verify inside their owner modules,
  // where the key lists belong; the single-document stores are re-read
  // here through their owners' readers.)
  const moveToFailed = (store: string) => {
    const i = cleared.indexOf(store);
    if (i !== -1) {
      cleared.splice(i, 1);
      failed.push({ store });
    }
  };
  try {
    const deck = readReviewDeck(local);
    if (deck && deckCounts(deck).total > 0) moveToFailed("review-deck");
  } catch {
    moveToFailed("review-deck");
  }
  try {
    const learning = readLearningStore(local);
    if (
      learning &&
      (Object.keys(learning.records).length > 0 || learning.daysPlayed.length > 0)
    ) {
      moveToFailed("learning");
    }
  } catch {
    moveToFailed("learning");
  }
  try {
    const raw = session?.getItem(SESSION_KEY);
    if (raw !== null && raw !== undefined && raw !== "") moveToFailed("session");
  } catch {
    moveToFailed("session");
  }
  try {
    if (Object.keys(readSubjectProgress(local)).length > 0) moveToFailed("subject-progress");
  } catch {
    moveToFailed("subject-progress");
  }
  try {
    const raw = local?.getItem(PROFILE_STORAGE_KEY);
    if (raw !== null && raw !== undefined && raw !== "") {
      // An unset blob (the removal-blocked overwrite fallback)
      // reads as no band everywhere, so it counts as cleared; an
      // active profile still on disk is a failed reset.
      let active = true;
      try {
        active = validateProfile(JSON.parse(raw))?.status === "active";
      } catch {
        active = false; // A corrupt blob fails closed to unset at load.
      }
      if (active) moveToFailed("age-profile");
    }
  } catch {
    moveToFailed("age-profile");
  }
  return { cleared, failed };
}
