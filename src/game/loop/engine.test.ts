import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildLoopGuess, octantFor, submitGuess } from "./engine.ts";
import { freshLoopPuzzleState } from "./store.ts";
import type { LoopPuzzleProgress, LoopGuess } from "./types.ts";

function guess(overrides: Partial<LoopGuess> = {}): LoopGuess {
  return {
    name: "Springfield, Illinois, US",
    placeId: "geonames:4250542",
    distKm: 1200,
    octant: "north",
    warmer: null,
    ...overrides,
  };
}

const TARGET = "geonames:1275339";

test("octantFor: cardinal bearings from the guess toward the target", () => {
  // From the equator/prime-meridian origin.
  assert.equal(octantFor(0, 0, 0, 10), "north");
  assert.equal(octantFor(0, 0, 0, -10), "south");
  assert.equal(octantFor(0, 0, 10, 0), "east");
  assert.equal(octantFor(0, 0, -10, 0), "west");
  assert.equal(octantFor(0, 0, 10, 10), "north-east");
  assert.equal(octantFor(0, 0, -10, -10), "south-west");
});

test("buildLoopGuess: distance, octant, and first-guess warmer=null", () => {
  const g = buildLoopGuess(
    { name: "Paris", placeId: "geonames:2988507", lon: 2.35, lat: 48.85 },
    { lon: 2.35, lat: 48.85 },
    null,
  );
  assert.equal(g.name, "Paris");
  assert.equal(g.placeId, "geonames:2988507");
  assert.ok(g.distKm < 1, `expected ~0 km, got ${g.distKm}`);
  assert.equal(g.warmer, null);
});

test("buildLoopGuess: warmer compares against the previous guess", () => {
  const prev = guess({ distKm: 1000 });
  const target = { lon: 0, lat: 0 };
  const warmer = buildLoopGuess({ name: "A", placeId: "x", lon: 1, lat: 0 }, target, prev);
  const colder = buildLoopGuess({ name: "B", placeId: "y", lon: 20, lat: 0 }, target, prev);
  assert.equal(warmer.warmer, true);
  assert.equal(colder.warmer, false);
  // Octant points from the guess toward the target: 1°E of target → west.
  assert.equal(warmer.octant, "west");
});

test("submitGuess: first wrong guess stays playing and reveals clue 2", () => {
  const next = submitGuess(freshLoopPuzzleState(0, 1), guess(), TARGET);
  assert.equal(next.guesses.length, 1);
  assert.equal(next.status, "playing");
  assert.equal(next.cluesRevealed, 2);
  assert.equal(next.guesses[0]!.warmer, null);
});

test("submitGuess: win when placeId matches the clue file target", () => {
  const s1 = submitGuess(freshLoopPuzzleState(0, 1), guess({ placeId: "other" }), TARGET);
  const s2 = submitGuess(s1, guess({ placeId: TARGET, distKm: 0 }), TARGET);
  assert.equal(s2.status, "won");
  assert.equal(s2.guesses.length, 2);
  assert.equal(s2.cluesRevealed, 3);
});

test("submitGuess: loss on the fifth wrong guess", () => {
  let state: LoopPuzzleProgress = freshLoopPuzzleState(0, 1);
  for (let i = 0; i < 4; i++) {
    state = submitGuess(state, guess({ placeId: `geonames:wrong${i}`, name: `Wrong ${i}`, distKm: 500 + i }), TARGET);
    assert.equal(state.status, "playing");
  }
  assert.equal(state.cluesRevealed, 5);
  const lost = submitGuess(state, guess({ placeId: "geonames:wrong4", name: "Wrong 4", distKm: 10 }), TARGET);
  assert.equal(lost.status, "lost");
  assert.equal(lost.guesses.length, 5);
  assert.equal(lost.cluesRevealed, 5);
});

test("submitGuess: maxGuesses 6 lets the 8-10 deal resolve on the 6th guess", () => {
  const deal = { startClues: 3, maxGuesses: 6 };
  let state: LoopPuzzleProgress = freshLoopPuzzleState(0, 1, deal.startClues, deal.maxGuesses);
  for (let i = 0; i < 5; i++) {
    state = submitGuess(state, guess({ placeId: `geonames:wrong${i}`, name: `Wrong ${i}` }), TARGET, deal);
    assert.equal(state.status, "playing", `still playing after ${i + 1} wrong guesses`);
  }
  assert.equal(state.guesses.length, 5);
  const lost = submitGuess(state, guess({ placeId: "geonames:wrong5", name: "Wrong 5" }), TARGET, deal);
  assert.equal(lost.status, "lost", "6th wrong guess loses under the 8-10 deal");
  assert.equal(lost.guesses.length, 6);
  // A 7th guess is a no-op even under the 6-cap deal.
  assert.equal(submitGuess(lost, guess({ placeId: "geonames:wrong6" }), TARGET, deal), lost);
  // A correct 6th guess wins.
  const winAt = submitGuess(state, guess({ placeId: TARGET, distKm: 0 }), TARGET, deal);
  assert.equal(winAt.status, "won");
  assert.equal(winAt.guesses.length, 6);
});

test("submitGuess: no-ops once the day is won or lost", () => {
  const won = submitGuess(freshLoopPuzzleState(0, 1), guess({ placeId: TARGET }), TARGET);
  assert.equal(submitGuess(won, guess(), TARGET), won);
  let lost: LoopPuzzleProgress = freshLoopPuzzleState(0, 1);
  for (let i = 0; i < 5; i++) lost = submitGuess(lost, guess({ placeId: `geonames:lost${i}` }), TARGET);
  assert.equal(lost.status, "lost");
  assert.equal(submitGuess(lost, guess({ placeId: "geonames:extra" }), TARGET), lost);
});

test("submitGuess: warmer is re-derived from the previous guess", () => {
  const s1 = submitGuess(freshLoopPuzzleState(0, 1), guess({ placeId: "geonames:1", distKm: 1000, warmer: true }), TARGET);
  assert.equal(s1.guesses[0]!.warmer, null, "first guess is always null");
  const s2 = submitGuess(s1, guess({ placeId: "geonames:2", distKm: 900, warmer: false }), TARGET);
  assert.equal(s2.guesses[1]!.warmer, true, "engine overrides a wrong input value");
  const s3 = submitGuess(s2, guess({ placeId: "geonames:3", distKm: 950 }), TARGET);
  assert.equal(s3.guesses[2]!.warmer, false);
});

test("submitGuess: a repeated placeId is rejected without consuming a guess", () => {
  const first = submitGuess(freshLoopPuzzleState(0, 1), guess(), TARGET);
  assert.equal(first.guesses.length, 1);
  const dup = submitGuess(first, guess({ distKm: 5 }), TARGET);
  // Same state object identity: nothing appended, no extra clue revealed.
  assert.equal(dup, first);
  assert.equal(dup.guesses.length, 1);
  assert.equal(dup.cluesRevealed, 2);
  assert.equal(dup.status, "playing");
});

test("submitGuess: a repeated placeId that would win still wins on the first submission", () => {
  const won = submitGuess(freshLoopPuzzleState(0, 1), guess({ placeId: TARGET }), TARGET);
  assert.equal(won.status, "won");
  const again = submitGuess(won, guess({ placeId: TARGET }), TARGET);
  assert.equal(again, won);
});
