/**
 * case-voice.ts — the math case's answer-blind voice wiring.
 *
 * The ONLY input is a case event name ("open" | "correct" | "wrong" |
 * "finished") — never an answer value, an item id, or a measurement —
 * so nothing the pair says or does can depend on the answer (the rigs'
 * answer-blind architecture, kept). Each event maps to fixed manifest
 * clips only (public/audio/detective/manifest.json `fixed`); no new
 * audio:
 * - open     → lets-find-clues (Watson)
 * - correct  → win-holmes (Holmes)
 * - wrong    → one ack-* clip (Holmes), drawn exactly the way
 *   GeoDetective draws it: drawAckId from detective-state.ts — a
 *   random draw from the ack pool minus the lines already played in
 *   this case, so no ack repeats inside a case (pool wrap excludes
 *   the line just said).
 * - finished → win-watson (Watson), enqueued after the final correct's
 *   win-holmes — detective-state.ts's own case-ending order.
 *
 * Speech mode (investigated in detective-audio.ts): the player is
 * created in its default "auto" mode, deliberately NOT "tap".
 * Evidence: in "tap" mode an enqueued item plays for real only when
 * it is a selection read, an armed guess read, or an ending ref
 * (isEndingRef: win-holmes / win-watson qualify; lets-find-clues and
 * ack-* do NOT), and the tap-mode hold retains only clue sequences —
 * a chain that starts with a clue ref, which the math case never
 * enqueues, so an ack would not even be held. The math surface has
 * no Listen / replay control, so in "tap" mode the open line and
 * every wrong-answer ack would be silently skipped with no way for
 * the kid to hear them. "auto" is the smallest configuration that
 * plays all four events, and its gates stay authoritative: every
 * clip is checked at play time against isSoundOn (the global sound
 * toggle + hidden-tab guard) and canAutoPlay (detectiveCanAutoPlay —
 * the read-aloud preference vetoes autoplay), so sound off or a
 * "never" read-aloud preference still silences everything. All of
 * the math lines follow the kid's own taps (entering the case,
 * picking an answer), so no line is unsolicited ambient speech.
 *
 * Playback goes through createDetectiveSpeech, whose runClip claims
 * the shared voice channel (claimVoice("detective", …, userInitiated)
 * in src/game/audio/voice-channel.ts) before every clip — one voice
 * at a time across the whole app, the owner's rule.
 */

// Relative imports with extensions, so this module loads under the
// repo's node --test runner as well as Vite.
import {
  createDetectiveSpeech,
  type DetectiveSpeechOptions,
  type DetectiveSpeechPlayer,
  type DetectiveSpeaker,
} from "../../game/loop/detective/detective-audio.ts";
import {
  drawAckId,
  type SpeakRef,
} from "../../game/loop/detective/detective-state.ts";

export type { DetectiveSpeaker };

export type MathCaseEvent = "open" | "correct" | "wrong" | "finished";

/**
 * Pure event → clip mapping. Its only inputs are the event name, the
 * ack lines already played in this case, and an injectable rng (the
 * GeoDetective draw seam). Returns the refs to enqueue and the new
 * played-ack set.
 */
export function refsForMathCaseEvent(
  event: MathCaseEvent,
  acksUsed: readonly string[] = [],
  rng: () => number = Math.random,
): { refs: SpeakRef[]; acksUsed: readonly string[] } {
  switch (event) {
    case "open":
      return { refs: [{ kind: "fixed", id: "lets-find-clues" }], acksUsed };
    case "correct":
      return { refs: [{ kind: "fixed", id: "win-holmes" }], acksUsed };
    case "finished":
      return { refs: [{ kind: "fixed", id: "win-watson" }], acksUsed };
    case "wrong": {
      const ackId = drawAckId(acksUsed, rng);
      return {
        refs: [{ kind: "fixed", id: ackId }],
        acksUsed: [...acksUsed, ackId],
      };
    }
  }
}

/**
 * Pose mapping for the pair strip, as plain pose names (the rigs'
 * own vocabulary in DetectivePair.tsx). Resting: Holmes "search",
 * Watson "read". While a clip sounds: a correct answer puts Holmes
 * in "celebrate-jump" (win-holmes), a wrong answer puts him in
 * "ack" (the ack clip), and the finished sequence puts BOTH rigs in
 * "celebrate-jump". Open keeps the resting poses (Watson speaks
 * lets-find-clues in "read").
 */
export function posesForMathCase(
  event: MathCaseEvent | null,
  speaking: DetectiveSpeaker | null,
): { holmes: string; watson: string } {
  if (speaking && event === "finished") {
    return { holmes: "celebrate-jump", watson: "celebrate-jump" };
  }
  if (speaking === "holmes" && event === "correct") {
    return { holmes: "celebrate-jump", watson: "read" };
  }
  if (speaking === "holmes" && event === "wrong") {
    return { holmes: "ack", watson: "read" };
  }
  return { holmes: "search", watson: "read" };
}

export interface MathCaseVoice {
  /** Feed one answer-blind case event; its clips enqueue in order. */
  handleEvent(event: MathCaseEvent): void;
  stopAll(): void;
  dispose(): void;
  /** The underlying speech player (test seam). */
  player: DetectiveSpeechPlayer;
}

export function createMathCaseVoice(
  opts: DetectiveSpeechOptions = {},
  rng: () => number = Math.random,
): MathCaseVoice {
  // Speech mode "auto" — see the header for the tap-mode evidence.
  // Any speechMode in opts is overridden on purpose: the finding
  // above is the configuration of record for this surface.
  const player = createDetectiveSpeech({ ...opts, speechMode: "auto" });
  let acksUsed: readonly string[] = [];
  return {
    player,
    handleEvent(event: MathCaseEvent): void {
      const mapped = refsForMathCaseEvent(event, acksUsed, rng);
      acksUsed = mapped.acksUsed;
      for (const ref of mapped.refs) player.enqueue(ref);
    },
    stopAll(): void {
      player.stopAll();
    },
    dispose(): void {
      player.dispose();
    },
  };
}
