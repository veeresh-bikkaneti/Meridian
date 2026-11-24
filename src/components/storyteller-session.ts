import {
  getSessionStorageItem,
  getStorageItem,
  removeSessionStorageItem,
  removeStorageItem,
  setSessionStorageItem,
  setStorageItem,
} from "../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";

/**
 * Storyteller home handoff (H1) — session + day storage.
 *
 * 1. Session auto-narration flag (copy §5): retained for API/test compat
 *    but NO LONGER consumed by home (owner 2026-10-09) — story cards keep
 *    their own one-shot via claimFirstRevealNarration (storyteller-claim).
 * 2. Tour-return flag (copy G2): armed when the tour walk ends after the
 *    host yielded; read exactly once on the next home mount, then cleared.
 * 3. Greeting day key (localStorage): the once-per-day greeting gate.
 *
 * All storage access is fail-closed (private mode / SSR / node --test):
 * when storage is unavailable the flags degrade to module memory.
 */

export const AUTO_NARRATION_KEY = "meridian.storyteller.sessionAutoNarration.v1";
export const TOUR_RETURN_KEY = "meridian.storyteller.tourReturn.v1";
export const GREET_DAY_KEY = "meridian.storyteller.greetDay.v1";

// Memory fallbacks for environments without storage (private mode, node).
let memoryAutoNarration = false;
let memoryTourReturn: string | null = null;
let memoryGreetDay: string | null = null;

/** True once the session's one auto-narration has been consumed. */
export function isSessionAutoNarrationConsumed(): boolean {
  return (
    getSessionStorageItem(STORAGE_KEYS.storytellerSessionAutoNarration) === "1" ||
    memoryAutoNarration
  );
}

/**
 * Atomically consume the session's one auto-narration. Returns true only
 * for the first caller of the session. No production caller remains (home
 * stopped consuming it per owner 2026-10-09) — kept for API/test compat.
 */
export function consumeSessionAutoNarration(): boolean {
  if (isSessionAutoNarrationConsumed()) return false;
  setSessionStorageItem(STORAGE_KEYS.storytellerSessionAutoNarration, "1");
  memoryAutoNarration = true;
  return true;
}

/** Arm the post-tour return line for `dayKey` (tour walk ended after a yield). */
export function armTourReturnLine(dayKey: string): void {
  setSessionStorageItem(STORAGE_KEYS.storytellerTourReturn, dayKey);
  memoryTourReturn = dayKey;
}

/**
 * Read-and-clear the tour-return flag. Returns true only when a return line
 * is due today — exactly-once per arming (copy G2).
 */
export function takeTourReturnLine(dayKey: string): boolean {
  const stored = getSessionStorageItem(STORAGE_KEYS.storytellerTourReturn);
  const due = stored === dayKey || memoryTourReturn === dayKey;
  removeSessionStorageItem(STORAGE_KEYS.storytellerTourReturn);
  memoryTourReturn = null;
  return due;
}

/** The local day key of the last shown greeting ("YYYY-MM-DD" or null). */
export function readHomeGreetDay(): string | null {
  return getStorageItem(STORAGE_KEYS.storytellerGreetDay) ?? memoryGreetDay;
}

/** Record that today's greeting was shown. */
export function writeHomeGreetDay(dayKey: string): void {
  setStorageItem(STORAGE_KEYS.storytellerGreetDay, dayKey);
  memoryGreetDay = dayKey;
}

/** Internal: drop every flag. */
export function clearStorytellerSession(): void {
  removeSessionStorageItem(STORAGE_KEYS.storytellerSessionAutoNarration);
  removeSessionStorageItem(STORAGE_KEYS.storytellerTourReturn);
  removeStorageItem(STORAGE_KEYS.storytellerGreetDay);
  memoryAutoNarration = false;
  memoryTourReturn = null;
  memoryGreetDay = null;
}
