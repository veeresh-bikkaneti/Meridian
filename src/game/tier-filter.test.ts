import assert from "node:assert/strict";
import test from "node:test";
import { TIER_BANDS, filterByTier, isPickerDifficulty, type PickerDifficulty } from "./tier-filter.ts";

type Place = { id: string; difficulty?: unknown };

const MIXED: Place[] = [
  { id: "t1", difficulty: 1 },
  { id: "t2", difficulty: 2 },
  { id: "t3", difficulty: 3 },
  { id: "t4", difficulty: 4 },
  { id: "t5", difficulty: 5 },
];

function ids(places: Place[]): string[] {
  return places.map((p) => p.id);
}

test("bands are the inclusive ranges easy 1-2, medium 2-4, hard 4-5", () => {
  assert.deepEqual(TIER_BANDS, {
    easy: [[1, 2]],
    medium: [[2, 4]],
    hard: [[4, 5]],
  });
});

test("easy keeps tiers 1-2 only", () => {
  assert.deepEqual(ids(filterByTier(MIXED, "easy")), ["t1", "t2"]);
});

test("medium keeps tiers 2-4 only", () => {
  assert.deepEqual(ids(filterByTier(MIXED, "medium")), ["t2", "t3", "t4"]);
});

test("hard keeps tiers 4-5 only", () => {
  assert.deepEqual(ids(filterByTier(MIXED, "hard")), ["t4", "t5"]);
});

test("missing difficulty reads as tier 3 (kept by medium, dropped by easy/hard)", () => {
  const places: Place[] = [{ id: "no-tier" }, { id: "undefined-tier", difficulty: undefined }];
  assert.deepEqual(ids(filterByTier(places, "medium")), ["no-tier", "undefined-tier"]);
  assert.deepEqual(ids(filterByTier(places, "easy")), []);
  assert.deepEqual(ids(filterByTier(places, "hard")), []);
});

test("invalid difficulty reads as tier 3 (kept by medium, dropped by easy/hard)", () => {
  const places: Place[] = [
    { id: "zero", difficulty: 0 },
    { id: "six", difficulty: 6 },
    { id: "string", difficulty: "hard" },
    { id: "null", difficulty: null },
  ];
  assert.deepEqual(ids(filterByTier(places, "medium")), ["zero", "six", "string", "null"]);
  assert.deepEqual(ids(filterByTier(places, "easy")), []);
  assert.deepEqual(ids(filterByTier(places, "hard")), []);
});

test("empty pool stays empty — fail-closed, never widened to the full catalog", () => {
  const easy: PickerDifficulty = "easy";
  assert.deepEqual(filterByTier([], easy), []);
  assert.deepEqual(filterByTier([], "medium"), []);
  assert.deepEqual(filterByTier([], "hard"), []);
});

test("a band that matches nothing returns empty rather than widening", () => {
  // Tier-5-only input under easy: nothing qualifies, so the result is empty.
  const onlyExtreme: Place[] = [{ id: "x1", difficulty: 5 }];
  assert.deepEqual(filterByTier(onlyExtreme, "easy"), []);
});

test("the filter returns a subset — the input is not mutated", () => {
  const before = MIXED.map((p) => ({ ...p }));
  const kept = filterByTier(MIXED, "easy");
  assert.deepEqual(MIXED, before);
  assert.ok(kept.length < MIXED.length);
});

test("isPickerDifficulty accepts only the three picker choices", () => {
  assert.equal(isPickerDifficulty("easy"), true);
  assert.equal(isPickerDifficulty("medium"), true);
  assert.equal(isPickerDifficulty("hard"), true);
  assert.equal(isPickerDifficulty("Easy"), false);
  assert.equal(isPickerDifficulty(3), false);
  assert.equal(isPickerDifficulty(null), false);
  assert.equal(isPickerDifficulty(undefined), false);
});
