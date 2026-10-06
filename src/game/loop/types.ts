// Shared contract for the GeoDetective edition.
//
// Unlimited era (v2): mysteries are dealt from a shuffled deck persisted
// under `meridian.loop.v2` — no UTC-day keying. The daily-era v1 archive
// (`meridian.loop.v1`) is never read, written, or deleted; it sits inert.
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

/**
 * The guess-progress half of a mystery: the shape `submitGuess` reads and
 * writes. The engine stays day- and deck-agnostic — the screen owns the
 * puzzle identity fields below.
 */
export interface LoopPuzzleProgress {
  guesses: LoopGuess[];
  status: LoopStatus;
  /** Number of clue cards visible: 1..5. */
  cluesRevealed: number;
}

/** One mystery in the unlimited deck model. */
export interface LoopPuzzleState extends LoopPuzzleProgress {
  /** Clue-file index (public/loop/clues/{index}.json). */
  index: number;
  /** Deck cycle this mystery was dealt from (1-based). */
  cycle: number;
  /** UTC "YYYY-MM-DD" of completion; null while playing. The share text
   * uses this date, so a resumed-then-finished-later mystery shares its
   * completion date, not its deal date. */
  completedAt: string | null;
  /** The streak value before a loss reset it; null unless status is lost.
   * Lets the loss reveal name the ended streak even after a reload. */
  streakEndedAt: number | null;
}

/** The shuffled deck: indexes in deal order, head = next to deal. */
export interface LoopDeckState {
  /** Clue-file indexes remaining this cycle, in shuffled deal order. */
  deck: number[];
  /** 1-based cycle number. Increments each time the deck is rebuilt. */
  cycle: number;
  /** Stat: mysteries completed in the current cycle. */
  cycleCompleted: number;
}

/** The whole unlimited-mode blob, persisted as one JSON value. */
export interface LoopUnlimitedStore {
  deck: LoopDeckState;
  /**
   * The open mystery. Set when a mystery is dealt; cleared only after
   * "Next mystery" deals the next one. An abandoned in-progress mystery
   * stays here so the screen resumes it instead of popping the deck again.
   */
  current: LoopPuzzleState | null;
  /** Consecutive solves. +1 on win, reset to 0 on loss, nothing else. */
  streak: number;
  /** Lifetime totals for the edition card / case counter. */
  totals: { solved: number; lost: number };
}

/** Unlimited-era storage key. The daily-era `meridian.loop.v1` archive is
 * never read, written, or deleted. */
export const LOOP_STORAGE_KEY_V2 = "meridian.loop.v2";
/**
 * Separate key in the same namespace: whether the GeoDetective was the
 * open screen when the tab closed/reloaded. Lets a mid-game reload reopen
 * the loop screen (whose mystery persists under `meridian.loop.v2`)
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
