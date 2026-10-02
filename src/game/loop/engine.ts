import { distanceKm, initialBearing, octantOf } from "../geo.ts";
import {
  LOOP_MAX_GUESSES,
  type LoopDayState,
  type LoopGuess,
  type Octant,
} from "./types.ts";

/**
 * The GeoDetective's 5-guess state machine. Pure functions: given a day
 * state and a guess, produce the next day state. The screen persists the
 * result via the loop store.
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
  return octantOf(initialBearing([lon1, lat1], [lon2, lat2]));
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
 * target (from the clue file): haversine distance, octant toward the
 * target, and warmer/colder against the previous guess (null for the
 * first guess).
 */
export function buildLoopGuess(
  pick: LoopGuessPick,
  target: { lon: number; lat: number },
  prevGuess: LoopGuess | null,
): LoopGuess {
  const distKm = distanceKm([pick.lon, pick.lat], [target.lon, target.lat]);
  return {
    name: pick.name,
    placeId: pick.placeId,
    distKm,
    octant: octantFor(pick.lon, pick.lat, target.lon, target.lat),
    warmer: prevGuess === null ? null : distKm < prevGuess.distKm,
  };
}

/**
 * Append a guess to the day state. Win when the guess's placeId matches
 * the clue file's target placeId; loss when all 5 guesses are used.
 * `cluesRevealed` tracks guesses: min(5, 1 + guesses.length) — one new
 * clue card per guess. Submitting on a finished day, or past the guess
 * cap, returns the state unchanged (warmer is re-derived from the
 * previous guess so the engine — not the input — is authoritative).
 */
export function submitGuess(
  state: LoopDayState,
  guess: LoopGuess,
  targetPlaceId: string,
): LoopDayState {
  if (state.status !== "playing") return state;
  if (state.guesses.length >= LOOP_MAX_GUESSES) return state;
  const prev = state.guesses[state.guesses.length - 1] ?? null;
  const next: LoopGuess = {
    ...guess,
    warmer: prev === null ? null : guess.distKm < prev.distKm,
  };
  const guesses = [...state.guesses, next];
  const won = next.placeId === targetPlaceId;
  return {
    guesses,
    status: won ? "won" : guesses.length >= LOOP_MAX_GUESSES ? "lost" : "playing",
    cluesRevealed: Math.min(LOOP_MAX_GUESSES, 1 + guesses.length),
  };
}
