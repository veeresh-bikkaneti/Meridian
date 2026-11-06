/**
 * detective-host-props.ts — the pair's prop whitelist (U5).
 *
 * Answer-blindness is structural (BUILD-SCOPE §2.3): LoopScreen holds the
 * puzzle, the clue file, and every guess evaluation — the pair receives
 * NONE of it. This module is the single construction site for the host's
 * props, and its key list is the contract a unit test pins: exactly these
 * five fields, built from values the screen already owns. There is no
 * puzzle object, no clue file, no target, no guesses array, and no
 * evaluation anywhere in the shape.
 *
 * - caseIndex:        which case is open (audio manifest binding only).
 * - cluesRevealed:    how many clues are on screen (1..5) — the ladder's
 *                     position, never clue text.
 * - status:           the game's own playing/won/lost status.
 * - sheetOpen:        whether the confirm bottom sheet is up.
 * - lastGuessPlaceId: the player's OWN latest pick id, echoed back for
 *                     the selection read — their input, nothing about
 *                     whether it was right.
 */

import type { LoopStatus } from "../types.ts";

export interface DetectiveHostProps {
  caseIndex: number;
  cluesRevealed: number;
  status: LoopStatus;
  sheetOpen: boolean;
  lastGuessPlaceId: string | null;
}

/** The exact key set, in construction order — pinned by the props test. */
export const DETECTIVE_HOST_PROP_KEYS = [
  "caseIndex",
  "cluesRevealed",
  "status",
  "sheetOpen",
  "lastGuessPlaceId",
] as const;

/**
 * Build the host props from the screen's own state. The input type is
 * deliberately the same narrow shape: a caller cannot pass a puzzle or
 * clue file through this builder without a type error.
 */
export function buildDetectiveHostProps(input: DetectiveHostProps): DetectiveHostProps {
  return {
    caseIndex: input.caseIndex,
    cluesRevealed: input.cluesRevealed,
    status: input.status,
    sheetOpen: input.sheetOpen,
    lastGuessPlaceId: input.lastGuessPlaceId,
  };
}
