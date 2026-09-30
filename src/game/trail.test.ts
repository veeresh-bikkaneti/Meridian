import assert from "node:assert/strict";
import test from "node:test";
import {
  createDealer,
  cycleSeed,
  memorySeenStore,
  mintSeed,
  poolForNewRun,
  seenStoreFor,
  shufflePlaces,
} from "./trail.ts";

const ids = (places: { id: string }[]) => places.map((p) => p.id);

test("shufflePlaces is deterministic per seed and varies by seed", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  assert.deepEqual(ids(shufflePlaces(places, 42)), ids(shufflePlaces(places, 42)));
  assert.notDeepEqual(ids(shufflePlaces(places, 42)), ids(shufflePlaces(places, 43)));
  assert.deepEqual(ids(shufflePlaces(places, 42)).sort(), ["a", "b", "c", "d", "e"]);
  // Input is not mutated.
  assert.deepEqual(ids(places), ["a", "b", "c", "d", "e"]);
});

test("mintSeed returns a uint32-range number", () => {
  for (let i = 0; i < 10; i++) {
    const seed = mintSeed();
    assert.equal(typeof seed, "number");
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 4294967296);
  }
});

test("cycleSeed differs per cycle for a fixed session seed", () => {
  assert.notEqual(cycleSeed(1234, 0), cycleSeed(1234, 1));
  assert.equal(cycleSeed(1234, 0), cycleSeed(1234, 0));
});

test("first question differs across sessions (the 5-restarts symptom)", () => {
  const places = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
  const firsts = new Set<string>();
  // Distinct session seeds, as startRun mints per fresh run.
  for (const seed of [11, 22, 33, 44, 55]) {
    const dealer = createDealer(places, seed, memorySeenStore());
    firsts.add(dealer.at(0)!.id);
  }
  // Five restarts must not all open on the same question.
  assert.ok(firsts.size > 1, `expected varied first questions, got ${[...firsts]}`);
});

test("consecutive cycles deal different orders (per-cycle reseed)", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const dealer = createDealer(places, 777, memorySeenStore());
  const cycle0 = [0, 1, 2, 3].map((i) => dealer.at(i)!.id);
  dealer.markDealtThrough(3);
  const cycle1 = [4, 5, 6, 7].map((i) => dealer.at(i)!.id);
  assert.notDeepEqual(cycle1, cycle0);
  // No repeats until the pool is exhausted: 8 dealt, 4 unique each cycle.
  assert.equal(new Set([...cycle0, ...cycle1]).size, 4);
  assert.equal(new Set(cycle0).size, 4);
  assert.equal(new Set(cycle1).size, 4);
});

test("poolForNewRun excludes the persistent history (cross-day no-repeat)", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const store = memorySeenStore();
  // Simulate a previous run (any day — the date is irrelevant now): a and c
  // were dealt, c most recently.
  store.write(["a", "c"]);
  const { poolIds, prevLastId } = poolForNewRun(places, store);
  assert.deepEqual(poolIds, ["b", "d"]);
  assert.equal(prevLastId, "c");
  const pool = places.filter((p) => poolIds.includes(p.id));
  const dealer = createDealer(pool, 99, store, 0, prevLastId);
  assert.deepEqual(new Set([dealer.at(0)!.id, dealer.at(1)!.id]), new Set(["b", "d"]));
  // Dealing the rest exhausts the run pool; the next cycle resets with a fresh shuffle.
  dealer.markDealtThrough(1);
  const resetCycle = [dealer.at(2)!.id, dealer.at(3)!.id, dealer.at(4)!.id, dealer.at(5)!.id];
  assert.equal(new Set(resetCycle).size, 2);
  assert.deepEqual([...resetCycle].sort(), ["b", "b", "d", "d"]);
});

test("a new run on another day deals only unseen places (persistent history)", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const store = memorySeenStore();
  // Day 1: a fresh history deals the full catalog.
  const day1 = poolForNewRun(places, store);
  assert.deepEqual(day1.poolIds, ["a", "b", "c"]);
  assert.equal(day1.prevLastId, null);
  const dealer1 = createDealer(places, 5, store, 0, day1.prevLastId);
  dealer1.markDealtThrough(1);
  assert.equal(store.read().length, 2);
  const day1Last = dealer1.at(1)!.id;
  // Day 2: same device store, new run, new seed — only the unseen place remains.
  const day2 = poolForNewRun(places, store);
  const dealtDay1 = store.read();
  assert.equal(day2.poolIds.length, 1);
  assert.ok(!dealtDay1.includes(day2.poolIds[0]!));
  assert.equal(day2.prevLastId, day1Last);
  const pool2 = places.filter((p) => day2.poolIds.includes(p.id));
  const dealer2 = createDealer(pool2, 6, store, 0, day2.prevLastId);
  assert.equal(dealer2.at(0)!.id, day2.poolIds[0]);
  // Day 3: everything has been dealt — the cycle completes and resets.
  dealer2.markDealtThrough(0);
  const day3 = poolForNewRun(places, store);
  assert.deepEqual(day3.poolIds, ["a", "b", "c"]);
  assert.deepEqual(store.read(), []);
  assert.equal(day3.prevLastId, day2.poolIds[0]);
});

test("markDealtThrough persists the no-repeat history for future runs", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const store = memorySeenStore();
  const run1 = poolForNewRun(places, store);
  const dealer = createDealer(places, 5, store, 0, run1.prevLastId);
  dealer.markDealtThrough(1);
  assert.equal(store.read().length, 2);
  // A new run builds its pool minus the persisted history.
  const run2 = poolForNewRun(places, store);
  const pool2 = places.filter((p) => run2.poolIds.includes(p.id));
  const next = createDealer(pool2, 6, store, 0, run2.prevLastId);
  assert.equal(next.at(0)!.id, "c");
});

test("startPosition skips re-marking a resumed run's earlier places", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const store = memorySeenStore();
  // Resumed at index 2: positions 0-1 were dealt before the reload.
  const dealer = createDealer(places, 5, store, 2);
  dealer.markDealtThrough(3);
  const seen = store.read();
  assert.ok(!seen.includes(dealer.at(0)!.id), "phantom position 0 must not be marked");
  assert.ok(!seen.includes(dealer.at(1)!.id), "phantom position 1 must not be marked");
  assert.ok(seen.includes(dealer.at(2)!.id));
  assert.ok(seen.includes(dealer.at(3)!.id));
});

test("reload keeps the same order: same pool+seed+startPosition deals identically", () => {
  const places = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
  const store = memorySeenStore();
  const seed = 12345;
  // Pre-reload: deal positions 0..5 and mark them.
  const before = createDealer(places, seed, store, 0);
  const orderBefore = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => before.at(i)!.id);
  before.markDealtThrough(5);
  // Post-reload: same persisted pool and seed, resumed at index 5.
  const after = createDealer(places, seed, store, 5);
  const orderAfter = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => after.at(i)!.id);
  // Every position — dealt or upcoming — maps to the same place.
  assert.deepEqual(orderAfter, orderBefore);
  // The resumed question (index 5) is the same place, not a reshuffle.
  assert.equal(after.at(5)!.id, orderBefore[5]);
});

test("at returns null for an empty pool or a negative position", () => {
  const dealer = createDealer([], 5, memorySeenStore());
  assert.equal(dealer.at(0), null);
  const other = createDealer([{ id: "a" }], 5, memorySeenStore());
  assert.equal(other.at(-1), null);
  assert.equal(other.at(0)!.id, "a");
});

test("resume at a cycle boundary preserves the full no-repeat history", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const store = memorySeenStore();
  const seed = 42;
  // Deal a full cycle (positions 0-3) and mark them.
  const before = createDealer(places, seed, store, 0);
  before.markDealtThrough(3);
  assert.deepEqual(new Set(store.read()), new Set(["a", "b", "c", "d"]));
  // Resume at the cycle boundary (position 4): the store must still hold
  // all 4 ids after marking — the union-write preserves history instead of
  // collapsing it to just the newly dealt ids.
  const after = createDealer(places, seed, store, 4);
  after.markDealtThrough(4);
  assert.deepEqual(new Set(store.read()), new Set(["a", "b", "c", "d", after.at(4)!.id]));
  // And the resumed order matches the pre-reload order.
  const orderBefore = [0, 1, 2, 3, 4, 5].map((i) => before.at(i)!.id);
  const orderAfter = [0, 1, 2, 3, 4, 5].map((i) => after.at(i)!.id);
  assert.deepEqual(orderAfter, orderBefore);
});

test("no immediate repeat across cycle boundaries (in-run property)", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  for (let seed = 0; seed < 50; seed++) {
    const dealer = createDealer(places, seed, memorySeenStore(), 0, null);
    const n = places.length;
    const cycle0 = Array.from({ length: n }, (_, i) => dealer.at(i)!.id);
    const cycle1 = Array.from({ length: n }, (_, i) => dealer.at(n + i)!.id);
    assert.equal(new Set(cycle0).size, n, `seed ${seed}: cycle 0 repeats`);
    assert.equal(new Set(cycle1).size, n, `seed ${seed}: cycle 1 repeats`);
    assert.notEqual(cycle1[0], cycle0[n - 1], `seed ${seed}: boundary repeat`);
  }
});

test("a new cycle never opens with the previous cycle's last deal", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  for (let seed = 0; seed < 50; seed++) {
    for (const prev of ["a", "b", "c"]) {
      const dealer = createDealer(places, seed, memorySeenStore(), 0, prev);
      assert.notEqual(dealer.at(0)!.id, prev, `seed ${seed} prev ${prev}`);
    }
  }
});

test("a two-place pool still avoids the boundary repeat", () => {
  const places = [{ id: "a" }, { id: "b" }];
  const store = memorySeenStore();
  // Run 1 deals everything; run 2 starts a new cycle over the full pool.
  const run1 = poolForNewRun(places, store);
  const d1 = createDealer(places, 11, store, 0, run1.prevLastId);
  d1.markDealtThrough(1);
  const run2 = poolForNewRun(places, store);
  assert.deepEqual(run2.poolIds, ["a", "b"]);
  assert.deepEqual(store.read(), []);
  const d2 = createDealer(places, 22, store, 0, run2.prevLastId);
  assert.notEqual(d2.at(0)!.id, run2.prevLastId);
  d2.markDealtThrough(1);
  assert.deepEqual(new Set([d2.at(0)!.id, d2.at(1)!.id]), new Set(["a", "b"]));
});

test("reload with a boundary id keeps the identical deal order", () => {
  const places = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
  const store = memorySeenStore();
  const seed = 999;
  // Previous cycle's last deal, from a pool that is not this run's pool.
  const prevLastId = "zzz";
  const before = createDealer(places, seed, store, 0, prevLastId);
  // Mirror the app: deal position i, then mark through i.
  const dealt: string[] = [];
  for (let i = 0; i <= 9; i++) {
    dealt.push(before.at(i)!.id);
    before.markDealtThrough(i);
  }
  // Reload at index 7: positions 0..6 were dealt and marked, 7 is current.
  // (Positions 8..9 were dealt pre-reload to lock the expected order.)
  const after = createDealer(places, seed, store, 7, prevLastId);
  const resumed: string[] = [];
  for (let i = 7; i <= 9; i++) {
    resumed.push(after.at(i)!.id);
    after.markDealtThrough(i);
  }
  assert.deepEqual(resumed, dealt.slice(7));
  // Sanity: the pre-reload order is deterministic for the same inputs.
  const check = createDealer(places, seed, memorySeenStore(), 0, prevLastId);
  assert.deepEqual(
    dealt.slice(0, 7),
    [0, 1, 2, 3, 4, 5, 6].map((i) => check.at(i)!.id),
  );
});

test("seenStoreFor uses a day-independent key and migrates v1 entries", () => {
  const backing = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    get length() {
      return backing.size;
    },
    key: (i: number) => [...backing.keys()][i] ?? null,
  };
  const g = globalThis as { localStorage?: unknown };
  const prev = g.localStorage;
  g.localStorage = fakeStorage;
  try {
    // Legacy v1 day-keyed entries from the old per-day scheme.
    backing.set("meridian:seen:v1:2026-09-29:globe:globe", JSON.stringify(["a"]));
    backing.set("meridian:seen:v1:2026-09-30:globe:globe", JSON.stringify(["b"]));
    const store = seenStoreFor("globe", "globe");
    assert.deepEqual(store.read(), []);
    store.write(["x", "y"]);
    assert.deepEqual(store.read(), ["x", "y"]);
    // The v2 key carries no day...
    assert.equal(backing.get("meridian:seen:v2:globe:globe"), JSON.stringify(["x", "y"]));
    // ...and the legacy v1 keys were pruned on write.
    assert.ok(
      ![...backing.keys()].some((k) => k.startsWith("meridian:seen:v1:")),
      "legacy v1 keys pruned",
    );
    // A later "day" reads the same persistent history.
    assert.deepEqual(seenStoreFor("globe", "globe").read(), ["x", "y"]);
    // Other editions/regions are independent.
    assert.deepEqual(seenStoreFor("country", "in").read(), []);
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

test("poolForNewRun on an empty catalog yields an empty pool (fail closed)", () => {
  const { poolIds, prevLastId } = poolForNewRun([], memorySeenStore());
  assert.deepEqual(poolIds, []);
  assert.equal(prevLastId, null);
  assert.equal(createDealer([], 5, memorySeenStore()).at(0), null);
});
