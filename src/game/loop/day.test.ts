import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loopPuzzleFromSearch } from "./day.ts";

test("loopPuzzleFromSearch: numeric param returns the index", () => {
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=218"), 218);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=0"), 0);
  assert.equal(loopPuzzleFromSearch("?a=1&loop-puzzle=42"), 42);
});

test("loopPuzzleFromSearch: inert without the param or with garbage", () => {
  assert.equal(loopPuzzleFromSearch(""), null);
  assert.equal(loopPuzzleFromSearch("?foo=bar"), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle="), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=today"), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=12.5"), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=-3"), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=0x10"), null);
  assert.equal(loopPuzzleFromSearch("?loop-puzzle=12 "), null);
});

test("loopPuzzleFromSearch: the retired loop-date param is never parsed", () => {
  assert.equal(loopPuzzleFromSearch("?loop-date=2026-10-03"), null);
  // Both params present: loop-puzzle wins, loop-date is ignored.
  assert.equal(loopPuzzleFromSearch("?loop-date=2026-10-03&loop-puzzle=7"), 7);
});
