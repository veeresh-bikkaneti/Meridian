import assert from "node:assert/strict";
import test from "node:test";
import { shareText, shareLoopText } from "./share.ts";
import type { LoopGuess } from "./loop/types.ts";

const now = new Date(Date.UTC(2026, 8, 28));

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

test("geodetective share appends the streak line when streak > 0", () => {
  const guesses: LoopGuess[] = [
    { name: "Kota, India", placeId: "geonames:1266049", distKm: 2073, octant: "south", warmer: null },
    { name: "Colombo, Sri Lanka", placeId: "geonames:1248991", distKm: 0, octant: "north", warmer: true },
  ];
  const text = shareLoopText({
    guesses,
    status: "won",
    dateKey: "2026-10-06",
    now,
    streak: 7,
  });
  assert.equal(
    text,
    "meridian geodetective October 6\nhttps://veeresh-bikkaneti.github.io/Meridian/\n🟥🟩⬜⬜⬜ solved in 2\n🔥 7",
  );
});

test("geodetective share hides the streak line when streak is 0 or unset", () => {
  const guesses: LoopGuess[] = [
    { name: "Kota, India", placeId: "geonames:1266049", distKm: 2073, octant: "south", warmer: null },
  ];
  const base = {
    guesses,
    status: "lost" as const,
    dateKey: "2026-10-06",
    now,
  };
  const zero = shareLoopText({ ...base, streak: 0 });
  const unset = shareLoopText(base);
  for (const text of [zero, unset]) {
    assert.equal(text.includes("🔥"), false);
    assert.equal(
      text,
      "meridian geodetective October 6\nhttps://veeresh-bikkaneti.github.io/Meridian/\n🟥⬜⬜⬜⬜ not solved",
    );
  }
});
