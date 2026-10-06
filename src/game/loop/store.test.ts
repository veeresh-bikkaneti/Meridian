import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  clampDeckToPoolSize,
  completePuzzle,
  dealPuzzleIndex,
  freshLoopPuzzleState,
  freshLoopUnlimitedStore,
  isLoopPuzzleState,
  isLoopUnlimitedStore,
  loadLoopStore,
  peekLoopProgress,
  readLoopStoreV2,
  returnIndexToDeckHead,
  shuffleIndexDeck,
  writeLoopStoreV2,
} from "./store.ts";
import { LOOP_STORAGE_KEY_V2, type LoopPuzzleState, type LoopUnlimitedStore } from "./types.ts";
import { submitGuess } from "./engine.ts";

/** Minimal in-memory localStorage stand-in. */
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

/** localStorage whose writes/reads throw (private window, quota). */
function installBlockedStorage() {
  const fake = {
    getItem: (_key: string): string | null => {
      throw new Error("blocked");
    },
    setItem: (_key: string, _value: string): void => {
      throw new Error("blocked");
    },
    removeItem: (_key: string): void => {
      throw new Error("blocked");
    },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = fake;
}

function isPermutation(deck: number[], size: number): boolean {
  if (deck.length !== size) return false;
  const seen = new Set(deck);
  if (seen.size !== size) return false;
  for (let i = 0; i < size; i++) if (!seen.has(i)) return false;
  return true;
}

function wonPuzzle(index = 3, cycle = 1): LoopPuzzleState {
  const p = freshLoopPuzzleState(index, cycle);
  return { ...p, guesses: [], status: "won", cluesRevealed: 2 };
}

function lostPuzzle(index = 3, cycle = 1): LoopPuzzleState {
  const p = freshLoopPuzzleState(index, cycle);
  return { ...p, guesses: [], status: "lost", cluesRevealed: 5 };
}

test("shuffleIndexDeck: always a permutation of 0..n-1", () => {
  for (const size of [1, 2, 5, 387]) {
    assert.ok(isPermutation(shuffleIndexDeck(size), size), `size ${size}`);
  }
});

test("shuffleIndexDeck: deterministic under an injected randInt", () => {
  // j = 0 every round: fully determined, still a permutation.
  const deck = shuffleIndexDeck(5, () => 0);
  assert.ok(isPermutation(deck, 5));
  assert.deepEqual(deck, shuffleIndexDeck(5, () => 0), "same randInt, same deck");
});

test("shuffleIndexDeck: the crypto path actually shuffles (statistical smoke)", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) seen.add(shuffleIndexDeck(10).join(","));
  assert.ok(seen.size > 1, "30 shuffles of 10 must not all be identical");
});

test("shuffleIndexDeck: throws on a non-positive pool size", () => {
  assert.throws(() => shuffleIndexDeck(0), /poolSize/);
  assert.throws(() => shuffleIndexDeck(-3), /poolSize/);
  assert.throws(() => shuffleIndexDeck(2.5), /poolSize/);
});

test("freshLoopUnlimitedStore: full shuffled deck, zeroed stats", () => {
  const store = freshLoopUnlimitedStore(387);
  assert.ok(isPermutation(store.deck.deck, 387));
  assert.equal(store.deck.cycle, 1);
  assert.equal(store.deck.cycleCompleted, 0);
  assert.equal(store.current, null);
  assert.equal(store.streak, 0);
  assert.deepEqual(store.totals, { solved: 0, lost: 0 });
});

test("dealPuzzleIndex: pops the head; exactly-once across a full 387 cycle", () => {
  let deck = freshLoopUnlimitedStore(387).deck;
  const dealt: number[] = [];
  for (let i = 0; i < 387; i++) {
    const out = dealPuzzleIndex(deck, 387);
    assert.equal(out.reshuffled, false);
    dealt.push(out.index);
    deck = out.deck;
  }
  assert.ok(isPermutation(dealt, 387), "every index dealt exactly once");
  assert.equal(deck.deck.length, 0);
});

test("dealPuzzleIndex: exhaustion triggers a silent reshuffle (cycle++)", () => {
  let deck = freshLoopUnlimitedStore(4).deck;
  for (let i = 0; i < 4; i++) deck = dealPuzzleIndex(deck, 4).deck;
  const out = dealPuzzleIndex(deck, 4);
  assert.equal(out.reshuffled, true);
  assert.equal(out.deck.cycle, 2);
  assert.equal(out.deck.cycleCompleted, 0);
  assert.equal(out.deck.deck.length, 3);
  // The new cycle is a fresh full deck minus the popped head.
  assert.ok(isPermutation([out.index, ...out.deck.deck], 4));
});

test("returnIndexToDeckHead: 404 rollback restores exactly-once", () => {
  const deck = freshLoopUnlimitedStore(5).deck;
  const dealt = dealPuzzleIndex(deck, 5);
  const rolled = returnIndexToDeckHead(dealt.deck, dealt.index);
  assert.equal(rolled.deck[0], dealt.index, "index back on the head");
  assert.ok(isPermutation(rolled.deck, 5), "no index lost or duplicated");
});

test("completePuzzle: win increments streak, totals, cycle counter", () => {
  const store: LoopUnlimitedStore = {
    ...freshLoopUnlimitedStore(10),
    streak: 2,
    current: freshLoopPuzzleState(4, 1),
  };
  const next = completePuzzle(store, wonPuzzle(4, 1), "2026-10-06");
  assert.equal(next.streak, 3);
  assert.deepEqual(next.totals, { solved: 1, lost: 0 });
  assert.equal(next.deck.cycleCompleted, 1);
  assert.equal(next.current!.status, "won");
  assert.equal(next.current!.completedAt, "2026-10-06");
  assert.equal(next.current!.streakEndedAt, null);
});

test("completePuzzle: loss resets streak and records what it ended at", () => {
  const store: LoopUnlimitedStore = {
    ...freshLoopUnlimitedStore(10),
    streak: 4,
    current: freshLoopPuzzleState(4, 1),
  };
  const next = completePuzzle(store, lostPuzzle(4, 1), "2026-10-06");
  assert.equal(next.streak, 0);
  assert.deepEqual(next.totals, { solved: 0, lost: 1 });
  assert.equal(next.current!.streakEndedAt, 4, "the reveal can name the ended streak");
});

test("completePuzzle: quitting mid-mystery never touches the streak (engine-level)", () => {
  // The streak moves only through completePuzzle, which the screen calls
  // exactly when submitGuess flips status to won/lost. An abandoned
  // `playing` puzzle leaves the store's streak alone by construction:
  // there is no other writer.
  const store: LoopUnlimitedStore = {
    ...freshLoopUnlimitedStore(10),
    streak: 5,
    current: { ...freshLoopPuzzleState(4, 1), guesses: [], status: "playing" },
  };
  assert.equal(store.streak, 5);
  assert.equal(store.current!.status, "playing");
});

test("writeLoopStoreV2/readLoopStoreV2: round-trip under meridian.loop.v2", () => {
  const data = installStorage();
  const store = completePuzzle(
    { ...freshLoopUnlimitedStore(10), current: freshLoopPuzzleState(2, 1) },
    wonPuzzle(2, 1),
    "2026-10-06",
  );
  writeLoopStoreV2(store);
  assert.ok(data.has(LOOP_STORAGE_KEY_V2), "writes under the v2 namespace");
  assert.deepEqual(readLoopStoreV2(), store);
});

test("readLoopStoreV2: fails closed on malformed storage", () => {
  installStorage({ [LOOP_STORAGE_KEY_V2]: "not json{{" });
  assert.equal(readLoopStoreV2(), null);
  installStorage({ [LOOP_STORAGE_KEY_V2]: JSON.stringify({ deck: "junk" }) });
  assert.equal(readLoopStoreV2(), null);
  installStorage({
    [LOOP_STORAGE_KEY_V2]: JSON.stringify({ ...freshLoopUnlimitedStore(10), streak: -1 }),
  });
  assert.equal(readLoopStoreV2(), null, "negative streak is rejected");
});

test("writeLoopStoreV2: drops invalid shapes, never writes", () => {
  const data = installStorage();
  writeLoopStoreV2({ nope: true } as unknown as LoopUnlimitedStore);
  assert.ok(!data.has(LOOP_STORAGE_KEY_V2));
});

test("loadLoopStore: malformed blob fail-closes to a fresh store", () => {
  installStorage({ [LOOP_STORAGE_KEY_V2]: "garbage" });
  const store = loadLoopStore(387);
  assert.ok(isPermutation(store.deck.deck, 387));
  assert.equal(store.current, null);
  assert.equal(store.streak, 0);
});

test("clampDeckToPoolSize: shrunk pool drops dead indexes and dead currents", () => {
  const store = freshLoopUnlimitedStore(10);
  store.deck.deck.push(10, 11); // stale indexes from a bigger pool
  store.current = freshLoopPuzzleState(12, 1);
  const clamped = clampDeckToPoolSize(store, 10);
  assert.ok(clamped.deck.deck.every((i) => i < 10));
  assert.equal(clamped.current, null, "out-of-range current is abandoned");
});

test("clampDeckToPoolSize: in-range stores pass through untouched", () => {
  const store = freshLoopUnlimitedStore(10);
  store.current = freshLoopPuzzleState(3, 1);
  assert.equal(clampDeckToPoolSize(store, 10), store);
});

test("blocked storage: everything degrades to in-memory, nothing throws", () => {
  installBlockedStorage();
  assert.equal(readLoopStoreV2(), null);
  assert.doesNotThrow(() => writeLoopStoreV2(freshLoopUnlimitedStore(10)));
  // The session still works in memory: deck, deal, complete, streak.
  let store = loadLoopStore(5);
  const dealt = dealPuzzleIndex(store.deck, 5);
  store = { ...store, deck: dealt.deck, current: freshLoopPuzzleState(dealt.index, 1) };
  const finished = { ...store.current!, status: "won" as const, cluesRevealed: 2 };
  store = completePuzzle(store, finished, "2026-10-06");
  assert.equal(store.streak, 1);
  assert.deepEqual(store.totals, { solved: 1, lost: 0 });
});

test("peekLoopProgress: streak + resume flag for the edition card", () => {
  installStorage();
  assert.deepEqual(peekLoopProgress(), { streak: 0, inProgress: false });
  const store: LoopUnlimitedStore = {
    ...freshLoopUnlimitedStore(10),
    streak: 3,
    current: freshLoopPuzzleState(2, 1),
  };
  writeLoopStoreV2(store);
  assert.deepEqual(peekLoopProgress(), { streak: 3, inProgress: true });
  const done: LoopUnlimitedStore = {
    ...store,
    current: { ...store.current!, status: "won", completedAt: "2026-10-06", streakEndedAt: null },
  };
  writeLoopStoreV2(done);
  assert.deepEqual(peekLoopProgress(), { streak: 3, inProgress: false });
});

test("v1 archive is never read, written, or deleted", () => {
  const v1 = JSON.stringify({ "2026-10-01": { guesses: [], status: "won", cluesRevealed: 2 } });
  const data = installStorage({ "meridian.loop.v1": v1 });
  // A full session's worth of v2 operations…
  let store = loadLoopStore(5);
  const dealt = dealPuzzleIndex(store.deck, 5);
  store = { ...store, deck: dealt.deck, current: freshLoopPuzzleState(dealt.index, 1) };
  writeLoopStoreV2(store);
  store = completePuzzle(store, wonPuzzle(dealt.index, 1), "2026-10-06");
  writeLoopStoreV2(store);
  peekLoopProgress();
  // …leaves v1 byte-identical.
  assert.equal(data.get("meridian.loop.v1"), v1);
});

test("isLoopUnlimitedStore: rejects bad puzzle shapes", () => {
  const good = freshLoopUnlimitedStore(10);
  assert.ok(isLoopUnlimitedStore(good));
  assert.ok(!isLoopUnlimitedStore({ ...good, deck: { ...good.deck, deck: [1, -2] } }));
  assert.ok(!isLoopUnlimitedStore({ ...good, current: { ...freshLoopPuzzleState(1, 1), status: "meh" } }));
  assert.ok(
    !isLoopUnlimitedStore({
      ...good,
      current: { ...freshLoopPuzzleState(1, 1), completedAt: "yesterday" },
    }),
  );
});

test("isLoopPuzzleState: guesses cap at 5, coordinates validated", () => {
  const base = freshLoopPuzzleState(1, 1);
  assert.ok(isLoopPuzzleState(base));
  const tooMany = { ...base, guesses: Array.from({ length: 6 }, () => ({ ...base.guesses })) };
  assert.ok(!isLoopPuzzleState(tooMany));
  assert.ok(!isLoopPuzzleState({ ...base, cluesRevealed: 0 }));
  assert.ok(!isLoopPuzzleState({ ...base, completedAt: "2026-13-99" }));
});

test("full session: deal → guesses → win → next deal never repeats in-cycle", () => {
  installStorage();
  const POOL = 8;
  let store = loadLoopStore(POOL);
  const seen: number[] = [];
  for (let round = 0; round < POOL; round++) {
    const dealt = dealPuzzleIndex(store.deck, POOL);
    store = { ...store, deck: dealt.deck, current: freshLoopPuzzleState(dealt.index, store.deck.cycle) };
    seen.push(dealt.index);
    // Two wrong guesses through the real engine, then a win.
    let progress = store.current!;
    for (let g = 0; g < 2; g++) {
      progress = {
        ...progress,
        ...submitGuess(
          progress,
          {
            name: `Wrong ${g}`,
            placeId: `geonames:wrong${g}`,
            distKm: 500,
            octant: "north",
            warmer: g === 0 ? null : false,
            lon: 0,
            lat: 0,
          },
          "geonames:target",
        ),
      };
    }
    const won = { ...progress, status: "won" as const };
    store = completePuzzle(store, won, "2026-10-06");
    writeLoopStoreV2(store);
  }
  assert.ok(isPermutation(seen, POOL), "no repeat within the cycle");
  assert.equal(store.streak, POOL, "consecutive wins build the streak");
  assert.deepEqual(store.totals, { solved: POOL, lost: 0 });
  assert.equal(store.deck.deck.length, 0);
  // The next deal reshuffles silently into cycle 2.
  const next = dealPuzzleIndex(store.deck, POOL);
  assert.equal(next.reshuffled, true);
  assert.equal(next.deck.cycle, 2);
});

test("completePuzzle: last undealt case of the cycle flags completedCycle (fires once)", () => {
  // Deck of one: dealing it empties the deck, so completing it ends the cycle.
  const store: LoopUnlimitedStore = {
    ...freshLoopUnlimitedStore(1),
    streak: 4,
  };
  const dealt = dealPuzzleIndex(store.deck, 1);
  assert.equal(dealt.deck.deck.length, 0);
  const finished = completePuzzle(
    { ...store, deck: dealt.deck },
    wonPuzzle(dealt.index, dealt.deck.cycle),
    "2026-10-06",
  );
  assert.equal(finished.current!.completedCycle, true);
  assert.equal(finished.deck.cycleCompleted, 1);
  // Mid-cycle completion does NOT flag: only the final case carries it.
  const mid = completePuzzle(
    { ...freshLoopUnlimitedStore(10), deck: { deck: [1, 2, 3], cycle: 1, cycleCompleted: 6 } },
    wonPuzzle(0, 1),
    "2026-10-06",
  );
  assert.equal(mid.current!.completedCycle, false);
});

test("completePuzzle: full 387 cycle flags exactly one puzzle", () => {
  let store = freshLoopUnlimitedStore(387);
  let flagged = 0;
  for (let i = 0; i < 387; i++) {
    const dealt = dealPuzzleIndex(store.deck, 387);
    store = { ...store, deck: dealt.deck };
    store = completePuzzle(store, wonPuzzle(dealt.index, dealt.deck.cycle), "2026-10-06");
    if (store.current!.completedCycle) flagged++;
  }
  assert.equal(flagged, 1);
  assert.equal(store.deck.deck.length, 0);
});

test("freshLoopPuzzleState: completedCycle starts false; validator tolerates its absence", () => {
  assert.equal(freshLoopPuzzleState(5, 1).completedCycle, false);
  const legacy = { ...freshLoopPuzzleState(5, 1) };
  delete (legacy as Partial<LoopPuzzleState>).completedCycle;
  assert.equal(isLoopPuzzleState(legacy), true);
  assert.equal(isLoopUnlimitedStore({ ...freshLoopUnlimitedStore(4), current: legacy }), true);
});
