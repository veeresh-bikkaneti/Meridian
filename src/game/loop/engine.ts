import { distanceKm, initialBearing, octantOf } from "../geo.ts";
import { evaluateGuess } from "./evaluate.ts";
import {
  LOOP_MAX_GUESSES,
  type LoopGuess,
  type LoopPuzzleProgress,
  type Octant,
} from "./types.ts";

/**
 * The GeoDetective's guess state machine. Pure functions: given a puzzle
 * state and a guess, produce the next puzzle state. The screen persists the
 * result via the loop store. The guess cap comes from the band's deal
 * (default LOOP_MAX_GUESSES preserves the shipped tuning).
 */

/** Direction arrow per octant, for the guess-history feedback line. */
export const OCTANT_ARROWS: Record<Octant, string> = {
  north: "↑",
  "north-east": "↗",
  east: "→",
  "south-east": "↘",
  south: "↓",
  "south-west": "↙",
  west: "←",
  "north-west": "↖",
};

/**
 * Bearing from (lon1, lat1) toward (lon2, lat2), snapped to 8 winds.
 * The LoopGuess octant is the direction FROM the guess TOWARD the target.
 * Delegates to geo.ts (shared with Worker 3's evaluate module) so there is
 * exactly one bearing/octant implementation.
 */
export function octantFor(lon1: number, lat1: number, lon2: number, lat2: number): Octant {
  const bearing = initialBearing([lon1, lat1], [lon2, lat2]);
  // Coincident points have no bearing — "north" is the arbitrary but stable
  // placeholder (same convention as evaluateGuess).
  return bearing === null ? "north" : octantOf(bearing);
}

/** A place the player picked in the guess input, before feedback is attached. */
export interface LoopGuessPick {
  name: string;
  placeId: string;
  lon: number;
  lat: number;
}

/**
 * Build a fully-formed LoopGuess from the picked place and the day's
 * target (from the clue file). Delegates the distance/octant/warmer math
 * to evaluateGuess — the engine never re-implements it.
 */
export function buildLoopGuess(
  pick: LoopGuessPick,
  target: { lon: number; lat: number },
  prevGuess: LoopGuess | null,
): LoopGuess {
  return {
    name: pick.name,
    lon: pick.lon,
    lat: pick.lat,
    ...evaluateGuess(
      { id: pick.placeId, lon: pick.lon, lat: pick.lat },
      target,
      prevGuess === null ? null : prevGuess.distKm,
    ),
  };
}

/**
 * Append a guess to the day state. Win when the guess's placeId matches
 * the clue file's target placeId; loss when all guesses are used.
 * `cluesRevealed` tracks guesses: min(5, startClues + guesses.length) —
 * one new clue card per guess on top of the band's starting deal.
 * Submitting on a finished mystery, past the guess cap, or a place that
 * was already guessed returns the state unchanged (a repeated pick is
 * never a wasted guess). Warmer is re-derived from the previous guess so
 * the engine — not the input — is authoritative.
 *
 * The optional config wires the age-profile band's GeoDetective deal
 * (Phase 1 §3b: 8-10 starts with 3 clues and a cap of 6; 11-13 starts
 * near-blind with a cap of 5). Defaults preserve the shipped tuning.
 */
export interface SubmitGuessOptions {
  /** Clues visible when the mystery is dealt (default 1). */
  startClues?: number;
  /** Max guesses before the mystery is lost (default LOOP_MAX_GUESSES). */
  maxGuesses?: number;
}

export function submitGuess(
  state: LoopPuzzleProgress,
  guess: LoopGuess,
  targetPlaceId: string,
  opts: SubmitGuessOptions = {},
): LoopPuzzleProgress {
  const maxGuesses = opts.maxGuesses ?? LOOP_MAX_GUESSES;
  const startClues = Math.min(LOOP_MAX_GUESSES, Math.max(1, opts.startClues ?? 1));
  if (state.status !== "playing") return state;
  if (state.guesses.length >= maxGuesses) return state;
  if (state.guesses.some((g) => g.placeId === guess.placeId)) return state;
  const prev = state.guesses[state.guesses.length - 1] ?? null;
  const next: LoopGuess = {
    ...guess,
    warmer: prev === null ? null : guess.distKm < prev.distKm,
  };
  const guesses = [...state.guesses, next];
  const won = next.placeId === targetPlaceId;
  return {
    guesses,
    status: won ? "won" : guesses.length >= maxGuesses ? "lost" : "playing",
    cluesRevealed: Math.min(LOOP_MAX_GUESSES, startClues + guesses.length),
  };
}
