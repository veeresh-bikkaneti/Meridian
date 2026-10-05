import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  freshLoopDayState,
  getDayState,
  readLoopStore,
  saveDayState,
  writeLoopStore,
} from "./store.ts";
import { LOOP_MAX_GUESSES, LOOP_STORAGE_KEY } from "./types.ts";
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

function dayKey(daysAgo: number, now = new Date()): string {
  return new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
}

test("freshLoopDayState: empty, playing, one clue", () => {
  assert.deepEqual(freshLoopDayState(), {
    guesses: [],
    status: "playing",
    cluesRevealed: 1,
  });
});

test("saveDayState/getDayState round-trip under meridian.loop.v1", () => {
  const data = installStorage();
  const state = submitGuess(freshLoopDayState(), {
    name: "Paris",
    placeId: "geonames:2988507",
    distKm: 42,
    octant: "north-east",
    warmer: null,
  }, "other");
  saveDayState("2026-10-02", state);
  assert.ok(data.has(LOOP_STORAGE_KEY), "writes under the Loop namespace");
  assert.deepEqual(getDayState("2026-10-02"), state);
});

test("getDayState: unknown day starts fresh (day rollover archives)", () => {
  installStorage();
  saveDayState("2026-10-01", submitGuess(freshLoopDayState(), {
    name: "Paris",
    placeId: "geonames:2988507",
    distKm: 42,
    octant: "north",
    warmer: null,
  }, "other"));
  // Yesterday's state is still archived…
  assert.equal(getDayState("2026-10-01").guesses.length, 1);
  // …while today starts fresh.
  assert.deepEqual(getDayState("2026-10-02"), freshLoopDayState());
});

test("readLoopStore: fails closed on malformed storage", () => {
  installStorage({ [LOOP_STORAGE_KEY]: "not json{{" });
  assert.deepEqual(readLoopStore(), {});
  installStorage({ [LOOP_STORAGE_KEY]: JSON.stringify({ "2026-10-02": { guesses: "junk" } }) });
  assert.deepEqual(getDayState("2026-10-02"), freshLoopDayState());
  installStorage({ [LOOP_STORAGE_KEY]: JSON.stringify({ "not-a-date": freshLoopDayState() }) });
  assert.deepEqual(readLoopStore(), {}, "non-date keys are dropped");
});

test("writeLoopStore: prunes to the last 30 days", () => {
  installStorage();
  const now = new Date();
  const store: Record<string, ReturnType<typeof freshLoopDayState>> = {};
  for (let ago = 0; ago < 45; ago++) store[dayKey(ago, now)] = freshLoopDayState();
  writeLoopStore(store, now);
  const pruned = readLoopStore();
  const keys = Object.keys(pruned).sort();
  assert.ok(keys.length <= 30, `expected <=30 keys, got ${keys.length}`);
  assert.ok(keys.includes(dayKey(0, now)), "today survives pruning");
  assert.ok(keys.includes(dayKey(29, now)), "day 29 survives pruning");
  assert.ok(!keys.includes(dayKey(30, now)), "day 30 is pruned");
  assert.ok(!keys.includes(dayKey(44, now)), "day 44 is pruned");
});

test("saveDayState: never touches the endless-run keys", () => {
  const data = installStorage({
    "meridian.run": "run-data",
    "meridian.drop": "drop-data",
  });
  saveDayState("2026-10-02", freshLoopDayState());
  assert.equal(data.get("meridian.run"), "run-data");
  assert.equal(data.get("meridian.drop"), "drop-data");
});

test("saveDayState: invalid states are dropped, never written", () => {
  const data = installStorage();
  saveDayState("2026-10-02", {
    guesses: [],
    status: "playing",
    cluesRevealed: LOOP_MAX_GUESSES + 1,
  });
  assert.ok(!data.has(LOOP_STORAGE_KEY));
  saveDayState("bogus", freshLoopDayState());
  assert.ok(!data.has(LOOP_STORAGE_KEY));
});
