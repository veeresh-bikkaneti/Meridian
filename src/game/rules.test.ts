import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./catalog.ts";
import { buildPuzzle } from "./daily.ts";
import { distanceKm, pointInRing, wordCount } from "./geo.ts";
import { scoreDistance } from "./score.ts";

test("half-credit distances match the ring curves", () => {
  assert.equal(scoreDistance(0.25, "lincoln"), 100);
  assert.equal(scoreDistance(1.29, "lincoln"), 50);
  assert.equal(scoreDistance(1, "region"), 100);
  assert.equal(scoreDistance(6.54, "region"), 50);
  assert.equal(scoreDistance(3, "nebraska"), 100);
  assert.equal(scoreDistance(23.8, "nebraska"), 50);
  assert.equal(scoreDistance(10, "usa"), 100);
  assert.equal(scoreDistance(114, "usa"), 50);
  assert.equal(scoreDistance(25, "world"), 100);
  assert.equal(scoreDistance(857, "world"), 50);
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
