/**
 * Storyteller mascot — session-once auto-narration claim.
 *
 * Lives in its own module (separate from storyteller-lines.ts) so host
 * screens can claim the first-reveal auto-narration WITHOUT statically
 * importing the ~2.3KB of narration caption copy — that copy resolves
 * inside the lazy storyteller chunk only.
 */

/**
 * First story reveal per session auto-narrates (T1); later reveals are
 * text + speaker button. Module-level flag: the SPA session is the unit,
 * a reload is a new session. `claimFirstRevealNarration` returns true only
 * for the first caller of the session.
 */
let firstRevealClaimed = false;

export function claimFirstRevealNarration(): boolean {
  if (firstRevealClaimed) return false;
  firstRevealClaimed = true;
  return true;
}

/** Test-only: drop the session flag. */
export function resetFirstRevealNarrationForTests(): void {
  firstRevealClaimed = false;
}
