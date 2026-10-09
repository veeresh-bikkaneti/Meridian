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

const AUTO_NARRATION_KEY = "meridian.storyteller.sessionAutoNarration.v1";
const TOUR_RETURN_KEY = "meridian.storyteller.tourReturn.v1";
const GREET_DAY_KEY = "meridian.storyteller.greetDay.v1";

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function localStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
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
let memoryGreetDay: string | null = null;

/** True once the session's one auto-narration has been consumed. */
export function isSessionAutoNarrationConsumed(): boolean {
  return read(sessionStore(), AUTO_NARRATION_KEY) === "1" || memoryAutoNarration;
}

/**
 * Atomically consume the session's one auto-narration. Returns true only
 * for the first caller of the session. No production caller remains (home
 * stopped consuming it per owner 2026-10-09) — kept for API/test compat.
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

/** The local day key of the last shown greeting ("YYYY-MM-DD" or null). */
export function readHomeGreetDay(): string | null {
  return read(localStore(), GREET_DAY_KEY) ?? memoryGreetDay;
}

/** Record that today's greeting was shown. */
export function writeHomeGreetDay(dayKey: string): void {
  write(localStore(), GREET_DAY_KEY, dayKey);
  memoryGreetDay = dayKey;
}

/** Test-only: drop every flag. */
export function resetStorytellerSessionForTests(): void {
  const s = sessionStore();
  const l = localStore();
  remove(s, AUTO_NARRATION_KEY);
  remove(s, TOUR_RETURN_KEY);
  remove(l, GREET_DAY_KEY);
  memoryAutoNarration = false;
  memoryTourReturn = null;
  memoryGreetDay = null;
}
