/**
 * Crash-loop breaker: a pagehide-gated clean-exit flag.
 *
 * The game persists `meridian.run` to sessionStorage BEFORE the game screen
 * mounts and the boot effect auto-resumes any resumable run. When iOS kills
 * the web process mid-game (jetsam/WebKit), the reload replays the identical
 * heavy path and gets killed again — one kill becomes the "repeatedly
 * occurred" loop. This flag breaks the loop by detecting the asymmetry:
 * normal unloads (reload, tab close, navigation) always fire `pagehide`; a
 * process kill never does.
 *
 * Flag semantics (all in sessionStorage, so they die with the tab):
 * - missing or "1": the previous page exited cleanly — safe to auto-resume.
 *   Missing also covers runs saved before this flag existed, preserving
 *   their behavior across the deploy.
 * - "0": the previous page wrote a run but never unloaded — a process kill.
 *   The boot effect must NOT auto-resume; it clears the stale run, re-arms
 *   the flag to "1", and lands on the menu.
 */

export const CLEAN_EXIT_KEY = "meridian.cleanExit";

/** Minimal storage surface the flag helpers need (keeps them unit-testable). */
export interface CleanExitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function flagStorage(): CleanExitStorage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Stamp the page as having unsaved-crash state: if it dies without
 * unloading, the next boot must not auto-resume. Called from `writeRun`,
 * the single choke point for persisting a run.
 */
export function stampCleanExitDirty(store: CleanExitStorage | null = flagStorage()): void {
  try {
    store?.setItem(CLEAN_EXIT_KEY, "0");
  } catch {
    // Storage blocked; the run still lives in memory.
  }
}

/**
 * Stamp the page as having unloaded cleanly. This is the `pagehide` handler
 * (kept as a named export so tests can exercise it directly); it takes no
 * event because nothing about the unload matters — only that it happened.
 */
export function handlePageHide(store: CleanExitStorage | null = flagStorage()): void {
  try {
    store?.setItem(CLEAN_EXIT_KEY, "1");
  } catch {
    // The page is going away anyway; nothing to do.
  }
}

/**
 * Was the previous page load killed without unloading? A missing flag
 * (pre-update runs) and "1" both count as clean.
 */
export function isUncleanShutdown(store: CleanExitStorage | null = flagStorage()): boolean {
  try {
    return store?.getItem(CLEAN_EXIT_KEY) === "0";
  } catch {
    // A storage failure is not evidence of a kill; fail toward resume.
    return false;
  }
}

/**
 * After an unclean shutdown: drop the stale saved run and re-arm the flag
 * to clean, so the boot lands on the menu and never re-enters the crash path.
 */
export function clearRunAfterUncleanShutdown(
  runKey: string,
  store: CleanExitStorage | null = flagStorage(),
): void {
  try {
    store?.removeItem(runKey);
    store?.setItem(CLEAN_EXIT_KEY, "1");
  } catch {
    // Storage blocked; there is nothing to resume from anyway.
  }
}
