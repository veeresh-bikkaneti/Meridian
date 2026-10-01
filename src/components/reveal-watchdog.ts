/**
 * Reveal watchdog contract — the game can never deadlock in
 * "Showing the answer."
 *
 * The result card renders only after the map's reveal choreography reaches
 * its end state (`reveal-done` → `onRevealComplete` → `revealDone`). If that
 * signal is ever lost (a stuck controller beat, a swallowed moveend, an
 * exception in the reveal dispatch, a mid-beat commit whose beat never
 * completes), the run would strand in the story phase: no result card, no
 * Next place, drop-pin disabled — the exact deadlock Veeresh hit on the live
 * site (score 163, "1 placed", "Showing the answer.", no Next in the DOM).
 *
 * This module holds the watchdog's pure contract so it stays unit-testable
 * without a React renderer:
 *
 * - `REVEAL_WATCHDOG_MS` — how long the story phase may wait for the real
 *   `reveal-done` before the app forces the result card. Must exceed the
 *   longest legitimate reveal (REVEAL_DURATION_MS = 2200 ms in zoom-space)
 *   with headroom, so it never preempts a real reveal — the card must not
 *   appear mid-choreography.
 * - `shouldArmRevealWatchdog(phase, hasPlace, revealDone)` — the arming
 *   predicate the game-app effect uses. Pure so the rule "story + place +
 *   not yet revealed ⇒ arm" is pinned by tests.
 */

export const REVEAL_WATCHDOG_MS = 6000;

export function shouldArmRevealWatchdog(
  phase: string,
  hasPlace: boolean,
  revealDone: boolean,
): boolean {
  return phase === "story" && hasPlace && !revealDone;
}
