import assert from "node:assert/strict";
import test from "node:test";
import {
  DIFFICULTY_TIERS,
  PLACE_SCORE_CAP,
  REGION_BONUS,
  SCORING_VERSION,
  comboForStreak,
  difficultyChip,
  difficultyTier,
  formatBreakdown,
  regionBonusFor,
  scorePlace,
} from "./scoring.ts";

const PARIS: [number, number] = [2.3522, 48.8566];
const NEAR_ORLEANS: [number, number] = [2.3522, 47.7766]; // ~120 km south of Paris, still France
const BERLIN: [number, number] = [13.405, 52.52];
const CHIMNEY_ROCK: [number, number] = [-103.35, 41.7]; // Nebraska
const LINCOLN_NE: [number, number] = [-96.68, 40.81]; // Nebraska
const KANSAS_PIN: [number, number] = [-100, 39]; // Kansas, outside Nebraska
const DENVER: [number, number] = [-104.99, 39.74]; // outside Nebraska

test("SCORING_VERSION is 3", () => {
  assert.equal(SCORING_VERSION, 3);
});

test("every difficulty tier has the specified multiplier", () => {
  assert.equal(difficultyTier(1).multiplier, 1);
  assert.equal(difficultyTier(2).multiplier, 1.25);
  assert.equal(difficultyTier(3).multiplier, 1.5);
  assert.equal(difficultyTier(4).multiplier, 2);
  assert.equal(difficultyTier(5).multiplier, 2.5);
  assert.equal(Object.keys(DIFFICULTY_TIERS).length, 5);
});

test("difficulty chips are MapTap-style", () => {
  assert.equal(difficultyChip(1), "Easy · 1x");
  assert.equal(difficultyChip(2), "Moderate · 1.25x");
  assert.equal(difficultyChip(3), "Challenging · 1.5x");
  assert.equal(difficultyChip(4), "Hard · 2x");
  assert.equal(difficultyChip(5), "Extreme · 2.5x");
});

test("combo grows 5% per streak hit and caps at 20", () => {
  assert.equal(comboForStreak(0), 1);
  assert.equal(comboForStreak(1), 1.05);
  assert.equal(comboForStreak(6), 1.3);
  assert.equal(comboForStreak(19), 1.95);
  assert.equal(comboForStreak(20), 2);
  assert.equal(comboForStreak(21), 2);
  assert.equal(comboForStreak(200), 2);
});

test("worked example: 120 km, diff 4, globe, 6th straight hit, right country = 267", () => {
  const scored = scorePlace({
    distanceKm: 120,
    ring: "world",
    difficulty: 4,
    streakBefore: 5,
    edition: "globe",
    regionId: "globe",
    pin: NEAR_ORLEANS,
    target: PARIS,
  });
  assert.equal(scored.base, 97);
  assert.equal(scored.diffMult, 2);
  assert.equal(scored.streak, 6);
  assert.equal(scored.combo, 1.3);
  assert.equal(scored.regionBonus, 15);
  assert.equal(scored.regionBonusLabel, "country");
  assert.equal(scored.score, 267);
  assert.equal(formatBreakdown(scored), "97 × 2.0 × 1.3 + 15 country bonus = 267");
});

test("same place, first hit after a miss, wrong country: no bonus, no streak", () => {
  const scored = scorePlace({
    distanceKm: 120,
    ring: "world",
    difficulty: 4,
    streakBefore: 0,
    edition: "globe",
    regionId: "globe",
    pin: BERLIN,
    target: PARIS,
  });
  assert.equal(scored.streak, 1);
  assert.equal(scored.combo, 1.05);
  assert.equal(scored.regionBonus, 0);
  assert.equal(scored.regionBonusLabel, null);
  // 97 × 2.0 × 1.05 = 203.7 → 204
  assert.equal(scored.score, 204);
  assert.equal(formatBreakdown(scored), "97 × 2.0 × 1.05 = 204");
});

test("globe region bonus requires the same country on both sides", () => {
  const on = regionBonusFor({ edition: "globe", regionId: "globe", pin: NEAR_ORLEANS, target: PARIS });
  assert.deepEqual(on, { bonus: REGION_BONUS, label: "country" });
  const off = regionBonusFor({ edition: "globe", regionId: "globe", pin: BERLIN, target: PARIS });
  assert.deepEqual(off, { bonus: 0, label: null });
});

test("country edition with admin1 data awards the bonus per state", () => {
  const sameState = regionBonusFor({
    edition: "country",
    regionId: "united-states",
    pin: LINCOLN_NE,
    target: CHIMNEY_ROCK,
  });
  assert.deepEqual(sameState, { bonus: REGION_BONUS, label: "state" });
  const otherState = regionBonusFor({
    edition: "country",
    regionId: "united-states",
    pin: KANSAS_PIN,
    target: CHIMNEY_ROCK,
  });
  assert.deepEqual(otherState, { bonus: 0, label: null });
});

test("country edition without admin1 data falls back to the country match", () => {
  const on = regionBonusFor({
    edition: "country",
    regionId: "france",
    pin: NEAR_ORLEANS,
    target: PARIS,
  });
  assert.deepEqual(on, { bonus: REGION_BONUS, label: "country" });
  const off = regionBonusFor({
    edition: "country",
    regionId: "france",
    pin: BERLIN,
    target: PARIS,
  });
  assert.deepEqual(off, { bonus: 0, label: null });
});

test("state edition awards the bonus when the pin stays inside the played state", () => {
  const inside = regionBonusFor({
    edition: "state",
    regionId: "nebraska",
    pin: LINCOLN_NE,
    target: CHIMNEY_ROCK,
  });
  assert.deepEqual(inside, { bonus: REGION_BONUS, label: "state" });
  const outside = regionBonusFor({
    edition: "state",
    regionId: "nebraska",
    pin: DENVER,
    target: CHIMNEY_ROCK,
  });
  assert.deepEqual(outside, { bonus: 0, label: null });
});

test("place score caps at 400 before the region bonus", () => {
  const scored = scorePlace({
    distanceKm: 0,
    ring: "world",
    difficulty: 5,
    streakBefore: 19,
    edition: "globe",
    regionId: "globe",
    pin: NEAR_ORLEANS,
    target: PARIS,
  });
  // 100 × 2.5 × 2.0 = 500 → capped to 400, then +15
  assert.equal(scored.score, PLACE_SCORE_CAP + REGION_BONUS);
  assert.equal(scored.score, 415);
});

test("cap applies without a bonus too", () => {
  const scored = scorePlace({
    distanceKm: 0,
    ring: "world",
    difficulty: 5,
    streakBefore: 19,
    edition: "globe",
    regionId: "globe",
    pin: BERLIN,
    target: PARIS,
  });
  assert.equal(scored.score, PLACE_SCORE_CAP);
});

test("negative or fractional streakBefore is sanitized", () => {
  const scored = scorePlace({
    distanceKm: 120,
    ring: "world",
    difficulty: 1,
    streakBefore: -3,
    edition: "globe",
    regionId: "globe",
    pin: BERLIN,
    target: PARIS,
  });
  assert.equal(scored.streak, 1);
  assert.equal(scored.combo, 1.05);
});
