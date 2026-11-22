/** Fix A — card one-shot gesture decision. */
export type FirstGestureDecision = "ignore" | "keep-armed" | "consume";
export function decideFirstGesture(opts: {
  alreadyDone: boolean;
  dismissed: boolean;
  celebrationActive: boolean;
  soundOn: boolean;
}): FirstGestureDecision {
  if (opts.alreadyDone || opts.dismissed) return "ignore";
  // A gesture that lands while the celebration overlay owns the screen
  // belongs to the overlay — don't consume it for narration.
  if (opts.celebrationActive) return "ignore";
  // Sound off: do NOT consume the one-shot. Captions advancing with no
  // audio and no path back is the silent-narration trap — the listener
  // stays armed so the next gesture (or unmute) gets another chance.
  if (!opts.soundOn) return "keep-armed";
  return "consume";
}
