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

test("tolerance multipliers: x1.5 / x1.25 / x1.0", () => {
  assert.equal(toleranceMultiplier("5-7"), 1.5);
  assert.equal(toleranceMultiplier("8-10"), 1.25);
  assert.equal(toleranceMultiplier("11-13"), 1.0);
});

test("pin tolerance matches the Phase 1 §3a table", () => {
  // Globe: 750 x mult (8-10 = 937.5 exactly; the Phase 1 table rounds to 940 for display)
  assert.equal(pinToleranceKm("5-7", "globe", 0), 1125);
  assert.equal(pinToleranceKm("8-10", "globe", 0), 937.5);
  assert.equal(pinToleranceKm("11-13", "globe", 0), 750);
  // State (800 km side -> base 96): 144 / 120 / 96
  assert.equal(pinToleranceKm("5-7", "state", 800), 144);
  assert.equal(pinToleranceKm("8-10", "state", 800), 120);
  assert.equal(pinToleranceKm("11-13", "state", 800), 96);
  // Country (1000 km side -> base 120): 180 / 150 / 120
  assert.equal(pinToleranceKm("5-7", "country", 1000), 180);
  assert.equal(pinToleranceKm("8-10", "country", 1000), 150);
  assert.equal(pinToleranceKm("11-13", "country", 1000), 120);
});

test("clamps apply AFTER the multiplier (no degenerate whole-state hits)", () => {
  // 2000 km side x 1.5 = 360 -> clamped to the 160 km state max
  assert.equal(pinToleranceKm("5-7", "state", 2000), 160);
  assert.equal(pinToleranceKm("5-7", "country", 5000), 450);
  // Minimums still hold for tiny regions
  assert.equal(pinToleranceKm("11-13", "state", 100), 25);
  assert.equal(pinToleranceKm("11-13", "country", 200), 40);
});

test("geodetective clues per Phase 1 §3b", () => {
  assert.equal(geodetectiveConfig("5-7"), null); // locked
  assert.deepEqual(geodetectiveConfig("8-10"), {
    startingClues: 3,
    cluePerWrongGuess: 1,
    maxClues: 5,
    guessCap: 6,
  });
  assert.deepEqual(geodetectiveConfig("11-13"), {
    startingClues: 1,
    cluePerWrongGuess: 1,
    maxClues: 5,
    guessCap: 5,
  });
  assert.notEqual(geodetectiveConfig(null), null); // unset → full access
});

test("locked-band fail-safe: fallback is the easiest unlocked deal, never the hardest", () => {
  // LoopScreen's SAFE_DEAL_FALLBACK derives from geodetectiveConfig("8-10"):
  // a locked band (5-7, reachable via mid-run change) must never be dealt
  // the near-blind 11-13 config.
  const fallback = geodetectiveConfig("8-10");
  const hardest = geodetectiveConfig("11-13");
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

test("maxGuessCap: derived from the band table — the 8-10 deal sets the validator bound", () => {
  assert.equal(maxGuessCap(), 6);
  for (const id of AGE_BAND_IDS) {
    const cfg = geodetectiveConfig(id);
    if (cfg) assert.ok(cfg.guessCap <= maxGuessCap(), `${id}: no deal may exceed maxGuessCap`);
  }
});

test("round lengths per Phase 1 §3c", () => {
  const young = roundLengths("5-7");
  assert.equal(young.quizQuestions, 5);
  assert.equal(young.terrainImages, 4);
  assert.equal(young.capitalQuestions, null);
  assert.equal(young.duelSecondsPerTurn, null);
  const mid = roundLengths("8-10");
  assert.equal(mid.quizQuestions, 8);
  assert.equal(mid.terrainImages, 6);
  assert.equal(mid.capitalQuestions, 8);
  assert.equal(mid.duelSecondsPerTurn, null);
  const old = roundLengths("11-13");
  assert.equal(old.quizQuestions, 12);
  assert.equal(old.terrainImages, 8);
  assert.equal(old.capitalQuestions, 12);
  assert.equal(old.duelSecondsPerTurn, 60);
});

test("audio modes: auto / button / off", () => {
  assert.equal(audioMode("5-7"), "auto");
  assert.equal(audioMode("8-10"), "button");
  assert.equal(audioMode("11-13"), "off");
});

test("map labels + distance display degrade reading load for young bands", () => {
  assert.equal(mapLabelDensity("5-7"), "major");
  assert.equal(mapLabelDensity("8-10"), "standard");
  assert.equal(mapLabelDensity("11-13"), "full");
  assert.equal(distanceDisplayStyle("5-7"), "warmer-colder");
  assert.equal(distanceDisplayStyle("8-10"), "rounded");
  assert.equal(distanceDisplayStyle("11-13"), "exact");
});

test("loop availability: 5-7 locked out of reading-heavy loops; unset sees all", () => {
  assert.ok(isLoopLocked("5-7", "geodetective"));
  assert.ok(isLoopLocked("5-7", "capital-quest"));
  assert.ok(isLoopLocked("5-7", "expedition-trails"));
  assert.ok(isLoopLocked("5-7", "duel"));
  assert.ok(!isLoopLocked("5-7", "terrain-detective"));
  assert.ok(!isLoopLocked("5-7", "quiz"));
  assert.ok(!isLoopLocked("5-7", "passport-stamps"));
  assert.ok(!isLoopLocked("8-10", "geodetective"));
  assert.ok(isLoopLocked("8-10", "duel"));
  assert.deepEqual(loopsForBand("11-13").length, 7);
  assert.deepEqual(loopsForBand(null).length, 7); // unset → full access
});

test("scoring is identical across bands — the invariant is explicit", () => {
  assert.equal(bandScoreMultiplier("5-7"), 1);
  assert.equal(bandScoreMultiplier("8-10"), 1);
  assert.equal(bandScoreMultiplier("11-13"), 1);
  assert.equal(bandScoreMultiplier(null), 1);
});
