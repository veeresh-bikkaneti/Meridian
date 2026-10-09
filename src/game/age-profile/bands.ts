/**
 * age-profile/bands.ts — the three age bands as DATA.
 *
 * Per Phase 1 §1. Everything a band means lives in this table; pure
 * functions in rungs.ts / difficulty.ts read it. No behavior here, so the
 * design team can retune numbers without touching logic.
 */

import type { AgeBand, AgeBandId, LoopId } from "./types.ts";

export const AGE_BAND_IDS: AgeBandId[] = ["5-7", "8-10", "11-13"];

/** Full-access default for an unset profile (Phase 1 §4): never restrict by default. */
export const FULL_ACCESS_BAND: AgeBandId = "11-13";

/**
 * Band table, verbatim from Phase 1 §1. Descriptions are the <=140-char
 * parent-facing strings from the design — do not reword without the
 * design team, they are the agreed parent voice.
 */
export const AGE_BANDS: Record<AgeBandId, AgeBand> = {
  "5-7": {
    id: "5-7",
    label: "Little Explorer",
    ageMin: 5,
    ageMax: 7,
    description: "Short stories, spoken aloud. Big targets, picture games first.",
    whatChanges: "🔊 Stories read aloud · bigger tap targets · picture games first",
    rungCeiling: "hook",
    audioMode: "auto",
    loops: ["terrain-detective", "quiz", "passport-stamps"],
    difficulty: {
      toleranceMultiplier: 1.5,
      startingClues: null, // GeoDetective is locked for this band
      guessCap: null, // GeoDetective is locked for this band
      quizQuestions: 5,
      terrainImages: 4,
      capitalQuestions: null, // locked
      pinsPerRun: 5, // mirrors quizQuestions; data-only, endless run ignores
      duelSecondsPerTurn: null, // locked — no timers below 11-13
    },
    mapLabels: "major",
    distanceDisplay: "warmer-colder",
  },
  "8-10": {
    id: "8-10",
    label: "Trail Scout",
    ageMin: 8,
    ageMax: 10,
    description: "Longer stories to read, mysteries to solve, capitals to find.",
    whatChanges: "📖 Read or listen · mysteries unlock · more of the map",
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
      duelSecondsPerTurn: null, // locked — no timers below 11-13
    },
    mapLabels: "standard",
    distanceDisplay: "rounded",
  },
  "11-13": {
    id: "11-13",
    label: "GeoDetective",
    ageMin: 11,
    ageMax: 13,
    description: "The full game — every story, every mystery, head-to-head duels.",
    whatChanges: "🗺️ The whole game, exactly as today",
    rungCeiling: "wikidata",
    audioMode: "off", // button still available (Phase 1 §3d)
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
