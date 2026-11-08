/**
 * detective-host-props.ts — the pair's prop whitelist (U5, extended U8).
 *
 * Answer-blindness is structural (BUILD-SCOPE §2.3): LoopScreen holds the
 * puzzle, the clue file, and every guess evaluation — the pair receives
 * NONE of it. This module is the single construction site for the host's
 * props, and its key list is the contract a unit test pins: exactly these
 * fields, built from values the screen already owns. There is no puzzle
 * object, no clue file, no target, no guesses array, and no evaluation
 * anywhere in the shape.
 *
 * - caseIndex:        which case is open (audio manifest binding only).
 * - cluesRevealed:    how many clues are on screen (1..5) — the ladder's
 *                     position, never clue text.
 * - status:           the game's own playing/won/lost status.
 * - sheetOpen:        whether the confirm bottom sheet is up.
 * - lastGuessPlaceId: the player's OWN latest pick id, echoed back for
 *                     the selection read — their input, nothing about
 *                     whether it was right.
 * - freshDeal:        (U8) whether this case was dealt fresh on this
 *                     mount (vs resumed) — gates the case-open
 *                     instructions only. A boolean about the DEAL, never
 *                     about the case's content.
 * - answerPlaceId:    (U8) the ANSWER's placeId, for the post-solve
 *                     debrief's name read. The builder DERIVES it from
 *                     the post-solve reveal state: it passes through
 *                     only when status is "won" (the game itself has
 *                     already revealed the answer on screen) and is
 *                     forced to null while playing or lost, whatever
 *                     the caller passes. Pre-solve, the pair cannot
 *                     hold the answer's id — structurally.
 */

import type { LoopStatus } from "../types.ts";

export interface DetectiveHostProps {
  caseIndex: number;
  cluesRevealed: number;
  status: LoopStatus;
  sheetOpen: boolean;
  lastGuessPlaceId: string | null;
  freshDeal: boolean;
  answerPlaceId: string | null;
}

/** The exact key set, in construction order — pinned by the props test. */
export const DETECTIVE_HOST_PROP_KEYS = [
  "caseIndex",
  "cluesRevealed",
  "status",
  "sheetOpen",
  "lastGuessPlaceId",
  "freshDeal",
  "answerPlaceId",
] as const;

/**
 * Build the host props from the screen's own state. The input type is
 * deliberately the same narrow shape: a caller cannot pass a puzzle or
 * clue file through this builder without a type error. answerPlaceId is
 * the one field the builder does not pass through blindly — it is
 * derived from the reveal state (status) as documented above.
 */
export function buildDetectiveHostProps(input: DetectiveHostProps): DetectiveHostProps {
  return {
    caseIndex: input.caseIndex,
    cluesRevealed: input.cluesRevealed,
    status: input.status,
    sheetOpen: input.sheetOpen,
    lastGuessPlaceId: input.lastGuessPlaceId,
    freshDeal: input.freshDeal,
    // Post-solve ONLY: while the case is playing (or lost — the debrief
    // is a solve-only speech), the answer's id does not cross.
    answerPlaceId: input.status === "won" ? input.answerPlaceId : null,
  };
}
