import { readFileSync } from "node:fs";
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

import { guessPresentTarget } from "./clue-watchdog.ts";

test("a first guess opens ONE more starting card, not the whole deal (was: cluesRevealed - 1 = 3)", () => {
  // 3-card deal, only card 1 presented, the guess unlocked card 4.
  assert.equal(guessPresentTarget(1, 4), 2);
});

test("a guess never reaches the card it just unlocked, and never goes below 1", () => {
  assert.equal(guessPresentTarget(3, 4), 3); // all starting cards already open
  assert.equal(guessPresentTarget(1, 2), 1);
  assert.equal(guessPresentTarget(0, 1), 1);
});

test("DetectiveHost presents the guess-pin clue through guessPresentTarget", () => {
  // Source-shape wiring check (same pattern as hint-hydration.test.ts):
  // the helper is unit-tested above, this fails if the host stops calling it.
  // Comments are stripped first so a commented-out call does not count;
  // whitespace and a trailing comma allow for prettier-style formatting.
  const host = readFileSync(
    new URL("./detective/DetectiveHost.tsx", import.meta.url),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.match(
    host,
    /presentClue\(\s*guessPresentTarget\(\s*presentedClue\s*,\s*cluesRevealed\s*,?\s*\)\s*,?\s*\)/,
  );
});
