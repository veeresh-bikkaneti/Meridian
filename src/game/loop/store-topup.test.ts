/**
 * Deck top-up tests (Capitals & Flags design §7): when a pack grows,
 * an existing player's deck gains the new cases in its undealt
 * remainder — dealt history, the open mystery, and the cycle count are
 * never touched, and a deck at the current size is returned untouched.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dealFromDeck,
  ensurePackDeck,
  freshLoopUnlimitedStore,
  getDeckState,
  setDeckState,
  type PackDeckCase,
} from "./store.ts";
import type { LoopDeckState } from "./types.ts";

/** randInt that never swaps: Fisher–Yates with j = i leaves order unchanged. */
const noSwap = (bound: number) => bound - 1;

const V1: PackDeckCase[] = [
  { index: 387, packTier: 1 },
  { index: 388, packTier: 2 },
  { index: 389, packTier: 3 },
];
/** The grown manifest: v1's cases in order, then the appended wave. */
const V2: PackDeckCase[] = [
  ...V1,
  { index: 459, packTier: 3 },
  { index: 460, packTier: 1 },
  { index: 461, packTier: 2 },
];

function storeWithDeck(deck: LoopDeckState) {
  const base = freshLoopUnlimitedStore(387);
  return setDeckState(base, "capitals", deck);
}

test("a fresh deck builds from the full grown manifest", () => {
  const store = ensurePackDeck(freshLoopUnlimitedStore(387), "capitals", V2, noSwap);
  const deck = getDeckState(store, "capitals");
  assert.equal(deck?.deck.length, 6);
  assert.deepEqual(
    [...(deck?.deck ?? [])].sort((a, b) => a - b),
    [387, 388, 389, 459, 460, 461],
  );
});

test("top-up appends only the new cases, tier-banded among themselves", () => {
  // Player has dealt 387 (completed) and holds 388 + 389 undealt.
  const store = storeWithDeck({ deck: [389, 388], cycle: 1, cycleCompleted: 1 });
  const next = ensurePackDeck(store, "capitals", V2, noSwap);
  const deck = getDeckState(next, "capitals");
  // Undealt remainder keeps its order; the new band follows tier order
  // (tier 1: 460, tier 2: 461, tier 3: 459) under the no-swap shuffle.
  assert.deepEqual(deck?.deck, [389, 388, 460, 461, 459]);
  assert.equal(deck?.cycleCompleted, 1);
  assert.equal(deck?.cycle, 1);
});

test("top-up counts the open mystery toward the built-from size", () => {
  const base = storeWithDeck({ deck: [389, 388], cycle: 1, cycleCompleted: 0 });
  const withCurrent: typeof base = {
    ...base,
    current: {
      index: 387,
      deckId: "capitals",
      status: "playing",
      guesses: [],
      cluesRevealed: 1,
      startedAt: 0,
    } as never,
  };
  const next = ensurePackDeck(withCurrent, "capitals", V2, noSwap);
  const deck = getDeckState(next, "capitals");
  // 387 is open, not new: it must not be re-added.
  assert.deepEqual(deck?.deck, [389, 388, 460, 461, 459]);
});

test("top-up does not double-count a finished mystery still in current", () => {
  // The player finished case 387 and exited on its reveal screen:
  // completePuzzle already counted it in cycleCompleted, and the finished
  // puzzle is still sitting in `current`. It is not an open mystery, so
  // it must not be counted a second time — a double count would skip the
  // first appended case (459) when the pack grows. Won and lost finishes
  // both stay in `current`, so both are checked.
  for (const status of ["won", "lost"] as const) {
    const base = storeWithDeck({ deck: [389, 388], cycle: 1, cycleCompleted: 1 });
    const withFinished: typeof base = {
      ...base,
      current: {
        index: 387,
        deckId: "capitals",
        status,
        guesses: [],
        cluesRevealed: 5,
        startedAt: 0,
      } as never,
    };
    const next = ensurePackDeck(withFinished, "capitals", V2, noSwap);
    const deck = getDeckState(next, "capitals");
    // Same result as the playing-current top-up: every appended case lands.
    assert.deepEqual(deck?.deck, [389, 388, 460, 461, 459], `status=${status}`);
    assert.equal(deck?.cycleCompleted, 1);
  }
});

test("an up-to-date deck is returned untouched (same reference)", () => {
  const store = ensurePackDeck(freshLoopUnlimitedStore(387), "capitals", V2, noSwap);
  const again = ensurePackDeck(store, "capitals", V2, noSwap);
  assert.equal(again, store);
});

test("top-up on an exhausted deck deals the new cases before reshuffle", () => {
  const store = storeWithDeck({ deck: [], cycle: 1, cycleCompleted: 3 });
  const next = ensurePackDeck(store, "capitals", V2, noSwap);
  const deck = getDeckState(next, "capitals");
  assert.deepEqual(deck?.deck, [460, 461, 459]);
  const dealt = dealFromDeck(next, "capitals", () => {
    throw new Error("must not rebuild while topped-up cases remain");
  });
  assert.equal(dealt.reshuffled, false);
  assert.ok([459, 460, 461].includes(dealt.index));
});
