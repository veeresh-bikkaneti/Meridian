import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./catalog.ts";
import { buildPuzzle } from "./daily.ts";
import { distanceKm, pointInRing, wordCount } from "./geo.ts";
import { distanceScore } from "./score.ts";
import { scoreMark, shareText } from "./share.ts";
import { missingContinents } from "./territory.ts";

test("world curve matches the MapTap landmarks", () => {
  assert.equal(distanceScore(0, "world"), 100);
  assert.equal(distanceScore(22, "world"), 100);
  assert.equal(distanceScore(500, "world"), 90);
  assert.equal(distanceScore(1000, "world"), 81);
  assert.equal(distanceScore(4000, "world"), 42);
  assert.equal(distanceScore(10000, "world"), 12);
  assert.equal(distanceScore(16250, "world"), 0);
  assert.equal(distanceScore(20000, "world"), 0);
});







test("share text is a spoiler-free endless line", () => {
  const text = shareText({
    regionName: "Nebraska",
    dateKey: "2026-09-28",
    totalScore: 12480,
    placesPlayed: 60,
    averagePerPlace: 208,
    bestStreak: 14,
    now: new Date(Date.UTC(2026, 8, 28)),
  });
  assert.equal(text.includes("Taj"), false);
  assert.equal(text.includes("🎓"), false);
  assert.equal(
    text,
    "meridian September 28\n12,480 over 60 places · 208 avg · 🔥14 best streak · Nebraska",
  );
  assert.equal(scoreMark(0), "·");
  assert.equal(scoreMark(100), "🎯");
  const noStreak = shareText({
    regionName: "Japan",
    dateKey: "2025-06-18",
    totalScore: 0,
    placesPlayed: 0,
    averagePerPlace: 0,
    bestStreak: 0,
    now: new Date(Date.UTC(2026, 8, 28)),
  });
  assert.equal(noStreak, "meridian June 18, 2025\n0 over 0 places · 0 avg · Japan");
});

test("stories stay within 60 words and ids are unique", () => {
  const ids = new Set<string>();
  for (const place of PLACES) {
    assert.equal(ids.has(place.id), false, place.id);
    ids.add(place.id);
    const words = wordCount(place.story);
    assert.ok(words > 0 && words <= 60, `${place.id} has ${words} words`);
    assert.ok(place.reveal[0] >= -180 && place.reveal[0] <= 180);
    assert.ok(place.reveal[1] >= -90 && place.reveal[1] <= 90);
  }
});

test("the same date always builds the same puzzle", () => {
  const a = buildPuzzle("home", "2026-09-28", "lincoln").map((place) => place.id);
  const b = buildPuzzle("home", "2026-09-28", "lincoln").map((place) => place.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
  assert.deepEqual(
    buildPuzzle("home", "2026-09-28", "lincoln").map((place) => place.ring),
    ["lincoln", "lincoln", "region", "nebraska", "usa"],
  );
  const pair = buildPuzzle("home", "2026-09-28", "lincoln");
  assert.ok(distanceKm(pair[0].reveal, pair[1].reveal) >= 2);
  const world = buildPuzzle("world", "2026-09-28", "lincoln");
  assert.deepEqual(
    world.map((place) => place.difficulty),
    [1, 2, 3, 4, 5],
  );
  const visitor = buildPuzzle("home", "2026-09-28", "visitor");
  assert.deepEqual(
    visitor.map((place) => place.ring),
    ["nebraska", "nebraska", "nebraska", "nebraska", "usa"],
  );
});

test("a pin inside a neighborhood scores as a direct hit", () => {
  const havelock = PLACES.find((place) => place.id === "havelock");
  assert.ok(havelock && havelock.shape.kind === "polygon");
  if (!havelock || havelock.shape.kind !== "polygon") return;
  assert.equal(pointInRing(havelock.reveal, havelock.shape.coordinates), true);
});

test("every continent has at least one country", () => {
  assert.deepEqual(missingContinents(), []);
});
