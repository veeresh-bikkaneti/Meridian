import assert from "node:assert/strict";
import test from "node:test";
import {
  toleranceMultiplier,
  pinToleranceKm,
  geodetectiveConfig,
  maxGuessCap,
  roundLengths,
  audioMode,
  mapLabelDensity,
  distanceDisplayStyle,
  loopsForBand,
  isLoopLocked,
  bandScoreMultiplier,
} from "./difficulty.ts";
import { AGE_BAND_IDS } from "./bands.ts";

test("tolerance multipliers: 7-10 is x1.25; 10-18 and 18+ keep x1.0", () => {
  assert.equal(toleranceMultiplier("7-10"), 1.25);
  assert.equal(toleranceMultiplier("10-18"), 1.0);
  assert.equal(toleranceMultiplier("18+"), 1.0);
});

test("pin tolerance matches the Phase 1 §3a table", () => {
  // Globe: 750 x mult (7-10 = 937.5 exactly; the Phase 1 table rounds to 940 for display)
  assert.equal(pinToleranceKm("7-10", "globe", 0), 937.5);
  assert.equal(pinToleranceKm("10-18", "globe", 0), 750);
  assert.equal(pinToleranceKm("18+", "globe", 0), 750);
  // State (800 km side -> base 96): 120 / 96 / 96
  assert.equal(pinToleranceKm("7-10", "state", 800), 120);
  assert.equal(pinToleranceKm("10-18", "state", 800), 96);
  assert.equal(pinToleranceKm("18+", "state", 800), 96);
  // Country (1000 km side -> base 120): 150 / 120 / 120
  assert.equal(pinToleranceKm("7-10", "country", 1000), 150);
  assert.equal(pinToleranceKm("10-18", "country", 1000), 120);
  assert.equal(pinToleranceKm("18+", "country", 1000), 120);
});

test("clamps apply AFTER the multiplier (no degenerate whole-state hits)", () => {
  // 2000 km side x 1.25 = 300 -> clamped to the 160 km state max
  assert.equal(pinToleranceKm("7-10", "state", 2000), 160);
  assert.equal(pinToleranceKm("7-10", "country", 5000), 450);
  // Minimums still hold for tiny regions
  assert.equal(pinToleranceKm("10-18", "state", 100), 25);
  assert.equal(pinToleranceKm("10-18", "country", 200), 40);
});

test("geodetective clues per Phase 1 §3b", () => {
  assert.deepEqual(geodetectiveConfig("7-10"), {
    startingClues: 3,
    cluePerWrongGuess: 1,
    maxClues: 5,
    guessCap: 6,
  });
  assert.deepEqual(geodetectiveConfig("10-18"), {
    startingClues: 1,
    cluePerWrongGuess: 1,
    maxClues: 5,
    guessCap: 5,
  });
  assert.deepEqual(geodetectiveConfig("18+"), geodetectiveConfig("10-18"));
  assert.notEqual(geodetectiveConfig(null), null); // unset → full access
});

test("locked-band fail-safe: fallback is the easiest unlocked deal, never the hardest", () => {
  // LoopScreen's SAFE_DEAL_FALLBACK derives from geodetectiveConfig("7-10"):
  // the easier unlocked deal, never the near-blind 10-18 config.
  const fallback = geodetectiveConfig("7-10");
  const hardest = geodetectiveConfig("10-18");
  assert.ok(fallback !== null && hardest !== null);
  assert.ok(
    fallback.startingClues > hardest.startingClues,
    "fallback starts with more clues than the hardest deal",
  );
  assert.ok(
    fallback.guessCap >= hardest.guessCap,
    "fallback allows at least as many guesses as the hardest deal",
  );
});

test("maxGuessCap: derived from the band table — the 7-10 deal sets the validator bound", () => {
  assert.equal(maxGuessCap(), 6);
  for (const id of AGE_BAND_IDS) {
    const cfg = geodetectiveConfig(id);
    if (cfg) assert.ok(cfg.guessCap <= maxGuessCap(), `${id}: no deal may exceed maxGuessCap`);
  }
});

test("round lengths per Phase 1 §3c", () => {
  const young = roundLengths("7-10");
  assert.equal(young.quizQuestions, 8);
  assert.equal(young.terrainImages, 6);
  assert.equal(young.capitalQuestions, 8);
  assert.equal(young.pinsPerRun, 8); // data-only: mirrors quizQuestions
  assert.equal(young.duelSecondsPerTurn, null);
  const mid = roundLengths("10-18");
  assert.equal(mid.quizQuestions, 12);
  assert.equal(mid.terrainImages, 8);
  assert.equal(mid.capitalQuestions, 12);
  assert.equal(mid.pinsPerRun, 12); // data-only: mirrors quizQuestions
  assert.equal(mid.duelSecondsPerTurn, 60);
  assert.deepEqual(roundLengths("18+"), mid);
});

test("audio modes: 7-10 button, 10-18 and 18+ off", () => {
  assert.equal(audioMode("7-10"), "button");
  assert.equal(audioMode("10-18"), "off");
  assert.equal(audioMode("18+"), "off");
});

test("map labels + distance display degrade reading load for young bands", () => {
  assert.equal(mapLabelDensity("7-10"), "standard");
  assert.equal(mapLabelDensity("10-18"), "full");
  assert.equal(mapLabelDensity("18+"), "full");
  assert.equal(distanceDisplayStyle("7-10"), "rounded");
  assert.equal(distanceDisplayStyle("10-18"), "exact");
  assert.equal(distanceDisplayStyle("18+"), "exact");
});

test("loop availability: 7-10 has the 8-10 list and locks Duel; unset sees all", () => {
  assert.ok(!isLoopLocked("7-10", "geodetective"));
  assert.ok(!isLoopLocked("7-10", "capital-quest"));
  assert.ok(!isLoopLocked("7-10", "expedition-trails"));
  assert.ok(isLoopLocked("7-10", "duel"));
  assert.ok(!isLoopLocked("7-10", "terrain-detective"));
  assert.ok(!isLoopLocked("7-10", "quiz"));
  assert.ok(!isLoopLocked("7-10", "passport-stamps"));
  assert.equal(loopsForBand("7-10").includes("duel"), false);
  assert.equal(loopsForBand("10-18").length, 7);
  assert.equal(loopsForBand("18+").length, 7);
  assert.equal(loopsForBand(null).length, 7); // unset → full access
});

test("scoring is identical across bands — the invariant is explicit", () => {
  assert.equal(bandScoreMultiplier("7-10"), 1);
  assert.equal(bandScoreMultiplier("10-18"), 1);
  assert.equal(bandScoreMultiplier("18+"), 1);
  assert.equal(bandScoreMultiplier(null), 1);
});
