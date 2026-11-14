/**
 * The clue-card watchdog's decisions, pulled out of LoopScreen so they can
 * be tested without a browser.
 *
 * Under the pair, clue cards open one at a time as Watson presents them.
 * The watchdog is only a safety net for a pair that never reports (no
 * audio stack, a load error, the pair not mounted): it must never open
 * the whole ladder in one go, and it must not fire while a read is simply
 * waiting for the player's tap (tap mode, the 7-10 default).
 */

export interface ClueWatchdogInput {
  pairOn: boolean;
  finished: boolean;
  /** Cards painted now. */
  visibleClues: number;
  /** Cards the game has revealed. */
  cluesRevealed: number;
  guessCount: number;
  startingClues: number;
  /** A clue read is held for the player's Listen / Watson tap. */
  readHeld: boolean;
}

/** Should the 30 s timer run at all? */
export function shouldArmClueWatchdog(i: ClueWatchdogInput): boolean {
  if (!i.pairOn || i.finished) return false;
  if (i.visibleClues >= i.cluesRevealed) return false;
  // A fresh multi-clue deal opens one card as Watson reads it. Do not
  // dump the rest while he is still on the first question.
  if (i.guessCount === 0 && i.cluesRevealed <= i.startingClues) return false;
  // A read waiting on the player's tap is not a stall.
  if (i.readHeld) return false;
  return true;
}

/** When the timer fires: open ONE more card, never past what the game
 * has revealed. The timer re-arms on the next render if more remain. */
export function nextWatchdogCount(
  visibleClues: number,
  cluesRevealed: number,
): number {
  return Math.min(cluesRevealed, visibleClues + 1);
}

/** A guess confirmed while starting cards are still shut: open at most
 * ONE more card (the next in order), never the whole deal. The card the
 * guess just unlocked (`cluesRevealed`) waits for its own read. Returns
 * the highest card number to report as presented. */
export function guessPresentTarget(
  presented: number,
  cluesRevealed: number,
): number {
  return Math.max(1, Math.min(cluesRevealed - 1, presented + 1));
}
