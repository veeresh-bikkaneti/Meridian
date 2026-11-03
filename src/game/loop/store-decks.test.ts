import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  activeDeckIdOf,
  buildTierBandedDeck,
  clampDeckToPoolSize,
  clampPackDeckToIndexes,
  completePuzzle,
  dealFromDeck,
  ensurePackDeck,
  freshLoopPuzzleState,
  freshLoopUnlimitedStore,
  freshPackDeckState,
  getDeckState,
  isLoopUnlimitedStore,
  loadLoopStore,
  peekLoopProgress,
  returnPuzzleIndexToDeck,
  setActiveDeck,
  type PackDeckCase,
} from "./store.ts";
import {
  LOOP_CORE_DECK_ID,
  LOOP_STORAGE_KEY_V2,
  type LoopPuzzleState,
  type LoopUnlimitedStore,
} from "./types.ts";

/** Minimal in-memory localStorage stand-in (same shape as store.test.ts). */
function installStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const fake = {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = fake;
  return data;
}

/** randInt that never swaps: Fisher–Yates with j = i leaves order unchanged. */
const noSwap = (bound: number) => bound - 1;

/** Three capitals cases, one per tier, at the first pack indexes. */
const CASES: PackDeckCase[] = [
  { index: 389, packTier: 3 },
  { index: 387, packTier: 1 },
  { index: 388, packTier: 2 },
];

function storeWithPack(): LoopUnlimitedStore {
  const base = freshLoopUnlimitedStore(387);
  return ensurePackDeck(base, "capitals", CASES, noSwap);
}

function finishedPuzzle(overrides: Partial<LoopPuzzleState>): LoopPuzzleState {
  return {
    ...freshLoopPuzzleState(387, 1),
    status: "won",
    guesses: [],
    ...overrides,
  };
}

test("buildTierBandedDeck orders tier bands 1, 2, 3 and keeps every case exactly once", () => {
  const order = buildTierBandedDeck(CASES, noSwap);
  assert.deepEqual(order, [387, 388, 389]);
  const shuffled = buildTierBandedDeck(CASES);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), [387, 388, 389]);
  assert.equal(shuffled[0], 387, "the single tier-1 case always deals first");
});

test("buildTierBandedDeck rejects empty, duplicated, and out-of-band input", () => {
  assert.throws(() => buildTierBandedDeck([]), /non-empty/);
  assert.throws(
    () => buildTierBandedDeck([{ index: 1, packTier: 1 }, { index: 1, packTier: 2 }]),
    /duplicate/,
  );
  assert.throws(() => buildTierBandedDeck([{ index: 1, packTier: 4 }]), /packTier/);
  assert.throws(() => buildTierBandedDeck([{ index: -1, packTier: 1 }]), /bad clue index/);
});

test("freshPackDeckState starts at cycle 1 with nothing completed", () => {
  const deck = freshPackDeckState(CASES, noSwap);
  assert.deepEqual(deck, { deck: [387, 388, 389], cycle: 1, cycleCompleted: 0 });
});

test("ensurePackDeck builds once and never rebuilds an existing pack deck", () => {
  const base = freshLoopUnlimitedStore(387);
  const built = ensurePackDeck(base, "capitals", CASES, noSwap);
  assert.deepEqual(getDeckState(built, "capitals"), {
    deck: [387, 388, 389],
    cycle: 1,
    cycleCompleted: 0,
  });
  assert.equal(built.deck, base.deck, "the core deck object is untouched");
  const again = ensurePackDeck(built, "capitals", [{ index: 999, packTier: 1 }], noSwap);
  assert.equal(again, built, "an existing pack deck is returned as-is");
  assert.equal(ensurePackDeck(base, LOOP_CORE_DECK_ID, CASES, noSwap), base);
});

test("setActiveDeck points the next deal and clears back to core", () => {
  const base = freshLoopUnlimitedStore(387);
  assert.equal(activeDeckIdOf(base), LOOP_CORE_DECK_ID);
  const onPack = setActiveDeck(base, "capitals");
  assert.equal(onPack.activeDeckId, "capitals");
  assert.equal(activeDeckIdOf(onPack), "capitals");
  const back = setActiveDeck(onPack, undefined);
  assert.equal(back.activeDeckId, undefined);
  assert.equal(activeDeckIdOf(back), LOOP_CORE_DECK_ID);
  assert.equal(setActiveDeck(base, undefined), base, "clearing an unset active deck is a no-op");
});

test("dealFromDeck pops the named deck only, and rebuilds it when it runs out", () => {
  const store = storeWithPack();
  const coreBefore = store.deck;
  const first = dealFromDeck(store, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  assert.equal(first.index, 387);
  assert.equal(first.reshuffled, false);
  assert.equal(first.store.deck, coreBefore, "core deck untouched by a pack deal");
  assert.deepEqual(getDeckState(first.store, "capitals")!.deck, [388, 389]);

  const emptied: LoopUnlimitedStore = {
    ...first.store,
    packDecks: { capitals: { deck: [], cycle: 1, cycleCompleted: 3 } },
  };
  const rebuilt = dealFromDeck(emptied, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  assert.equal(rebuilt.reshuffled, true);
  assert.equal(rebuilt.index, 387);
  assert.deepEqual(getDeckState(rebuilt.store, "capitals"), {
    deck: [388, 389],
    cycle: 2,
    cycleCompleted: 0,
  });
});

test("dealFromDeck throws for a deck that was never built and for an empty rebuild", () => {
  const base = freshLoopUnlimitedStore(387);
  assert.throws(() => dealFromDeck(base, "capitals", () => [387]), /no deck named/);
  const store = storeWithPack();
  const emptied: LoopUnlimitedStore = {
    ...store,
    packDecks: { capitals: { deck: [], cycle: 1, cycleCompleted: 0 } },
  };
  assert.throws(() => dealFromDeck(emptied, "capitals", () => []), /rebuild/);
});

test("returnPuzzleIndexToDeck puts a failed deal back on its own deck's head", () => {
  const store = storeWithPack();
  const dealt = dealFromDeck(store, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  const rolled = returnPuzzleIndexToDeck(dealt.store, "capitals", dealt.index);
  assert.deepEqual(getDeckState(rolled, "capitals")!.deck, [387, 388, 389]);
  assert.equal(returnPuzzleIndexToDeck(store, "nope", 1), store, "unknown deck: store unchanged");
});

test("completePuzzle lands on the dealt deck: counter, celebration, global streak", () => {
  installStorage();
  const store = storeWithPack();
  // Deal the pack down to its last case, then finish it as a win.
  const d1 = dealFromDeck(store, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  const d2 = dealFromDeck(d1.store, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  const d3 = dealFromDeck(d2.store, "capitals", () => buildTierBandedDeck(CASES, noSwap));
  const done = completePuzzle(
    d3.store,
    finishedPuzzle({ index: 389, deckId: "capitals" }),
    "2026-11-03",
  );
  assert.equal(done.current?.completedCycle, true, "last case of the pack cycle celebrates");
  assert.equal(getDeckState(done, "capitals")!.cycleCompleted, 1);
  assert.equal(done.deck.cycleCompleted, 0, "core cycle counter does not move for a pack case");
  assert.equal(done.streak, 1, "streak is global across decks");
  assert.equal(done.totals.solved, 1);

  // A mid-pack completion does not celebrate, and a loss resets the streak.
  const mid = completePuzzle(
    d1.store,
    finishedPuzzle({ index: 387, deckId: "capitals", status: "lost" }),
    "2026-11-03",
  );
  assert.equal(mid.current?.completedCycle, false);
  assert.equal(mid.streak, 0);
  assert.equal(getDeckState(mid, "capitals")!.cycleCompleted, 1);
});

test("clampDeckToPoolSize keeps a pack mystery above the core pool", () => {
  installStorage();
  const store = storeWithPack();
  const withPackCurrent: LoopUnlimitedStore = {
    ...store,
    current: finishedPuzzle({ index: 500, deckId: "capitals", status: "playing" }),
  };
  const clamped = clampDeckToPoolSize(withPackCurrent, 387);
  assert.equal(clamped.current?.index, 500, "pack mystery survives the core clamp");
  assert.deepEqual(getDeckState(clamped, "capitals")!.deck, [387, 388, 389]);

  const withCoreCurrent: LoopUnlimitedStore = {
    ...store,
    current: finishedPuzzle({ index: 500, status: "playing" }),
  };
  assert.equal(
    clampDeckToPoolSize(withCoreCurrent, 387).current,
    null,
    "a core mystery past the pool is still discarded, as before",
  );
});

test("clampPackDeckToIndexes drops vanished pack cases and a vanished open mystery", () => {
  installStorage();
  const store = storeWithPack();
  const withCurrent: LoopUnlimitedStore = {
    ...store,
    current: finishedPuzzle({ index: 388, deckId: "capitals", status: "playing" }),
  };
  const clamped = clampPackDeckToIndexes(withCurrent, "capitals", new Set([387, 389]));
  assert.deepEqual(getDeckState(clamped, "capitals")!.deck, [387, 389]);
  assert.equal(clamped.current, null, "the open mystery's case left the pack");
  const kept = clampPackDeckToIndexes(withCurrent, "capitals", new Set([387, 388, 389]));
  assert.equal(kept, withCurrent, "nothing to drop: store returned as-is");
});

test("pre-pack saves validate and migrate: no pack fields, streak and mystery intact", () => {
  installStorage();
  const legacy: LoopUnlimitedStore = {
    deck: { deck: [3, 1, 2], cycle: 2, cycleCompleted: 5 },
    current: null,
    streak: 4,
    bestStreak: 9,
    totals: { solved: 10, lost: 2 },
  };
  assert.equal(isLoopUnlimitedStore(legacy), true, "a pre-pack blob still validates");
  const data = installStorage({
    [LOOP_STORAGE_KEY_V2]: JSON.stringify(legacy),
  });
  const loaded = loadLoopStore(387);
  assert.equal(loaded.streak, 4);
  assert.equal(loaded.packDecks, undefined, "migration is lazy: no pack deck is invented on load");
  assert.equal(activeDeckIdOf(loaded), LOOP_CORE_DECK_ID);
  assert.equal(data.get(LOOP_STORAGE_KEY_V2), JSON.stringify(legacy), "load never rewrites the blob");
});

test("pack-shaped stores validate; malformed pack fields fail closed", () => {
  const store = setActiveDeck(storeWithPack(), "capitals");
  assert.equal(isLoopUnlimitedStore(store), true);
  const badDeck = { ...store, packDecks: { capitals: { deck: "nope", cycle: 1, cycleCompleted: 0 } } };
  assert.equal(isLoopUnlimitedStore(badDeck), false);
  const badActive = { ...store, activeDeckId: "" };
  assert.equal(isLoopUnlimitedStore(badActive), false);
  const badPuzzle = { ...store, current: { ...finishedPuzzle({}), deckId: "" } };
  assert.equal(isLoopUnlimitedStore(badPuzzle), false);
});

test("freshLoopPuzzleState omits deckId for core deals and carries it for pack deals", () => {
  installStorage();
  const core = freshLoopPuzzleState(12, 1);
  assert.equal("deckId" in core, false);
  const pack = freshLoopPuzzleState(387, 1, 1, 5, "capitals");
  assert.equal(pack.deckId, "capitals");
});

test("peekLoopProgress reports the active deck", () => {
  const store = setActiveDeck(storeWithPack(), "capitals");
  installStorage({ [LOOP_STORAGE_KEY_V2]: JSON.stringify(store) });
  const peek = peekLoopProgress();
  assert.equal(peek.activeDeckId, "capitals");
  assert.equal(peek.inProgress, false);
});
