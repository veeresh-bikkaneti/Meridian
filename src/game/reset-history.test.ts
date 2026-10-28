import assert from "node:assert/strict";
import test from "node:test";
import { resetHistory } from "./reset-history.ts";
import { readReviewDeck, deckCounts, REVIEW_DECK_STORE_KEY } from "./review-deck.ts";
import { LEARNING_STORE_KEY } from "./learning.ts";
import { seenStoreFor } from "./trail.ts";
import { loadColdtrail } from "./coldtrail/store.ts";
import { STARTING_STARS } from "./coldtrail/engine.ts";

/**
 * Unit tests for the "Start over" reset (manifest 2026-10-28, §6):
 * U-R1 master sentinel, U-R2 idempotence, U-R3/U-R4 throwing storage,
 * U-R5 per-store isolation, U-R6 injected storage only, U-R7 open flags,
 * U-R8 legacy-key resurrection guards.
 *
 * Every test pairs positive assertions (a cleared key is gone) with
 * negative ones (kept / foreign keys byte-identical) — a reset that
 * deletes too much is as much a failure as one that deletes too little.
 */

/** In-memory Storage stand-in with failure knobs for the U-R3/U-R4/U-R5 cases. */
class FakeStorage {
  data = new Map<string, string>();
  failRemove = new Set<string>();
  failSet = new Set<string>();
  throwEnumerate = false;
  getItem = (k: string): string | null => (this.data.has(k) ? this.data.get(k)! : null);
  setItem = (k: string, v: string): void => {
    if (this.failSet.has(k)) throw new Error("set blocked");
    this.data.set(k, String(v));
  };
  removeItem = (k: string): void => {
    if (this.failRemove.has(k)) throw new Error("remove blocked");
    this.data.delete(k);
  };
  get length(): number {
    if (this.throwEnumerate) throw new Error("enumerate blocked");
    return this.data.size;
  }
  key = (i: number): string | null => {
    if (this.throwEnumerate) throw new Error("enumerate blocked");
    return [...this.data.keys()][i] ?? null;
  };
}

const DECK_JSON = JSON.stringify({
  v: 1,
  entries: {
    lincoln: {
      v: 1,
      place: {
        id: "lincoln",
        name: "Lincoln",
        lon: -96.7,
        lat: 40.83,
        story: "A test story.",
        difficulty: 2,
        edition: "state",
        regionId: "nebraska",
        regionName: "Nebraska",
        sourceLabel: "Test",
        sourceHref: "https://example.com",
        mapMode: "flat",
        radiusKm: 75,
      },
      streak: 0,
      nextDueAt: 0,
      lastReviewedAt: 0,
      reviews: 0,
    },
  },
});

const LEARNING_JSON = JSON.stringify({
  v: 1,
  records: {
    lincoln: {
      v: 1,
      placeId: "lincoln",
      attempts: [
        { at: 1, hit: false, distanceKm: 90, radiusKm: 75, edition: "state", regionId: "nebraska", score: 0 },
      ],
    },
  },
  regionNames: { nebraska: "Nebraska" },
  daysPlayed: ["2026-10-28"],
});

const LOOP_JSON = JSON.stringify({
  deck: { deck: [3, 1], cycle: 1, cycleCompleted: 0 },
  current: null,
  streak: 3,
  bestStreak: 5,
  totals: { solved: 4, lost: 1 },
});

const COLDTRAIL_V2_JSON = JSON.stringify({ v: 2, caseIndex: 3, stars: 7, solved: 2, current: null });
const COLDTRAIL_V1_JSON = JSON.stringify({ v: 1, caseIndex: 2, stars: 9, solved: 3 });

/** Every CLEARED localStorage key from manifest §2. */
const CLEARED_LOCAL: Record<string, string> = {
  [REVIEW_DECK_STORE_KEY]: DECK_JSON,
  [LEARNING_STORE_KEY]: LEARNING_JSON,
  "meridian:seen:v2:globe:globe:medium": '["a","b"]',
  "meridian:seen:v2:state:nebraska:easy": '["c"]',
  // Legacy unscoped v2 key (pre-band builds).
  "meridian:seen:v2:globe:globe": '["old"]',
  "meridian:seen:v1:2026-10-01:globe:globe": '["v1a"]',
  "meridian:seen:v1:2026-10-02:state:nebraska": '["v1b"]',
  "meridian:cleared:v1:globe:globe:medium": "1",
  "meridian:cleared:v1:state:nebraska:easy": "1",
  "meridian.loop.v2": LOOP_JSON,
  "meridian.loop.open": "1",
  "meridian.coldtrail.v1": COLDTRAIL_V1_JSON,
  "meridian.coldtrail.v2": COLDTRAIL_V2_JSON,
  "meridian.coldtrail.open": "1",
};

/** Every KEPT localStorage key from manifest §2 plus near-miss foreign keys. */
const KEPT_LOCAL: Record<string, string> = {
  "meridian.passport.badges.v1": '[{"id":"clean-round","earnedAt":"2026-10-09T12:00:00.000Z","schemaVersion":1}]',
  "meridian.firstWinCelebrated": "1",
  "meridian.loop.v1": '{"archive":true}',
  "meridian.palette": "high-contrast",
  "meridian.sound": "off",
  "meridian.ageProfile.v1": '{"status":"active","band":"8-10"}',
  "meridian:map-mode": "scout",
  "meridian.difficulty": "hard",
  // Near-miss foreign keys: same family, wrong version — never ours.
  "meridian:seen:v3:globe:globe:medium": '["x"]',
  "meridian:cleared:v2:globe:globe:medium": "1",
  "meridian.loop.v3": "{}",
  "meridian:review-deck:v2": "{}",
  "meridian.coldtrail.v3": "{}",
  "meridian:learning:v2": "{}",
  "other-app:thing": "keep me",
};

const CLEARED_SESSION: Record<string, string> = {
  "meridian.session": '{"id":"s1","totalScore":500}',
  "meridian.run": '{"edition":"globe"}',
  "meridian.drop": '{"placeId":"lincoln"}',
};

const KEPT_SESSION: Record<string, string> = {
  "meridian.staleRefresh": "1",
  "other-app:session": "keep me",
};

function seedAll(local: FakeStorage, session: FakeStorage): void {
  // Interleave cleared and kept keys: the trail sweep must pick its own
  // keys out of a mixed keyspace, not a tidy block of targets.
  const cleared = Object.entries(CLEARED_LOCAL);
  const kept = Object.entries(KEPT_LOCAL);
  const n = Math.max(cleared.length, kept.length);
  for (let i = 0; i < n; i++) {
    if (kept[i]) local.data.set(kept[i]![0], kept[i]![1]);
    if (cleared[i]) local.data.set(cleared[i]![0], cleared[i]![1]);
  }
  for (const [k, v] of Object.entries(CLEARED_SESSION)) session.data.set(k, v);
  for (const [k, v] of Object.entries(KEPT_SESSION)) session.data.set(k, v);
}

function assertCleared(local: FakeStorage, session: FakeStorage): void {
  for (const k of Object.keys(CLEARED_LOCAL)) {
    assert.equal(local.getItem(k), null, `cleared key still present: ${k}`);
  }
  for (const k of Object.keys(CLEARED_SESSION)) {
    assert.equal(session.getItem(k), null, `cleared session key still present: ${k}`);
  }
}

function assertKept(local: FakeStorage, session: FakeStorage): void {
  for (const [k, v] of Object.entries(KEPT_LOCAL)) {
    assert.equal(local.getItem(k), v, `kept key changed: ${k}`);
  }
  for (const [k, v] of Object.entries(KEPT_SESSION)) {
    assert.equal(session.getItem(k), v, `kept session key changed: ${k}`);
  }
}

test("U-R1 master sentinel: every cleared key gone, every kept key byte-identical", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  const result = resetHistory(local, session);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(
    [...result.cleared].sort(),
    ["coldtrail", "geodetective", "learning", "paused-run", "review-deck", "session", "trail"],
  );
  assertCleared(local, session);
  assertKept(local, session);
});

test("U-R2: a second reset is a no-op and still reports success", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  const first = resetHistory(local, session);
  assert.deepEqual(first.failed, []);
  const second = resetHistory(local, session);
  assert.deepEqual(second.failed, []);
  assert.equal(second.cleared.length, first.cleared.length);
  assertCleared(local, session);
  assertKept(local, session);
});

test("U-R3: throwing removeItem falls back to overwriting the empty value", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  // The deck key refuses removal but accepts writes: the reset must
  // overwrite it with the empty deck instead of failing or throwing.
  local.failRemove.add(REVIEW_DECK_STORE_KEY);
  session.failRemove.add("meridian.session");
  let result: ReturnType<typeof resetHistory> | undefined;
  assert.doesNotThrow(() => {
    result = resetHistory(local, session);
  });
  assert.deepEqual(result!.failed, []);
  const deck = readReviewDeck(local) ?? { v: 1 as const, entries: {} };
  assert.equal(deckCounts(deck).total, 0, "deck reads empty after the overwrite fallback");
  assert.equal(session.getItem("meridian.session"), "", "session overwritten with the unset value");
  assertKept(local, session);
});

test("U-R4: throwing enumeration fails only the trail store, never throws", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  local.throwEnumerate = true;
  let result: ReturnType<typeof resetHistory> | undefined;
  assert.doesNotThrow(() => {
    result = resetHistory(local, session);
  });
  assert.deepEqual(result!.failed, [{ store: "trail" }]);
  // The other stores still cleared.
  assert.equal(local.getItem(REVIEW_DECK_STORE_KEY), null);
  assert.equal(local.getItem("meridian.loop.v2"), null);
  assert.equal(session.getItem("meridian.session"), null);
  assertKept(local, session);
});

test("U-R5: one blocked store does not abort the others", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  // Cold Trail's v2 key can neither be removed nor overwritten.
  local.failRemove.add("meridian.coldtrail.v2");
  local.failSet.add("meridian.coldtrail.v2");
  const result = resetHistory(local, session);
  assert.deepEqual(result.failed, [{ store: "coldtrail" }]);
  assert.equal(local.getItem("meridian.coldtrail.v2"), COLDTRAIL_V2_JSON, "blocked store left as-is");
  // Everything else cleared, including Cold Trail's own legacy key
  // (removed before v2 was attempted) and open flag.
  assert.equal(local.getItem("meridian.coldtrail.v1"), null);
  assert.equal(local.getItem("meridian.coldtrail.open"), null);
  assert.equal(local.getItem(REVIEW_DECK_STORE_KEY), null);
  assert.equal(local.getItem("meridian.loop.v2"), null);
  assert.equal(session.getItem("meridian.run"), null);
  assertKept(local, session);
});

test("U-R6: injected storage is honoured — the globals are never touched", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  seedAll(local, session);
  const globalLocal = new FakeStorage();
  const globalSession = new FakeStorage();
  globalLocal.data.set(REVIEW_DECK_STORE_KEY, DECK_JSON);
  globalSession.data.set("meridian.session", '{"id":"global"}');
  const g = globalThis as Record<string, unknown>;
  const prevLocal = g.localStorage;
  const prevSession = g.sessionStorage;
  g.localStorage = globalLocal;
  g.sessionStorage = globalSession;
  try {
    const result = resetHistory(local, session);
    assert.deepEqual(result.failed, []);
    assertCleared(local, session);
    // The global stores keep their data byte-identical.
    assert.equal(globalLocal.getItem(REVIEW_DECK_STORE_KEY), DECK_JSON);
    assert.equal(globalSession.getItem("meridian.session"), '{"id":"global"}');
  } finally {
    if (prevLocal === undefined) delete g.localStorage;
    else g.localStorage = prevLocal;
    if (prevSession === undefined) delete g.sessionStorage;
    else g.sessionStorage = prevSession;
  }
});

test("U-R7: the loop and coldtrail open flags are removed", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  local.data.set("meridian.loop.open", "1");
  local.data.set("meridian.coldtrail.open", "1");
  const result = resetHistory(local, session);
  assert.deepEqual(result.failed, []);
  assert.equal(local.getItem("meridian.loop.open"), null);
  assert.equal(local.getItem("meridian.coldtrail.open"), null);
  assert.ok(result.cleared.includes("geodetective"));
  assert.ok(result.cleared.includes("coldtrail"));
});

test("U-R8: coldtrail v1-only seed cannot resurrect after reset", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  local.data.set("meridian.coldtrail.v1", COLDTRAIL_V1_JSON);
  const g = globalThis as Record<string, unknown>;
  const prev = g.localStorage;
  g.localStorage = local;
  try {
    const result = resetHistory(local, session);
    assert.deepEqual(result.failed, []);
    assert.equal(local.getItem("meridian.coldtrail.v1"), null);
    assert.equal(local.getItem("meridian.coldtrail.v2"), null);
    // The loader must see a fresh wallet, not the migrated legacy one.
    const loaded = loadColdtrail();
    assert.equal(loaded.caseIndex, 0);
    assert.equal(loaded.stars, STARTING_STARS);
    assert.equal(loaded.solved, 0);
    assert.equal(loaded.current, null);
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

test("U-R8: trail v1-only seen keys cannot resurrect after reset", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  local.data.set("meridian:seen:v1:2026-10-01:globe:globe", '["v1a"]');
  const g = globalThis as Record<string, unknown>;
  const prev = g.localStorage;
  g.localStorage = local;
  try {
    const result = resetHistory(local, session);
    assert.deepEqual(result.failed, []);
    assert.equal(local.getItem("meridian:seen:v1:2026-10-01:globe:globe"), null);
    // Reading the band store must not fold the legacy ids back in.
    assert.deepEqual(seenStoreFor("globe", "globe", "medium").read(), []);
    assert.ok(
      ![...local.data.keys()].some((k) => k.startsWith("meridian:seen:")),
      "no seen key of any generation survives",
    );
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

test("resetHistory with no storage at all never throws", () => {
  const g = globalThis as Record<string, unknown>;
  const prevLocal = g.localStorage;
  const prevSession = g.sessionStorage;
  delete g.localStorage;
  delete g.sessionStorage;
  try {
    let result: ReturnType<typeof resetHistory> | undefined;
    assert.doesNotThrow(() => {
      result = resetHistory();
    });
    // Nothing is persisted anywhere, so nothing can have failed.
    assert.deepEqual(result!.failed, []);
  } finally {
    if (prevLocal !== undefined) g.localStorage = prevLocal;
    if (prevSession !== undefined) g.sessionStorage = prevSession;
  }
});
