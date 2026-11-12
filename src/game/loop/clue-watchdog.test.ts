import assert from "node:assert/strict";
import test from "node:test";

import {
  nextWatchdogCount,
  shouldArmClueWatchdog,
  type ClueWatchdogInput,
} from "./clue-watchdog.ts";

const base: ClueWatchdogInput = {
  pairOn: true,
  finished: false,
  visibleClues: 1,
  cluesRevealed: 4,
  guessCount: 1,
  startingClues: 3,
  readHeld: false,
};

test("after a wrong first guess (3 starting clues) the watchdog opens one card, not three", () => {
  assert.equal(shouldArmClueWatchdog(base), true);
  assert.equal(nextWatchdogCount(base.visibleClues, base.cluesRevealed), 2);
});

test("the watchdog never opens past what the game revealed", () => {
  assert.equal(nextWatchdogCount(4, 4), 4);
  assert.equal(nextWatchdogCount(3, 4), 4);
});

test("tap mode with a held read: the watchdog does not run", () => {
  assert.equal(shouldArmClueWatchdog({ ...base, readHeld: true }), false);
});

test("the fresh opening guard from the earlier fix still holds", () => {
  assert.equal(
    shouldArmClueWatchdog({ ...base, guessCount: 0, cluesRevealed: 3 }),
    false,
  );
});

test("no watchdog when the pair is off, the case is over, or every card is open", () => {
  assert.equal(shouldArmClueWatchdog({ ...base, pairOn: false }), false);
  assert.equal(shouldArmClueWatchdog({ ...base, finished: true }), false);
  assert.equal(shouldArmClueWatchdog({ ...base, visibleClues: 4 }), false);
});
