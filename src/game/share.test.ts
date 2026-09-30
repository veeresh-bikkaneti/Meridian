import assert from "node:assert/strict";
import test from "node:test";
import { shareText } from "./share.ts";

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
    "meridian September 28\n12,480 over 60 places · 208 avg/place · 🔥14 best streak · Nebraska",
  );
  assert.equal(
    endless({
      regionName: "Globe",
      totalScore: 3150,
      placesPlayed: 20,
      averagePerPlace: 158,
      bestStreak: 5,
    }),
    "meridian September 28\n3,150 over 20 places · 158 avg/place · 🔥5 best streak · Globe",
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
    "meridian September 28\n190 over 2 places · 95 avg/place · Nebraska",
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
