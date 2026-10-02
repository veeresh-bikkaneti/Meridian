// Shared contract for the Daily Loop edition.
//
// Written by the build coordinator BEFORE the workers started, so Workers 2
// (game mechanics) and 3 (guess input) build against identical definitions.
// Do not change these shapes without coordinating all Loop workers.

export type Octant =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

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
