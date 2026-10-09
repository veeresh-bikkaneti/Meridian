/**
 * age-profile/difficulty.ts — PURE difficulty parameters per band.
 *
 * Implements Phase 1 §3 (pin tolerance §3a, GeoDetective clues §3b, round
 * lengths §3c, other tunables §3d). All values are `[H]` hypotheses until
 * playtested — retune in bands.ts, not here.
 *
 * PURITY CONTRACT: no fetch, no storage, no clock. Pure functions of band
 * (and edition geometry for the tolerance). The clamps apply AFTER the
 * multiplier (Phase 1 §3a: "state never exceeds 160 km").
 */

import type { AgeBandId, AudioMode, LoopId } from "./types.ts";
import { AGE_BAND_IDS, AGE_BANDS, FULL_ACCESS_BAND, bandHasLoop } from "./bands.ts";

export type PinEdition = "state" | "country" | "globe";

// Mirrors src/game/radius.ts (SIDE_FRACTION, GLOBE_RADIUS_KM, RADIUS_LIMITS).
// Duplicated deliberately: the multiplier must apply BEFORE the clamp,
// while radiusKm() clamps the unscaled base. Kept adjacent so a contract
// change in radius.ts is easy to spot here.
const SIDE_FRACTION = 0.12;
const GLOBE_RADIUS_KM = 750;
const RADIUS_LIMITS = {
  state: { minKm: 25, maxKm: 160 },
  country: { minKm: 40, maxKm: 450 },
} as const;

/** Band multiplier on the pin-hit radius: ×1.5 / ×1.25 / ×1.0 (Phase 1 §3a). */
export function toleranceMultiplier(band: AgeBandId): number {
  return AGE_BANDS[band].difficulty.toleranceMultiplier;
}

/**
 * The hit radius for a band: base radius scaled by the band multiplier,
 * then clamped by edition (clamp AFTER scaling).
 */
export function pinToleranceKm(
  band: AgeBandId | null,
  edition: PinEdition,
  greaterSideKm: number,
): number {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  const mult = toleranceMultiplier(effective);
  if (edition === "globe") return GLOBE_RADIUS_KM * mult;
  const { minKm, maxKm } = RADIUS_LIMITS[edition];
  const scaled = greaterSideKm * SIDE_FRACTION * mult;
  return Math.min(maxKm, Math.max(minKm, scaled));
}

export interface GeoDetectiveConfig {
  /** Clues visible when the mystery is dealt. */
  startingClues: number;
  /** Extra clues per wrong guess. */
  cluePerWrongGuess: 1;
  maxClues: 5;
  guessCap: number;
}

/**
 * GeoDetective clue deal for a band (Phase 1 §3b), or null when the loop
 * is locked for the band (5-7). 8-10 starts with 3/5 clues and a cap of 6;
 * 11-13 starts near-blind (1) with a tighter cap of 5. Caps live in the
 * band table (bands.ts) — retune there, never here.
 */
export function geodetectiveConfig(band: AgeBandId | null): GeoDetectiveConfig | null {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  const d = AGE_BANDS[effective].difficulty;
  if (d.startingClues === null || d.guessCap === null) return null;
  return {
    startingClues: d.startingClues,
    cluePerWrongGuess: 1,
    maxClues: 5,
    guessCap: d.guessCap,
  };
}

/**
 * The largest guess cap any band's deal can legally produce (currently 6,
 * from the 8-10 deal). The loop store validator bounds `guesses.length` by
 * this — NOT by the shipped LOOP_MAX_GUESSES default — so a mystery
 * resolved on the 8-10 deal's 6th guess always persists instead of being
 * silently dropped. Derived from the band table: retuning a cap in
 * bands.ts automatically moves the validation bound.
 */
export function maxGuessCap(): number {
  return AGE_BAND_IDS.reduce((max, id) => {
    const cap = AGE_BANDS[id].difficulty.guessCap;
    return cap === null ? max : Math.max(max, cap);
  }, 0);
}

export interface RoundLengths {
  quizQuestions: number;
  terrainImages: number;
  capitalQuestions: number | null;
  /**
   * Pins per run (DATA-ONLY design target). Mirrors quizQuestions per
   * Game Designer ruling: the shipped quiz/main run is endless by design
   * and does NOT cap itself from this value — same "design target, not
   * consumed by endless run" pattern as quizQuestions above. A future
   * round-structured loop may consume it; nothing consumes it today.
   */
  pinsPerRun: number;
  duelSecondsPerTurn: number | null;
}

/**
 * Round lengths per band (Phase 1 §3c). Note: the shipped quiz is an
 * endless run with no fixed round length — `quizQuestions` and
 * `pinsPerRun` are the design targets exposed for future round-structured
 * loops; the endless run does NOT cap questions (see the integration
 * notes, not a refactor).
 */
export function roundLengths(band: AgeBandId | null): RoundLengths {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  const d = AGE_BANDS[effective].difficulty;
  return {
    quizQuestions: d.quizQuestions,
    terrainImages: d.terrainImages,
    capitalQuestions: d.capitalQuestions,
    pinsPerRun: d.pinsPerRun,
    duelSecondsPerTurn: d.duelSecondsPerTurn,
  };
}

/** Read-aloud mode for the band (Phase 1 §3d): 5-7 auto, 8-10 button, 11-13 off-but-available. */
export function audioMode(band: AgeBandId | null): AudioMode {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  return AGE_BANDS[effective].audioMode;
}

/** Map label density for the band (Phase 1 §1). */
export function mapLabelDensity(band: AgeBandId | null): "major" | "standard" | "full" {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  return AGE_BANDS[effective].mapLabels;
}

/** Distance feedback style for the band (Phase 1 §3d). */
export function distanceDisplayStyle(
  band: AgeBandId | null,
): "warmer-colder" | "rounded" | "exact" {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  return AGE_BANDS[effective].distanceDisplay;
}

/**
 * Loops available to the band, in suggested reveal order. Unset → all
 * loops (full-access default).
 */
export function loopsForBand(band: AgeBandId | null): LoopId[] {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  return [...AGE_BANDS[effective].loops];
}

/** True when the band may NOT play the loop (render the locked tile). */
export function isLoopLocked(band: AgeBandId | null, loop: LoopId): boolean {
  const effective: AgeBandId = band ?? FULL_ACCESS_BAND;
  return !bandHasLoop(AGE_BANDS[effective], loop);
}

/**
 * Scoring is IDENTICAL across bands by design (Phase 1 §3d): one economy,
 * one leaderboard semantic. Difficulty lives in tolerance and information,
 * never in points. This function exists to make that invariant explicit
 * and greppable: there is no band score multiplier, anywhere.
 */
export function bandScoreMultiplier(_band: AgeBandId | null): 1 {
  return 1;
}
