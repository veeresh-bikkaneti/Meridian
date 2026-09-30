import assert from "node:assert/strict";
import test from "node:test";
import {
  createDealer,
  cycleSeed,
  memorySeenStore,
  mintSeed,
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

test("a pre-filtered pool excludes the day's seen history (cross-session no-repeat)", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const store = memorySeenStore();
  store.write(["a", "c"]);
  // The session pool is computed once at session start (catalog minus the
  // day's seen history) and handed to the dealer pre-filtered.
  const pool = places.filter((p) => !store.read().includes(p.id));
  const dealer = createDealer(pool, 99, store);
  assert.deepEqual(new Set([dealer.at(0)!.id, dealer.at(1)!.id]), new Set(["b", "d"]));
  // Dealing the rest exhausts the pool; the next cycle resets with a fresh shuffle.
  dealer.markDealtThrough(1);
  const resetCycle = [dealer.at(2)!.id, dealer.at(3)!.id, dealer.at(4)!.id, dealer.at(5)!.id];
  assert.equal(new Set(resetCycle).size, 2);
  assert.deepEqual([...resetCycle].sort(), ["b", "b", "d", "d"]);
});

test("markDealtThrough persists the no-repeat history for future sessions", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const store = memorySeenStore();
  const dealer = createDealer(places, 5, store);
  dealer.markDealtThrough(1);
  assert.equal(store.read().length, 2);
  // A new session (same day) builds its pool minus the persisted history.
  const seen = new Set(store.read());
  const nextPool = places.filter((p) => !seen.has(p.id));
  const next = createDealer(nextPool, 6, store);
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
