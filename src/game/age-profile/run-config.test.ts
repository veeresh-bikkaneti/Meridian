import assert from "node:assert/strict";
import test from "node:test";
import {
  getBandConfig,
  isBandRunConfig,
  hintButtonState,
  canUseHint,
  mascotOffersHint,
  type BandRunConfig,
  type HintPolicy,
} from "./run-config.ts";
import { geodetectiveConfig } from "./difficulty.ts";
import { AGE_BANDS } from "./bands.ts";

/**
 * Follow-up Item A regression gate: getBandConfig(null) (unset profile)
 * deep-equals TODAY's production numbers — the "11-13" full-access band —
 * byte-for-byte, per loop. If the band table retunes, these tests pin the
 * production contract: any intentional change must update the gate.
 */
const PRODUCTION_CONFIG: BandRunConfig = {
  band: "11-13",
  quizQs: 12,
  terrainImages: 8,
  capitalQs: 12,
  duelSeconds: 60,
  hintPolicy: "none",
  pinTolerance: 1.0,
  startingClues: 1,
  guessCap: 5,
};

test("quiz: unset config == today's production numbers (12 questions)", () => {
  const config = getBandConfig(null);
  assert.equal(config.quizQs, 12);
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("terrain-detective: unset config == today's production numbers (8 images)", () => {
  const config = getBandConfig(null);
  assert.equal(config.terrainImages, 8);
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("capital-quest: unset config == today's production numbers (12 questions)", () => {
  const config = getBandConfig(null);
  assert.equal(config.capitalQs, 12);
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("duel: unset config == today's production numbers (60s turns)", () => {
  const config = getBandConfig(null);
  assert.equal(config.duelSeconds, 60);
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("geodetective: unset config == today's production deal (1 clue, cap 5)", () => {
  const config = getBandConfig(null);
  assert.equal(config.startingClues, 1);
  assert.equal(config.guessCap, 5);
  // Consistent with the shipped geodetectiveConfig deal for the unset band.
  const deal = geodetectiveConfig(null);
  assert.ok(deal !== null);
  assert.equal(config.startingClues, deal.startingClues);
  assert.equal(config.guessCap, deal.guessCap);
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("expedition-trails: unset config == full-access production numbers", () => {
  const config = getBandConfig(null);
  assert.ok(AGE_BANDS["11-13"].loops.includes("expedition-trails"));
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

test("passport-stamps: unset config == full-access production numbers", () => {
  const config = getBandConfig(null);
  assert.ok(AGE_BANDS["11-13"].loops.includes("passport-stamps"));
  assert.deepEqual(config, PRODUCTION_CONFIG);
});

// --- per-band values ---

test("band values: 5-7 / 8-10 short rounds, free/limited hints", () => {
  assert.deepEqual(getBandConfig("5-7"), {
    band: "5-7",
    quizQs: 5,
    terrainImages: 4,
    capitalQs: null,
    duelSeconds: null,
    hintPolicy: "free",
    pinTolerance: 1.5,
    startingClues: null,
    guessCap: null,
  });
  assert.deepEqual(getBandConfig("8-10"), {
    band: "8-10",
    quizQs: 8,
    terrainImages: 6,
    capitalQs: 8,
    duelSeconds: null,
    hintPolicy: "one-per-round",
    pinTolerance: 1.25,
    startingClues: 3,
    guessCap: 6,
  });
  assert.deepEqual(getBandConfig("11-13"), PRODUCTION_CONFIG);
});

test("null band and explicit 11-13 agree (unset == full-access default)", () => {
  assert.deepEqual(getBandConfig(null), getBandConfig("11-13"));
});

// --- hint wiring ---

test("hint button states per policy", () => {
  // 5-7: always free, never disables.
  assert.equal(hintButtonState("free", 0), "enabled");
  assert.equal(hintButtonState("free", 9), "enabled");
  // 8-10: one hint per round, then disabled.
  assert.equal(hintButtonState("one-per-round", 0), "enabled");
  assert.equal(hintButtonState("one-per-round", 1), "disabled-used");
  // 11-13: no button at all.
  assert.equal(hintButtonState("none", 0), "hidden");
  assert.equal(hintButtonState("none", 1), "hidden");
});

test("canUseHint gates on the button state", () => {
  assert.equal(canUseHint("free", 3), true);
  assert.equal(canUseHint("one-per-round", 0), true);
  assert.equal(canUseHint("one-per-round", 1), false);
  assert.equal(canUseHint("none", 0), false);
});

test("mascot auto-offer: 5-7 only, after 2 misses, opt-in tap", () => {
  const policies: HintPolicy[] = ["free", "one-per-round", "none"];
  for (const policy of policies) {
    assert.equal(mascotOffersHint(policy, 0), false, `${policy} @0`);
    assert.equal(mascotOffersHint(policy, 1), false, `${policy} @1`);
  }
  // Only the free policy (5-7) offers, starting at 2 misses.
  assert.equal(mascotOffersHint("free", 2), true);
  assert.equal(mascotOffersHint("free", 5), true);
  assert.equal(mascotOffersHint("one-per-round", 2), false);
  assert.equal(mascotOffersHint("none", 2), false);
});

// --- snapshot guard ---

test("isBandRunConfig validates the snapshot shape", () => {
  assert.equal(isBandRunConfig(getBandConfig(null)), true);
  assert.equal(isBandRunConfig(null), false);
  assert.equal(isBandRunConfig({}), false);
  assert.equal(
    isBandRunConfig({ ...getBandConfig(null), hintPolicy: "sometimes" }),
    false,
  );
  assert.equal(isBandRunConfig({ ...getBandConfig(null), quizQs: "12" }), false);
  assert.equal(isBandRunConfig({ ...getBandConfig(null), band: "9-99" }), false);
});

test("snapshot records the deal-time band (#113 BLOCK 1: badge award must use this, never the live band)", () => {
  assert.equal(getBandConfig("5-7").band, "5-7");
  assert.equal(getBandConfig("8-10").band, "8-10");
  assert.equal(getBandConfig("11-13").band, "11-13");
  assert.equal(getBandConfig(null).band, "11-13"); // unset → full-access band
});
