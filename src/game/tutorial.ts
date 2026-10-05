/**
 * First-run tutorial state — client-side "seen" persistence and the
 * practice-round constants.
 *
 * The tutorial is an invitation, never a gate: a first-time player can
 * start guessing in one tap, and the invitation is a dismissible inline
 * banner on the menu. "Seen" is a localStorage flag; every read/write is
 * fail-closed (storage errors never break the game, and an unreadable
 * store reads as "seen" so a broken store never nags the player).
 */

/** localStorage key marking that the tutorial invitation was shown/handled. */
export const TUTORIAL_SEEN_KEY = "meridian.tutorialSeen";

/**
 * The tutorial's single practice place: the curated Eiffel Tower starter
 * (tier 1, famous, authored hook — "meant to be temporary and stayed").
 * The tour runs a "country" edition practice round on France with this as
 * the only dealt place, so the first beat is an easy, famous, guaranteed
 * question.
 */
export const TUTORIAL_PLACE_ID = "eiffel";
export const TUTORIAL_EDITION = "country" as const;
export const TUTORIAL_REGION_ID = "france";
export const TUTORIAL_REGION_NAME = "France";

/** The tutorial's three beats: aim instruction → reveal feedback → hook. */
export type TutorialBeat = 1 | 2 | 3;

/** Minimal storage surface, so unit tests can inject a fake. */
export type TutorialStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): TutorialStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * True when the tutorial invitation has been shown and handled (taken or
 * dismissed). Fail-closed: an unreadable store reads as seen — the game
 * boots normally and the invitation simply doesn't appear.
 */
export function hasSeenTutorial(storage?: TutorialStorage | null): boolean {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return true;
  try {
    return store.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

/** Record that the invitation was shown and handled. Never throws. */
export function markTutorialSeen(storage?: TutorialStorage | null): void {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    // Storage blocked (private mode, quota) — the invitation may reappear
    // next visit, but the game itself is unaffected.
  }
}

/**
 * Reset the seen flag (tests and any future "replay the tour" surface).
 * Never throws.
 */
export function clearTutorialSeen(storage?: TutorialStorage | null): void {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    store.removeItem(TUTORIAL_SEEN_KEY);
  } catch {
    // Ignore — same rationale as markTutorialSeen.
  }
}

/**
 * Sentinel check for a persisted tutorial practice round: exactly one
 * place, the tutorial's. A reload mid-tour must NOT resume the practice
 * round (the dealer would recycle the single place forever) — the boot
 * path drops it and lands on the menu instead.
 */
export function isTutorialRunPool(poolIds: readonly string[] | null | undefined): boolean {
  return (
    Array.isArray(poolIds) &&
    poolIds.length === 1 &&
    poolIds[0] === TUTORIAL_PLACE_ID
  );
}
