/**
 * subject-host-props.ts — the subject pair's prop whitelist.
 *
 * Mirrors src/game/loop/detective/detective-host-props.ts: answer-
 * blindness is structural. SubjectCase holds the item, the answer and
 * every pick evaluation — the pair receives NONE of it. This module is
 * the single construction site for the subject host's props, and its
 * key list is the contract a unit test pins: exactly three fields,
 * each a boolean derived from the case's own flow state —
 *
 * - solved:    the current item is solved (a correct pick landed).
 * - wrongPick: an unsolved wrong pick stands (SubjectCase's `picked`
 *              is set only by a wrong pick and cleared on a solve).
 * - finished:  the solved item is the band's LAST item. The host —
 *              not this builder — owns the first-time-per-mount
 *              guard, because the guard is about the host's mount.
 *
 * There is no item, no item id, no answer, no choice, and no band in
 * the shape: a caller cannot pass one through this builder without a
 * type error.
 *
 * Signals + clips (the state→clip mapping, also pinned by tests):
 * the host edge-detects the props into one of four signals —
 * "open" (the host mounted with the case), "correct" (solved rose),
 * "wrong" (wrongPick rose), "finished" (finished rose) — and maps
 * each signal to AT MOST one fixed manifest clip:
 *
 * - open     → lets-find-clues (Watson: "Let's find some clues.")
 * - correct  → win-holmes (Holmes: "You found it!")
 * - wrong    → SILENCE. Determination: every ack-* text in the real
 *              manifest is a Holmes-to-Watson receipt acknowledgment
 *              ("Right. Leave it with me." / "Very well, Watson." /
 *              "Noted, Watson." / "Ah... the game is afoot." /
 *              "Heard, Watson." / "I'll take that, Watson." /
 *              "Filed, Watson." / "Received, Watson." / "Set it
 *              down, Watson." / "One moment, Watson.") — they
 *              acknowledge receiving something from Watson, and a
 *              kid's wrong pick hands the pair nothing, so none of
 *              them fits a wrong answer (ack-3/7/8 are additionally
 *              flagged in the manifest for a human ear check). The
 *              rule is ack ONLY if its words fit, else silence.
 * - finished → SILENCE. win-watson ("Case closed — the gold star
 *              marks the answer.") is a GeoDetective line — it
 *              describes that game's gold-star board — so under the
 *              tightened clip rules it stays GeoDetective-only and
 *              the subject case's finish is visual only.
 *
 * Never requested by this wiring: instructions-*, win-watson,
 * decode-*, hook-announcement, debrief-*, ask-next, suspicion,
 * score-celebration (GeoDetective-only or off-brief).
 */

// Relative imports with extensions, so this module loads under the
// repo's node --test runner as well as Vite.
import type { SpeakRef } from "../../game/loop/detective/detective-state.ts";
import type { DetectiveSpeaker } from "../../game/loop/detective/detective-audio.ts";

export interface SubjectDetectiveHostProps {
  solved: boolean;
  wrongPick: boolean;
  finished: boolean;
}

/** The exact key set, in construction order — pinned by the props test. */
export const SUBJECT_HOST_PROP_KEYS = [
  "solved",
  "wrongPick",
  "finished",
] as const;

/**
 * Build the host props from the case's own flow state. The input type
 * is deliberately the same narrow shape: nothing else can cross.
 */
export function buildSubjectDetectiveHostProps(
  input: SubjectDetectiveHostProps,
): SubjectDetectiveHostProps {
  return {
    solved: input.solved,
    wrongPick: input.wrongPick,
    finished: input.finished,
  };
}

export type SubjectCaseSignal = "open" | "correct" | "wrong" | "finished";

/**
 * Edge detection over the prop stream: which signals, if any, this
 * prop change carries, in firing order. A last-item solve raises
 * solved AND finished in the same render: it carries BOTH signals —
 * "correct" first (its clip plays), then "finished" (which requests
 * no clip of its own; it never replaces the correct signal).
 * "open" is not detected here: it is the host's mount itself.
 */
export function subjectSignalsFor(
  prev: SubjectDetectiveHostProps,
  next: SubjectDetectiveHostProps,
): SubjectCaseSignal[] {
  const signals: SubjectCaseSignal[] = [];
  if (next.solved && !prev.solved) signals.push("correct");
  if (next.finished && !prev.finished) signals.push("finished");
  if (next.wrongPick && !prev.wrongPick) signals.push("wrong");
  return signals;
}

/**
 * The state→clip mapping. Returns the ONE fixed ref a signal speaks,
 * or null when the signal is silent (wrong / finished — see the
 * header determinations). Only two ids can ever come out of this
 * function: "lets-find-clues" and "win-holmes".
 */
export function speakRefForSubjectSignal(
  signal: SubjectCaseSignal,
): SpeakRef | null {
  switch (signal) {
    case "open":
      return { kind: "fixed", id: "lets-find-clues" };
    case "correct":
      return { kind: "fixed", id: "win-holmes" };
    case "wrong":
      return null;
    case "finished":
      return null;
  }
}

/**
 * Pose mapping for the strip, in the rigs' own vocabulary
 * (DetectivePair.tsx). Resting: Holmes "search", Watson "read".
 * While win-holmes sounds after a correct pick, Holmes is in
 * "celebrate-jump". A finished case (last item solved) holds BOTH
 * rigs in "celebrate-jump" — a visual beat only, finished being
 * silent. Wrong picks change no pose.
 */
export function subjectPairPoses(input: {
  finished: boolean;
  lastSignal: SubjectCaseSignal | null;
  speaking: DetectiveSpeaker | null;
}): { holmes: string; watson: string } {
  if (input.finished) {
    return { holmes: "celebrate-jump", watson: "celebrate-jump" };
  }
  if (input.lastSignal === "correct" && input.speaking === "holmes") {
    return { holmes: "celebrate-jump", watson: "read" };
  }
  return { holmes: "search", watson: "read" };
}
