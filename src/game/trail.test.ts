import assert from "node:assert/strict";
import test from "node:test";
import {
  createDealer,
  cycleSeed,
  difficultyWeight,
  memorySeenStore,
  mintSeed,
  poolForNewRun,
  seenStoreFor,
  shufflePlaces,
  weightedShufflePlaces,
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
  const dealt = [dealer.at(0)!.id, dealer.at(1)!.id];
  // A new run builds its pool minus the persisted history: exactly the one
  // unseen place remains (which one depends on the deal order, so this is
  // order-agnostic by design).
  const run2 = poolForNewRun(places, store);
  assert.equal(run2.poolIds.length, 1);
  const pool2 = places.filter((p) => run2.poolIds.includes(p.id));
  const next = createDealer(pool2, 6, store, 0, run2.prevLastId);
  assert.equal(next.at(0)!.id, run2.poolIds[0]);
  assert.ok(!dealt.includes(next.at(0)!.id), "new run must deal the unseen place");
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
    const store = seenStoreFor("globe", "globe", "medium");
    assert.deepEqual(store.read(), []);
    store.write(["x", "y"]);
    // The surviving v1 history is unioned into v2 (not dropped), so today's
    // places keep their no-repeat protection across the upgrade.
    assert.deepEqual(store.read(), ["x", "y", "a", "b"]);
    assert.equal(
      backing.get("meridian:seen:v2:globe:globe:medium"),
      JSON.stringify(["x", "y", "a", "b"]),
    );
    // ...and the legacy v1 keys were pruned after migration.
    assert.ok(
      ![...backing.keys()].some((k) => k.startsWith("meridian:seen:v1:")),
      "legacy v1 keys pruned",
    );
    // A later "day" reads the same persistent history.
    assert.deepEqual(seenStoreFor("globe", "globe", "medium").read(), ["x", "y", "a", "b"]);
    // Other editions/regions are independent.
    assert.deepEqual(seenStoreFor("country", "in", "medium").read(), []);
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

test("v1 migration routes each entry to its own edition/region", () => {
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
    backing.set("meridian:seen:v1:2026-09-30:country:in", JSON.stringify(["mumbai"]));
    backing.set("meridian:seen:v1:not-a-day", JSON.stringify(["junk"]));
    backing.set("meridian:seen:v2:country:in:medium", JSON.stringify(["delhi"]));
    seenStoreFor("globe", "globe", "medium").write(["x"]);
    // country:in's v2 history is the union of its existing v2 ids and the
    // migrated v1 ids; globe's history is untouched.
    assert.deepEqual(seenStoreFor("country", "in", "medium").read(), ["delhi", "mumbai"]);
    assert.deepEqual(seenStoreFor("globe", "globe", "medium").read(), ["x"]);
    assert.ok(
      ![...backing.keys()].some((k) => k.startsWith("meridian:seen:v1:")),
      "legacy v1 keys pruned",
    );
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

test("difficultyWeight maps tiers to weights and defaults missing/invalid difficulty to tier 3", () => {
  assert.equal(difficultyWeight({ difficulty: 1 }), 5);
  assert.equal(difficultyWeight({ difficulty: 2 }), 4);
  assert.equal(difficultyWeight({ difficulty: 3 }), 3);
  assert.equal(difficultyWeight({ difficulty: 4 }), 2);
  assert.equal(difficultyWeight({ difficulty: 5 }), 1);
  // Back-compat: missing or invalid difficulty behaves as tier 3 (w = 3).
  const invalid: { difficulty?: unknown }[] = [
    {},
    { difficulty: undefined },
    { difficulty: null },
    { difficulty: 0 },
    { difficulty: 6 },
    { difficulty: -1 },
    { difficulty: 2.5 },
    { difficulty: "3" },
    { difficulty: NaN },
  ];
  for (const place of invalid) {
    assert.equal(difficultyWeight(place), 3, `place ${JSON.stringify(place)}`);
  }
});

test("weightedShufflePlaces is deterministic and deals each place exactly once", () => {
  const places = [
    { id: "a", difficulty: 1 },
    { id: "b", difficulty: 5 },
    { id: "c" },
    { id: "d", difficulty: 3 },
  ];
  const first = weightedShufflePlaces(places, 42, (p) => difficultyWeight(p));
  const second = weightedShufflePlaces(places, 42, (p) => difficultyWeight(p));
  assert.deepEqual(ids(first), ids(second), "same seed must deal identically");
  // No repeats within a cycle, full coverage per cycle.
  assert.deepEqual(ids(first).sort(), ["a", "b", "c", "d"]);
  assert.equal(new Set(ids(first)).size, 4);
  // Input is not mutated.
  assert.deepEqual(ids(places), ["a", "b", "c", "d"]);
  // Different seeds deal different orders across a seed sweep.
  const orders = new Set<string>();
  for (let seed = 0; seed < 10; seed++) {
    orders.add(ids(weightedShufflePlaces(places, seed, (p) => difficultyWeight(p))).join(","));
  }
  assert.ok(orders.size > 1, "weighted shuffle must vary with the seed");
});

test("weighted dealing skews famous places earlier (statistical, fixed seed set)", () => {
  // 20 tier-1 (weight 5) vs 20 tier-5 (weight 1). Uniform dealing would put
  // ~5 of each in the first 10 positions; the weighted deal must put far
  // more famous places there. Fixed seeds keep this fully deterministic.
  const famous = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, difficulty: 1 }));
  const obscure = Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, difficulty: 5 }));
  const pool = [...famous, ...obscure];
  const SEEDS = 50;
  let famousFirst10 = 0;
  let obscureFirst10 = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const cycle = weightedShufflePlaces(pool, cycleSeed(seed, 0), (p) => difficultyWeight(p));
    assert.equal(new Set(ids(cycle)).size, 40, `seed ${seed}: repeats or missing places`);
    const first10 = cycle.slice(0, 10);
    famousFirst10 += first10.filter((p) => p.id.startsWith("f")).length;
    obscureFirst10 += first10.filter((p) => p.id.startsWith("o")).length;
  }
  const famousAvg = famousFirst10 / SEEDS; // observed 8.1; uniform would be 5.0
  const obscureAvg = obscureFirst10 / SEEDS; // observed 1.9; uniform would be 5.0
  assert.ok(famousAvg >= 6.5, `expected famous-first-10 avg >= 6.5, got ${famousAvg}`);
  assert.ok(obscureAvg <= 3.5, `expected obscure-first-10 avg <= 3.5, got ${obscureAvg}`);
  assert.ok(
    famousAvg >= 2.5 * obscureAvg,
    `expected famous to dominate early positions, got ${famousAvg} vs ${obscureAvg}`,
  );
});

test("same seed yields identical deal order across dealer instances (reload determinism)", () => {
  const places = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    difficulty: (i % 5) + 1,
  }));
  const seed = 20261003;
  const first = createDealer(places, seed, memorySeenStore(), 0, "p7");
  const second = createDealer(places, seed, memorySeenStore(), 0, "p7");
  // Two full cycles, 24 positions: every position must match.
  const orderFirst = Array.from({ length: 24 }, (_, i) => first.at(i)!.id);
  const orderSecond = Array.from({ length: 24 }, (_, i) => second.at(i)!.id);
  assert.deepEqual(orderSecond, orderFirst);
  // No repeats within either cycle and no boundary repeat.
  assert.equal(new Set(orderFirst.slice(0, 12)).size, 12);
  assert.equal(new Set(orderFirst.slice(12, 24)).size, 12);
  assert.notEqual(orderFirst[12], orderFirst[11]);
});

test("weighted cycles never open with the boundary id, even when it is the heaviest place", () => {
  const places = [
    { id: "heavy", difficulty: 1 }, // weight 5: most likely to open the cycle
    ...Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, difficulty: 5 })),
  ];
  for (let seed = 0; seed < 100; seed++) {
    const dealer = createDealer(places, seed, memorySeenStore(), 0, "heavy");
    assert.notEqual(dealer.at(0)!.id, "heavy", `seed ${seed}: boundary repeat`);
    // The boundary swap preserves full coverage: all 10 dealt exactly once.
    const cycle = Array.from({ length: 10 }, (_, i) => dealer.at(i)!.id);
    assert.equal(new Set(cycle).size, 10, `seed ${seed}: coverage broken`);
  }
});

test("pool exhaustion reshuffles all places into a fresh weighted cycle", () => {
  const places = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    difficulty: (i % 5) + 1,
  }));
  const dealer = createDealer(places, 4242, memorySeenStore());
  const cycle0 = Array.from({ length: 6 }, (_, i) => dealer.at(i)!.id);
  dealer.markDealtThrough(5);
  const cycle1 = Array.from({ length: 6 }, (_, i) => dealer.at(6 + i)!.id);
  // Both cycles cover the full pool exactly once...
  assert.deepEqual([...cycle0].sort(), ["p0", "p1", "p2", "p3", "p4", "p5"]);
  assert.deepEqual([...cycle1].sort(), ["p0", "p1", "p2", "p3", "p4", "p5"]);
  // ...the new cycle is a fresh reseed, not a copy of the old order...
  assert.notDeepEqual(cycle1, cycle0);
  // ...and it does not open with the previous cycle's last deal.
  assert.notEqual(cycle1[0], cycle0[5]);
});

test("places without difficulty deal exactly like tier-3 places (back-compat)", () => {
  const plain = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  const asTier3 = plain.map((p) => ({ ...p, difficulty: 3 }));
  for (let seed = 0; seed < 30; seed++) {
    const plainOrder = ids(
      weightedShufflePlaces(plain, cycleSeed(seed, 0), (p) => difficultyWeight(p)),
    );
    const tier3Order = ids(
      weightedShufflePlaces(asTier3, cycleSeed(seed, 0), (p) => difficultyWeight(p)),
    );
    assert.deepEqual(plainOrder, tier3Order, `seed ${seed}`);
  }
});

test("the dealer deals famous places earlier on average (weighted end-to-end)", () => {
  const places = [
    { id: "famous", difficulty: 1 },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, difficulty: 5 })),
  ];
  // Weight 5 vs nine weight-1 places: ~77% chance the famous place lands in
  // the first 3. Uniform dealing would give 30%.
  let earlyCount = 0;
  const SEEDS = 40;
  for (let seed = 0; seed < SEEDS; seed++) {
    const dealer = createDealer(places, seed, memorySeenStore());
    const first3 = [dealer.at(0)!.id, dealer.at(1)!.id, dealer.at(2)!.id];
    if (first3.includes("famous")) earlyCount++;
  }
  assert.ok(
    earlyCount >= 20,
    `expected famous in first 3 for >= 20/40 seeds, got ${earlyCount}`,
  );
});

/** Fake localStorage harness for the band-scoping tests below. */
function withFakeStorage(run: (backing: Map<string, string>) => void): void {
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
    run(backing);
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
}

test("seen history is scoped per difficulty band (no cross-band leakage)", () => {
  withFakeStorage((backing) => {
    seenStoreFor("state", "arkansas", "easy").write(["a", "b"]);
    assert.deepEqual(seenStoreFor("state", "arkansas", "easy").read(), ["a", "b"]);
    assert.deepEqual(seenStoreFor("state", "arkansas", "medium").read(), []);
    assert.deepEqual(seenStoreFor("state", "arkansas", "hard").read(), []);
    assert.equal(
      backing.get("meridian:seen:v2:state:arkansas:easy"),
      JSON.stringify(["a", "b"]),
    );
    // No unscoped key is ever created by the band-scoped stores.
    assert.ok(!backing.has("meridian:seen:v2:state:arkansas"));
  });
});

test("pre-band history migrates lazily into the first touched band and is pruned", () => {
  withFakeStorage((backing) => {
    // The key written by builds before the difficulty picker.
    backing.set("meridian:seen:v2:state:arkansas", JSON.stringify(["x", "y"]));
    const store = seenStoreFor("state", "arkansas", "easy");
    // Migrates on first read...
    assert.deepEqual(store.read(), ["x", "y"]);
    // ...lands under the band key, and the legacy key is pruned.
    assert.equal(
      backing.get("meridian:seen:v2:state:arkansas:easy"),
      JSON.stringify(["x", "y"]),
    );
    assert.ok(!backing.has("meridian:seen:v2:state:arkansas"));
    // A second band starts fresh — the legacy history is claimed once.
    assert.deepEqual(seenStoreFor("state", "arkansas", "medium").read(), []);
    // And a later touch does not resurrect or duplicate anything.
    assert.deepEqual(seenStoreFor("state", "arkansas", "easy").read(), ["x", "y"]);
  });
});

test("one band's dealt history never shrinks another band's pool (repeat-mode regression)", () => {
  withFakeStorage(() => {
    // Overlapping bands, like the real easy(1-2)/medium(2-4) tier bands.
    const easy = [{ id: "e1" }, { id: "e2" }, { id: "e3" }];
    const medium = [{ id: "e2" }, { id: "e3" }, { id: "m1" }, { id: "m2" }];
    const mediumStore = () => seenStoreFor("state", "ark", "medium");
    const easyStore = () => seenStoreFor("state", "ark", "easy");

    // Grind PART of medium (2 of 4 dealt).
    const mRun = poolForNewRun(medium, mediumStore());
    const dealt = medium.filter((p) => mRun.poolIds.includes(p.id));
    const dealer = createDealer(dealt, 7, mediumStore());
    dealer.at(0);
    dealer.at(1);
    dealer.markDealtThrough(1);
    assert.equal(mediumStore().read().length, 2);

    // Opening easy afterwards still sees the WHOLE easy band — medium's
    // history does not shrink it (this was the repeat-mode bug).
    const eRun = poolForNewRun(easy, easyStore());
    assert.deepEqual(
      eRun.poolIds.slice().sort(),
      ["e1", "e2", "e3"],
      "easy pool must stay whole regardless of medium history",
    );

    // Exhaust the easy band: the cycle reset clears ONLY easy's history.
    const eDealer = createDealer(easy, 9, easyStore());
    for (let i = 0; i < 3; i++) eDealer.at(i);
    eDealer.markDealtThrough(2);
    const eRun2 = poolForNewRun(easy, easyStore());
    assert.equal(eRun2.poolIds.length, 3, "easy starts a fresh full cycle");

    // Medium's partial history survived easy's reset untouched.
    const mRun2 = poolForNewRun(medium, mediumStore());
    assert.equal(
      mRun2.poolIds.length,
      2,
      "medium still excludes its 2 dealt places after easy's cycle reset",
    );
  });
});

test("legacy v1 entries route to the medium band and the unscoped key folds in", () => {
  withFakeStorage((backing) => {
    backing.set("meridian:seen:v1:2026-09-30:country:in", JSON.stringify(["mumbai"]));
    backing.set("meridian:seen:v2:country:in", JSON.stringify(["delhi"]));
    // Any write triggers the v1 sweep; v1 lands in the medium band.
    seenStoreFor("globe", "globe", "medium").write(["x"]);
    // Reading the band folds the pre-band unscoped key in after the v1
    // entries arrived, so the order is [v1..., legacy...].
    assert.deepEqual(seenStoreFor("country", "in", "medium").read(), [
      "mumbai",
      "delhi",
    ]);
    assert.ok(!backing.has("meridian:seen:v2:country:in"));
    assert.ok(
      ![...backing.keys()].some((k) => k.startsWith("meridian:seen:v1:")),
      "legacy v1 keys pruned",
    );
  });
});
