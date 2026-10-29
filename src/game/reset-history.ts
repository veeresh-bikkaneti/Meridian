/**
 * "Start over" reset — one wipe of the player's game history, composed
 * from the per-store clears in their owner modules (manifest
 * 2026-10-28, §2/§6). This module owns no store of its own: it calls
 * clearReviewDeck / clearLearningStore / clearTrailHistory /
 * clearLoopStore / clearColdtrailStore / clearSession and reports an
 * honest partition — a store that could not be cleared lands in
 * `failed`, the rest still clear, and success is claimed only when
 * `failed` is empty (D4). The UI pairs this with the in-memory half:
 * replaceSession(null) plus the epoch/event refresh (D6/D14/D15).
 *
 * The one exception to "no raw key removal here" is the paused-run keys
 * (`meridian.run` / `meridian.run.mc2` / `meridian.drop`, the "paused-run" step below): those
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
import { clearSession, SESSION_KEY } from "./session.ts";

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
  for (const key of [RUN_KEY, RUN_MC2_KEY, DROP_KEY]) {
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
    { store: "session", clear: () => clearSession(session) },
    { store: "paused-run", clear: () => clearPausedRun(session) },
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
  return { cleared, failed };
}
