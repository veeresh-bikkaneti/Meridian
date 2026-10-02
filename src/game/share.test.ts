import assert from "node:assert/strict";
import test from "node:test";
import { shareLoopText, shareText } from "./share.ts";
import type { LoopGuess } from "./loop/types.ts";

const now = new Date(Date.UTC(2026, 8, 28));

function loopGuess(over: Partial<LoopGuess> = {}): LoopGuess {
  return {
    name: "Somewhere",
    placeId: "geonames:1",
    distKm: 100,
    octant: "north",
    warmer: null,
    ...over,
  };
}

function endless(input: {
  regionName: string;
  totalScore: number;
  placesPlayed: number;
  averagePerPlace: number;
  bestStreak: number;
}) {
  return shareText({ ...input, dateKey: "2026-09-28", now });
}

test("share text is the v3 endless summary line", () => {
  assert.equal(
    endless({
      regionName: "Nebraska",
      totalScore: 12480,
      placesPlayed: 60,
      averagePerPlace: 208,
      bestStreak: 14,
    }),
    "meridian September 28\nhttps://veeresh-bikkaneti.github.io/Meridian/\n12,480 over 60 places · 208 avg/place · 🔥 14 best streak · Nebraska",
  );
  assert.equal(
    endless({
      regionName: "Globe",
      totalScore: 3150,
      placesPlayed: 20,
      averagePerPlace: 158,
      bestStreak: 5,
    }),
    "meridian September 28\nhttps://veeresh-bikkaneti.github.io/Meridian/\n3,150 over 20 places · 158 avg/place · 🔥 5 best streak · Globe",
  );
});

test("a short streak is not worth bragging about", () => {
  assert.equal(
    endless({
      regionName: "Nebraska",
      totalScore: 190,
      placesPlayed: 2,
      averagePerPlace: 95,
      bestStreak: 1,
    }),
    "meridian September 28\nhttps://veeresh-bikkaneti.github.io/Meridian/\n190 over 2 places · 95 avg/place · Nebraska",
  );
});

test("share text never spoils place names", () => {
  assert.equal(
    endless({
      regionName: "Nebraska",
      totalScore: 1400,
      placesPlayed: 14,
      averagePerPlace: 100,
      bestStreak: 3,
    }).includes("Capitol"),
    false,
  );
});

test("per-place scores render a Wordle-style emoji strip", () => {
  const text = shareText({
    regionName: "Nebraska",
    dateKey: "2026-09-28",
    totalScore: 940,
    placesPlayed: 6,
    averagePerPlace: 157,
    bestStreak: 2,
    scores: [350, 250, 150, 80, 30, 0],
    now,
  });
  assert.equal(
    text,
    "meridian September 28\nhttps://veeresh-bikkaneti.github.io/Meridian/\n🎯🏆🌟👏🙂💨\n940 over 6 places · 157 avg/place · 🔥 2 best streak · Nebraska",
  );
});

test("no strip without per-place scores", () => {
  const text = endless({
    regionName: "Nebraska",
    totalScore: 190,
    placesPlayed: 2,
    averagePerPlace: 95,
    bestStreak: 1,
  });
  assert.equal(text.includes("🎯"), false);
});

test("loop share text: three lines, spoiler-free, solved in 3", () => {
  const text = shareLoopText({
    guesses: [
      loopGuess({ name: "Springfield, Illinois, US", placeId: "geonames:1", distKm: 1234.5 }),
      loopGuess({ name: "Chicago, Illinois, US", placeId: "geonames:2", distKm: 800 }),
      loopGuess({ name: "Paris, Île-de-France, FR", placeId: "geonames:3", distKm: 0 }),
    ],
    status: "won",
    dateKey: "2026-10-02",
    now,
  });
  assert.equal(
    text,
    "meridian geodetective October 2\nhttps://veeresh-bikkaneti.github.io/Meridian/\n🟧🟧🟩⬜⬜ solved in 3",
  );
  // Spoiler-free: no names, no distances leak into the shared text.
  assert.equal(text.includes("Springfield"), false);
  assert.equal(text.includes("Paris"), false);
  assert.equal(text.includes("1234.5"), false);
  assert.equal(text.split("\n").length, 3);
});

test("loop share text: distance tiers and unused slots", () => {
  const text = shareLoopText({
    guesses: [
      loopGuess({ distKm: 499.9 }),
      loopGuess({ distKm: 500 }),
      loopGuess({ distKm: 1999.9 }),
      loopGuess({ distKm: 2000 }),
      loopGuess({ distKm: 9000 }),
    ],
    status: "lost",
    dateKey: "2026-10-02",
    now,
  });
  assert.equal(
    text,
    "meridian geodetective October 2\nhttps://veeresh-bikkaneti.github.io/Meridian/\n🟨🟧🟧🟥🟥 not solved",
  );
});

test("loop share text: cross-year date label", () => {
  const text = shareLoopText({
    guesses: [loopGuess({ distKm: 100 })],
    status: "lost",
    dateKey: "2025-10-02",
    now,
  });
  assert.ok(text.startsWith("meridian geodetective October 2, 2025\n"));
});

test("loop share text: winning guess is green even with residual distance", () => {
  // The index coords and the clue target can differ slightly; the final
  // guess of a won day is the correct one regardless of distKm.
  const text = shareLoopText({
    guesses: [loopGuess({ distKm: 12.3 })],
    status: "won",
    dateKey: "2026-10-02",
    now,
  });
  assert.ok(text.endsWith("🟩⬜⬜⬜⬜ solved in 1"));
});
