/**
 * subject-pair.ts — Holmes and Watson in the subject cases: the pair's
 * prop whitelist, the state → line map and the state → pose map.
 *
 * Answer-blind by construction, the detective-host-props.ts approach:
 * SubjectCase owns the item, the answer and every evaluation; the pair
 * gets NONE of it. It may know only which case is open (so a new case
 * re-opens the scene) and one of four states: the case is open, the
 * last pick was wrong, the pick was correct, or the band's last case
 * is solved (finished). A unit test pins the exact key set.
 *
 * Lines: only clips already in public/audio/detective/manifest.json
 * under `fixed`, chosen for words that fit every subject:
 *  - open:     Watson, "Let's find some clues." (lets-find-clues)
 *  - correct:  Holmes, "You found it!" (win-holmes)
 *  - finished: Holmes, "You found it!" (win-holmes) — still a win
 *  - wrong:    silence. Every ack-* line is Holmes answering Watson
 *              ("Noted, Watson.", "Set it down, Watson.", …) or a
 *              GeoDetective cue ("the game is afoot"); none fits a
 *              wrong answer, so a wrong pick stays quiet.
 * The words are kept here so the speech bubble shows exactly what is
 * said, and a unit test checks them against the manifest text.
 *
 * Same pair for every age band: nothing here takes the band.
 *
 * Relative imports with extensions and type-only rig imports, so this
 * module loads under the repo's node --test runner.
 */
import type { HolmesPose, WatsonPose } from "../../game/loop/detective/DetectivePair.tsx";

export type SubjectPairState = "open" | "wrong" | "correct" | "finished";

export interface SubjectPairProps {
  /** Which case of the band is open (0-based) — a new case re-opens the scene. */
  caseIndex: number;
  state: SubjectPairState;
}

/** The exact key set, in construction order — pinned by the unit test. */
export const SUBJECT_PAIR_PROP_KEYS = ["caseIndex", "state"] as const;

/**
 * Build the pair's props from flags SubjectCase already owns. The input
 * is booleans and an index only: there is no field for the item, the
 * answer, the choices or the player's pick, so none can cross.
 */
export function buildSubjectPairProps(input: {
  caseIndex: number;
  /** The case is solved (the result card is showing). */
  solved: boolean;
  /** The player's last pick was not the answer (kind feedback is showing). */
  wrongPick: boolean;
  /** This is the band's last case. */
  lastCase: boolean;
}): SubjectPairProps {
  const state: SubjectPairState = input.solved
    ? input.lastCase
      ? "finished"
      : "correct"
    : input.wrongPick
      ? "wrong"
      : "open";
  return { caseIndex: input.caseIndex, state };
}

export interface SubjectPairLine {
  /** Clip id under the manifest's `fixed`. */
  id: string;
  who: "holmes" | "watson";
  /** The clip's words, exactly as the manifest records them. */
  words: string;
}

const LETS_FIND_CLUES: SubjectPairLine = {
  id: "lets-find-clues",
  who: "watson",
  words: "Let's find some clues.",
};
const WIN_HOLMES: SubjectPairLine = {
  id: "win-holmes",
  who: "holmes",
  words: "You found it!",
};

/** State → line, or null for silence. */
export const SUBJECT_PAIR_LINES: Record<SubjectPairState, SubjectPairLine | null> = {
  open: LETS_FIND_CLUES,
  wrong: null,
  correct: WIN_HOLMES,
  finished: WIN_HOLMES,
};

export function lineForState(state: SubjectPairState): SubjectPairLine | null {
  return SUBJECT_PAIR_LINES[state];
}

export interface SubjectPairPoses {
  holmes: HolmesPose;
  watson: WatsonPose;
  /** The win cluster (CELEBRATE_LAYOUT, palm to palm) instead of the row. */
  celebrate: boolean;
}

/**
 * State → poses. Existing poses only, never "walk": the pair stands in
 * place. With motion, the win opens on one celebrate jump before the
 * high-five; with reduced motion it goes straight to the still
 * high-five (detective.css already freezes every rig animation then).
 */
export function posesForState(
  state: SubjectPairState,
  opts: { reducedMotion: boolean; jumping: boolean },
): SubjectPairPoses {
  switch (state) {
    case "open":
      return { holmes: "search", watson: "read", celebrate: false };
    case "wrong":
      return { holmes: "berth-think", watson: "think", celebrate: false };
    case "correct":
    case "finished":
      return !opts.reducedMotion && opts.jumping
        ? { holmes: "celebrate-jump", watson: "celebrate-jump", celebrate: true }
        : { holmes: "high-five", watson: "high-five", celebrate: true };
  }
}
