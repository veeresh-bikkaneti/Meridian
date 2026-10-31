import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_ATTEMPTS_CAP,
  CHALLENGE_ATTEMPTS_KEY,
  challengeRouteTuple,
  clearChallengeAttempts,
  readRouteAttempts,
  recordRouteCompletion,
} from "./challenge-attempts.ts";

/** In-memory StorageLike stub (the house pattern for store tests). */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const TUPLE = challengeRouteTuple({
  scoringVersion: 3,
  edition: "state",
  regionId: "nebraska",
  ids: ["gn-1", "gn-2", "gn-3", "gn-4", "gn-5"],
});

test("attempts tuple: canonical s|edition|region|ordered ids form (§Q2-B3)", () => {
  assert.equal(TUPLE, "3|state|nebraska|gn-1,gn-2,gn-3,gn-4,gn-5");
  // Order is part of the identity: the same places dealt differently
  // are a different route.
  const reordered = challengeRouteTuple({
    scoringVersion: 3,
    edition: "state",
    regionId: "nebraska",
    ids: ["gn-2", "gn-1", "gn-3", "gn-4", "gn-5"],
  });
  assert.notEqual(reordered, TUPLE);
});

test("attempts store: record returns stored+1, read agrees, tuples are independent", () => {
  const s = memoryStorage();
  assert.equal(readRouteAttempts(TUPLE, s), 0);
  assert.equal(recordRouteCompletion(TUPLE, s), 1);
  assert.equal(recordRouteCompletion(TUPLE, s), 2);
  assert.equal(readRouteAttempts(TUPLE, s), 2);
  const other = challengeRouteTuple({
    scoringVersion: 3, edition: "country", regionId: "france",
    ids: ["gn-1", "gn-2", "gn-3", "gn-4", "gn-5"],
  });
  assert.equal(readRouteAttempts(other, s), 0);
  assert.equal(recordRouteCompletion(other, s), 1);
  assert.equal(readRouteAttempts(TUPLE, s), 2);
});

test("attempts store: LRU cap evicts the least-recently-completed route", () => {
  const s = memoryStorage();
  const tuples: string[] = [];
  for (let i = 0; i < CHALLENGE_ATTEMPTS_CAP + 3; i++) {
    const t = `3|state|nebraska|gn-${i}`;
    tuples.push(t);
    recordRouteCompletion(t, s);
  }
  // The first three fell off; the newest stands.
  assert.equal(readRouteAttempts(tuples[0]!, s), 0);
  assert.equal(readRouteAttempts(tuples[2]!, s), 0);
  assert.equal(readRouteAttempts(tuples[3]!, s), 1);
  assert.equal(readRouteAttempts(tuples[tuples.length - 1]!, s), 1);
  // Re-completing an old survivor refreshes its recency: it survives
  // the next eviction round while a fresher-but-untouched one goes.
  const survivor = tuples[3]!;
  recordRouteCompletion(survivor, s);
  recordRouteCompletion("3|state|nebraska|gn-new", s);
  assert.equal(readRouteAttempts(survivor, s), 2);
  assert.equal(readRouteAttempts(tuples[4]!, s), 0);
});

test("attempts store: malformed data reads as empty, never throws", () => {
  const s = memoryStorage();
  s.map.set(CHALLENGE_ATTEMPTS_KEY, "{not json");
  assert.equal(readRouteAttempts(TUPLE, s), 0);
  s.map.set(CHALLENGE_ATTEMPTS_KEY, JSON.stringify({ counts: { [TUPLE]: 1.5 }, order: [TUPLE] }));
  assert.equal(readRouteAttempts(TUPLE, s), 0, "non-integer counts are dropped");
  s.map.set(CHALLENGE_ATTEMPTS_KEY, JSON.stringify({ counts: { [TUPLE]: 4 }, order: "nope" }));
  assert.equal(readRouteAttempts(TUPLE, s), 0, "a non-array order invalidates the doc");
  assert.equal(recordRouteCompletion(TUPLE, s), 1, "recording recovers onto a clean doc");
});

test("attempts store: clear removes everything and reports true", () => {
  const s = memoryStorage();
  recordRouteCompletion(TUPLE, s);
  recordRouteCompletion(TUPLE, s);
  assert.equal(clearChallengeAttempts(s), true);
  assert.equal(readRouteAttempts(TUPLE, s), 0);
  assert.equal(s.map.has(CHALLENGE_ATTEMPTS_KEY), false);
});
