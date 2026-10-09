/**
 * Storyteller home handoff (H1) — session + day storage.
 *
 * 1. Session auto-narration flag (copy §5): story cards consume the
 *    session's one auto-narration (sessionStorage); later cards that
 *    session degrade to text + speaker button — no double-audio.
 *    (Owner 2026-10-09: home no longer consumes this flag — every home
 *    visit narrates independently.)
 * 2. Tour-return flag (copy G2): armed when the tour walk ends after the
 *    host yielded; read exactly once on the next home mount, then cleared.
 *
 * All storage access is fail-closed (private mode / SSR / node --test):
 * when storage is unavailable the flags degrade to module memory.
 */

const AUTO_NARRATION_KEY = "meridian.storyteller.sessionAutoNarration.v1";
const TOUR_RETURN_KEY = "meridian.storyteller.tourReturn.v1";

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: Storage | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    // Storage unavailable — the memory fallback below keeps working.
  }
}

function remove(store: Storage | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // Ignore — fail closed.
  }
}

// Memory fallbacks for environments without storage (private mode, node).
let memoryAutoNarration = false;
let memoryTourReturn: string | null = null;

/** True once the session's one auto-narration has been consumed. */
export function isSessionAutoNarrationConsumed(): boolean {
  return read(sessionStore(), AUTO_NARRATION_KEY) === "1" || memoryAutoNarration;
}

/**
 * Atomically consume the session's one auto-narration. Returns true only
 * for the first caller of the session — the home greeting calls this when
 * its greeting audio actually starts playing.
 */
export function consumeSessionAutoNarration(): boolean {
  if (isSessionAutoNarrationConsumed()) return false;
  write(sessionStore(), AUTO_NARRATION_KEY, "1");
  memoryAutoNarration = true;
  return true;
}

/** Arm the post-tour return line for `dayKey` (tour walk ended after a yield). */
export function armTourReturnLine(dayKey: string): void {
  write(sessionStore(), TOUR_RETURN_KEY, dayKey);
  memoryTourReturn = dayKey;
}

/**
 * Read-and-clear the tour-return flag. Returns true only when a return line
 * is due today — exactly-once per arming (copy G2).
 */
export function takeTourReturnLine(dayKey: string): boolean {
  const store = sessionStore();
  const stored = read(store, TOUR_RETURN_KEY);
  const due = stored === dayKey || memoryTourReturn === dayKey;
  remove(store, TOUR_RETURN_KEY);
  memoryTourReturn = null;
  return due;
}

/** Test-only: drop every flag. */
export function resetStorytellerSessionForTests(): void {
  const s = sessionStore();
  remove(s, AUTO_NARRATION_KEY);
  remove(s, TOUR_RETURN_KEY);
  memoryAutoNarration = false;
  memoryTourReturn = null;
}
