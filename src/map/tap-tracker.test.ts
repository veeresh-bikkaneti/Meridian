import assert from "node:assert/strict";
import test from "node:test";
import { createTapTracker } from "./tap-tracker.ts";

test("the first tap is a plain tap", () => {
  const tracker = createTapTracker();
  assert.equal(tracker.register({ x: 40, y: 80, t: 1_000 }), "tap");
});

test("a quick near second tap is a double-tap", () => {
  const tracker = createTapTracker();
  assert.equal(tracker.register({ x: 40, y: 80, t: 1_000 }), "tap");
  assert.equal(tracker.register({ x: 44, y: 76, t: 1_200 }), "double-tap");
});

test("a triple-tap classifies as tap, double-tap, tap (pair consumed)", () => {
  const tracker = createTapTracker();
  assert.equal(tracker.register({ x: 40, y: 80, t: 1_000 }), "tap");
  assert.equal(tracker.register({ x: 41, y: 81, t: 1_150 }), "double-tap");
  // the pair is consumed: the third tap starts a fresh pair, it cannot
  // double-revert the already-reverted placement
  assert.equal(tracker.register({ x: 42, y: 82, t: 1_300 }), "tap");
});

test("slow or far taps never form a double-tap", () => {
  const tracker = createTapTracker();
  assert.equal(tracker.register({ x: 40, y: 80, t: 1_000 }), "tap");
  assert.equal(tracker.register({ x: 41, y: 81, t: 1_600 }), "tap");
  assert.equal(tracker.register({ x: 400, y: 80, t: 1_700 }), "tap");
});

test("reset clears the pending tap", () => {
  const tracker = createTapTracker();
  assert.equal(tracker.register({ x: 40, y: 80, t: 1_000 }), "tap");
  tracker.reset();
  assert.equal(tracker.register({ x: 41, y: 81, t: 1_100 }), "tap");
});
