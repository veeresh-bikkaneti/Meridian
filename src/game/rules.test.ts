import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./catalog.ts";
import { buildPuzzle } from "./daily.ts";
import { distanceKm, pointInRing, wordCount } from "./geo.ts";
import { applyBonus, distanceScore, gradeRound, weightedTotal } from "./score.ts";
import { scoreMark, shareText } from "./share.ts";
import { bonusFor, missingContinents } from "./territory.ts";
import type { Guess } from "./types.ts";

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

test("a country lift turns 12 into 34 and never lowers a high score", () => {
  assert.equal(applyBonus(12, "country"), 34);
  assert.equal(applyBonus(90, "country"), 90);
  assert.equal(applyBonus(100, "country"), 100);
  assert.equal(applyBonus(0, "country"), 25);
  assert.equal(applyBonus(0, "continent"), 10);
  assert.equal(applyBonus(12, "none"), 12);
  assert.equal(applyBonus(12, "continent"), 21);
});

test("round weights match published MapTap totals", () => {
  assert.equal(weightedTotal([100, 90, 97, 85, 63]), 828);
  assert.equal(weightedTotal([93, 80, 93, 84, 96]), 899);
  assert.equal(weightedTotal([92, 96, 95, 100, 91]), 951);
  assert.equal(weightedTotal([100, 92, 99, 100, 100]), 990);
});

test("only world and United States rounds keep a country lift", () => {
  const local = gradeRound(10, "lincoln", "country", 0);
  assert.equal(local.bonus, "none");
  assert.equal(local.weight, 1);
  assert.ok(local.score < 100);
  assert.equal(local.score, local.distanceScore);
  const world = gradeRound(10000, "world", "country", 2);
  assert.equal(world.distanceScore, 12);
  assert.equal(world.score, 34);
  assert.equal(world.weight, 2);
  assert.equal(world.bonus, "country");
  const usa = gradeRound(0, "usa", "continent", 4);
  assert.equal(usa.score, 100);
  assert.equal(usa.weight, 3);
});

test("share text keeps the weighted total and no place names", () => {
  const scores = [100, 90, 97, 85, 63];
  const weights = [1, 1, 2, 3, 3];
  const guesses = scores.map((score, index) => {
    const guess: Guess = {
      lon: 0,
      lat: 0,
      distanceKm: 0,
      distanceScore: score,
      score,
      weight: weights[index],
      bonus: "none",
      knew: null,
      scoringVersion: 2,
    };
    return guess;
  });
  const text = shareText({ edition: "world", dateKey: "2026-06-18", guesses });
  assert.equal(text.includes("Taj"), false);
  assert.match(text, /100🎯 90🏆 97🔥 85🌟 63🤨/);
  assert.match(text, /×1 ×1 ×2 ×3 ×3/);
  assert.match(text, /100 \+ 90 \+ 194 \+ 255 \+ 189/);
  assert.match(text, /Final score: 828 \/ 1000/);
  assert.equal(text.includes("Before lift"), false);
  assert.equal(scoreMark(0), "·");
  assert.equal(scoreMark(63), "🤨");
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

test("country and continent bonuses follow the atlas", () => {
  assert.deepEqual(missingContinents(), []);
  assert.equal(bonusFor([78.0421, 27.1751], [77.209, 28.6139]), "country");
  assert.equal(bonusFor([2.3522, 48.8566], [78.0421, 27.1751]), "none");
  assert.equal(bonusFor([116.4074, 39.9042], [78.0421, 27.1751]), "continent");
  assert.equal(bonusFor([0, 0], [78.0421, 27.1751]), "none");
  assert.equal(bonusFor([-96.69972, 40.80806], [-95.99799, 41.2565]), "country");
});
