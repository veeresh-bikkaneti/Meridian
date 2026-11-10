/**
 * age-profile/bands.ts — the three age bands as DATA.
 *
 * Per Phase 1 §1. Everything a band means lives in this table; pure
 * functions in rungs.ts / difficulty.ts read it. No behavior here, so the
 * design team can retune numbers without touching logic.
 */

import type { AgeBand, AgeBandId, LoopId } from "./types.ts";

export const AGE_BAND_IDS: AgeBandId[] = ["7-10", "10-18", "18+"];

/** Full-access default for an unset profile: never restrict by default. Migration never writes 18+. */
export const FULL_ACCESS_BAND: AgeBandId = "10-18";

/**
 * Group table. Labels are the owner's words (2026-11-10). Description and
 * what-changes lines stay TODO(owner). Do not invent parent copy.
 * 7-10 numbers and loops are the previous 8-10 row (Duel stays off).
 * 10-18 keeps the previous 11-13 difficulty row. 18+ copies that row.
 */
export const AGE_BANDS: Record<AgeBandId, AgeBand> = {
  "7-10": {
    id: "7-10",
    label: "Ages 7-10",
    ageMin: 7,
    ageMax: 10,
    description: "TODO(owner): parent description for 7-10",
    whatChanges: "TODO(owner): what-changes line for 7-10",
    rungCeiling: "wikitext",
    audioMode: "button",
    loops: [
      "terrain-detective",
      "quiz",
      "passport-stamps",
      "geodetective",
      "capital-quest",
      "expedition-trails",
    ],
    difficulty: {
      toleranceMultiplier: 1.25,
      startingClues: 3,
      guessCap: 6,
      quizQuestions: 8,
      terrainImages: 6,
      capitalQuestions: 8,
      pinsPerRun: 8, // mirrors quizQuestions; data-only, endless run ignores
      duelSecondsPerTurn: null, // Duel is off for 7-10
    },
    mapLabels: "standard",
    distanceDisplay: "rounded",
  },
  "10-18": {
    id: "10-18",
    label: "Ages 10-18",
    ageMin: 10,
    ageMax: 18,
    description: "TODO(owner): parent description for 10-18",
    whatChanges: "TODO(owner): what-changes line for 10-18",
    rungCeiling: "wikidata",
    audioMode: "off",
    loops: [
      "terrain-detective",
      "quiz",
      "passport-stamps",
      "geodetective",
      "capital-quest",
      "expedition-trails",
      "duel",
    ],
    difficulty: {
      toleranceMultiplier: 1.0,
      startingClues: 1,
      guessCap: 5,
      quizQuestions: 12,
      terrainImages: 8,
      capitalQuestions: 12,
      pinsPerRun: 12, // mirrors quizQuestions; data-only, endless run ignores
      duelSecondsPerTurn: 60,
    },
    mapLabels: "full",
    distanceDisplay: "exact",
  },
  "18+": {
    id: "18+",
    label: "Ages 18+",
    ageMin: 18,
    ageMax: null,
    description: "TODO(owner): parent description for 18+",
    whatChanges: "TODO(owner): what-changes line for 18+",
    rungCeiling: "wikidata",
    audioMode: "off",
    loops: [
      "terrain-detective",
      "quiz",
      "passport-stamps",
      "geodetective",
      "capital-quest",
      "expedition-trails",
      "duel",
    ],
    // Same difficulty row as 10-18. Not yet tuned for adults.
    difficulty: {
      toleranceMultiplier: 1.0,
      startingClues: 1,
      guessCap: 5,
      quizQuestions: 12,
      terrainImages: 8,
      capitalQuestions: 12,
      pinsPerRun: 12, // mirrors quizQuestions; data-only, endless run ignores
      duelSecondsPerTurn: 60,
    },
    mapLabels: "full",
    distanceDisplay: "exact",
  },
};

/** All loops known to the band system, in suggested reveal order (Phase 1 §1). */
export const ALL_LOOPS: LoopId[] = [
  "terrain-detective",
  "quiz",
  "passport-stamps",
  "geodetective",
  "capital-quest",
  "expedition-trails",
  "duel",
];

export function getBand(id: AgeBandId): AgeBand {
  return AGE_BANDS[id];
}

/** True when the band may play the loop. */
export function bandHasLoop(band: AgeBand, loop: LoopId): boolean {
  return band.loops.includes(loop);
}
