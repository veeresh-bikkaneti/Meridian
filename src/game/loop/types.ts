// Shared contract for the GeoDetective edition.
//
// Written by the build coordinator BEFORE the workers started, so Workers 2
// (game mechanics) and 3 (guess input) build against identical definitions.
// Do not change these shapes without coordinating all Loop workers.
import type { Octant } from "../geo.ts";
export type { Octant };

export interface LoopGuess {
  /** Display name as picked, e.g. "Springfield, Illinois, US". */
  name: string;
  /** GeoNames id, e.g. "geonames:1275339". */
  placeId: string;
  /** Haversine distance from the guess to the target, in km. */
  distKm: number;
  /** Bearing from the guess toward the target, snapped to 8 winds. */
  octant: Octant;
  /** Warmer than the previous guess; null for the first guess. */
  warmer: boolean | null;
  /**
   * Guessed place coordinates, for the map's deduction surface (rings).
   * Present on every guess made through the map; absent on pre-map days
   * (the validator tolerates the absence — those days simply draw no ring).
   */
  lon?: number;
  lat?: number;
}

export type LoopStatus = "playing" | "won" | "lost";

export interface LoopDayState {
  guesses: LoopGuess[];
  status: LoopStatus;
  /** Number of clue cards visible: 1..5. */
  cluesRevealed: number;
}

/** Keyed by UTC dateKey ("YYYY-MM-DD"). */
export type LoopStore = Record<string, LoopDayState>;

export const LOOP_STORAGE_KEY = "meridian.loop.v1";
/**
 * Separate key in the same namespace: whether the GeoDetective was the
 * open screen when the tab closed/reloaded. Lets a mid-game reload reopen
 * the loop screen (whose day state persists under `meridian.loop.v1`)
 * instead of dropping the player back at the editions menu.
 */
export const LOOP_OPEN_KEY = "meridian.loop.open";
export const LOOP_MAX_GUESSES = 5;

/** Shape of public/loop/clues/{index}.json. NEVER contains the place name or region tags. */
export interface LoopClueFile {
  v: 1;
  placeId: string;
  target: { lon: number; lat: number };
  /** Positional: [geography, climate, history, hook, giveaway]. */
  clues: [string, string, string, string, string];
  source: { label: string; href: string };
}

/** Shape of public/loop/manifest.json. */
export interface LoopManifest {
  v: 1;
  size: number;
  generatedAt: string;
}

/** Entries of public/loop/names.json (lazy-loaded guess index). */
export interface LoopNameEntry {
  /** Normalized name: lowercase, NFD diacritics stripped, punctuation removed. */
  n: string;
  /** GeoNames id. */
  id: string;
  lon: number;
  lat: number;
  /** "State, Country" display string for disambiguation. */
  r: string;
  /** Population, for ranking suggestions. */
  p: number;
}
