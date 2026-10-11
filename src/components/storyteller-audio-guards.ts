/**
 * Storyteller narration-silence guards (owner's phone: captions advance,
 * zero audio). Pure decision helpers — no React, no DOM — so node --test
 * can walk each fix's decision path. Both storyteller.tsx (card) and
 * storyteller-home.tsx (banner) call these; the components own the
 * timers/listeners around them.
 */
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  STORYTELLER_RETRY_HINT,
} from "./storyteller-lines.ts";

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

/** Fix C — what to do when play() rejects with AbortError. */
export type PlayAbortResolution = "mark-paused" | "leave";
export function resolvePlayAbort(opts: {
  /** audioRef.current === the element this attempt created. */
  isCurrentAttempt: boolean;
  /** The element is sitting paused (our own pause()/dismiss() aborted it). */
  elementPaused: boolean;
  dismissed: boolean;
}): PlayAbortResolution {
  // An aborted play() on a dead/paused element must not strand
  // audioState "playing" — the card has no figure tap to recover it, and
  // the speaker/replay buttons bail while state is "playing". "paused" is
  // recoverable (replay / speaker / figure tap can resume).
  if (opts.isCurrentAttempt && opts.elementPaused && !opts.dismissed)
    return "mark-paused";
  return "leave";
}

/** Fix D — banner: when a figure tap should replay the greeting instead of
    rotating a text-only poke line. */
export function shouldReplayGreeting(opts: {
  /** Only the greeting mode has audio; the tour-return line is text-only. */
  mode: "greeting" | "tour-return";
  started: boolean;
  /** beginGreetingAudio ran at least once this mount. */
  attempted: boolean;
  /** The greeting audio actually sounded (ended, or clock advanced). */
  heard: boolean;
  /** The kid explicitly dismissed a greeting in flight — quiet means quiet. */
  dismissedByUser: boolean;
  /** The auto one-shot was consumed (guards the pointerdown→click race:
      the window listener may have started the greeting on this tap's way
      down — replaying again would double-start it). */
  oneShotConsumed: boolean;
  greetAudioAvailable: boolean;
  soundOn: boolean;
}): boolean {
  return (
    opts.mode === "greeting" &&
    opts.started &&
    opts.attempted &&
    !opts.heard &&
    !opts.dismissedByUser &&
    opts.oneShotConsumed &&
    opts.greetAudioAvailable &&
    opts.soundOn
  );
}

/** Fix E — fallback caption assembly. The retry hint appears only when the
    failure was a play() rejection (clip exists, playback never started —
    the silent symptom), never on network errors, and never device-shames. */
export function fallbackLine(opts: {
  failed: boolean;
  playRejected: boolean;
}): string | null {
  if (!opts.failed) return null;
  return opts.playRejected
    ? `${STORYTELLER_AUDIO_FALLBACK_LINE} ${STORYTELLER_RETRY_HINT}`
    : STORYTELLER_AUDIO_FALLBACK_LINE;
}
