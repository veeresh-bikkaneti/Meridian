import assert from "node:assert/strict";
import test from "node:test";
import {
  LEARNING_COPY,
  LEARNING_SCHEMA_VERSION,
  LEARNING_STORE_KEY,
  MAX_ATTEMPTS_PER_PLACE,
  MAX_DAYS_PLAYED,
  MAX_PLACE_RECORDS,
  clearLearningStore,
  emptyLearningStore,
  engagement,
  errorTrendByRegion,
  growthLineFor,
  growthSummary,
  learningDateKey,
  parseLearningStore,
  placeMastery,
  readLearningStore,
  recordAnswer,
  retentionRate,
  writeLearningStore,
  type LearningAttempt,
  type LearningStore,
  type RecordLearningInput,
} from "./learning.ts";

/**
 * Unit tests for the learning-outcomes module (docs/learning-outcomes.md):
 * mastery computation incl. the 50%-radius confidence rule, the growth-line
 * copy bank, record persistence + migration + LRU eviction + corrupt-payload
 * fail-closed, the M1/M3/M4 metrics, and the non-interference contract
 * (the module never touches dealing/scoring/session storage).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0); // 2026-10-03, a Saturday

function attempt(over: Partial<LearningAttempt> = {}): LearningAttempt {
  return {
    at: NOW,
    hit: false,
    distanceKm: 100,
    radiusKm: 200,
    edition: "globe",
    regionId: "world",
    score: 0,
    ...over,
  };
}

function input(over: Partial<RecordLearningInput> = {}): RecordLearningInput {
  return {
    placeId: "place-1",
    edition: "globe",
    regionId: "world",
    regionName: "World",
    distanceKm: 100,
    radiusKm: 200,
    hit: false,
    score: 0,
    at: NOW,
    ...over,
  };
}

/** In-memory Storage stand-in that also logs every key touched. */
function fakeStorage() {
  const data = new Map<string, string>();
  const reads: string[] = [];
  const writes: string[] = [];
  return {
    reads,
    writes,
    data,
    getItem: (k: string) => {
      reads.push(k);
      return data.has(k) ? data.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      writes.push(k);
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

// ---------------------------------------------------------------------------
// Mastery (§3)
// ---------------------------------------------------------------------------

test("placeMastery: no attempts → none", () => {
  assert.equal(placeMastery([]), "none");
});

test("placeMastery: one hit → explored, not mastered", () => {
  assert.equal(placeMastery([attempt({ hit: true, distanceKm: 10 })]), "explored");
});

test("placeMastery: two confident hits in a row → mastered (50%-radius rule)", () => {
  const attempts = [
    attempt({ hit: true, distanceKm: 40, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 100, radiusKm: 200 }), // exactly 50% → confident
  ];
  assert.equal(placeMastery(attempts), "mastered");
});

test("placeMastery: two hits but latest is an edge-of-ring graze → not mastered", () => {
  const attempts = [
    attempt({ hit: true, distanceKm: 40, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 150, radiusKm: 200 }), // 75% of radius: a graze
  ];
  assert.equal(placeMastery(attempts), "explored");
});

test("placeMastery: confidence is judged against the latest attempt's own radius", () => {
  const attempts = [
    attempt({ hit: true, distanceKm: 10, radiusKm: 50 }),
    attempt({ hit: true, distanceKm: 40, radiusKm: 200 }), // 20% of its own 200 km radius
  ];
  assert.equal(placeMastery(attempts), "mastered");
});

test("placeMastery: hit then miss → explored (no two-in-a-row)", () => {
  assert.equal(
    placeMastery([
      attempt({ hit: true, distanceKm: 10 }),
      attempt({ hit: false, distanceKm: 300 }),
    ]),
    "explored",
  );
});

test("placeMastery: miss then closer miss → growing", () => {
  assert.equal(
    placeMastery([
      attempt({ hit: false, distanceKm: 400 }),
      attempt({ hit: false, distanceKm: 200 }),
    ]),
    "growing",
  );
});

test("placeMastery: miss then farther miss → explored", () => {
  assert.equal(
    placeMastery([
      attempt({ hit: false, distanceKm: 200 }),
      attempt({ hit: false, distanceKm: 400 }),
    ]),
    "explored",
  );
});

test("placeMastery: only the two most recent attempts matter", () => {
  // Would-be-mastered pair is not the latest pair → not mastered.
  const attempts = [
    attempt({ hit: true, distanceKm: 10, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 20, radiusKm: 200 }),
    attempt({ hit: false, distanceKm: 500 }),
  ];
  assert.equal(placeMastery(attempts), "explored");
});

// ---------------------------------------------------------------------------
// Growth line (§5.2 copy bank)
// ---------------------------------------------------------------------------

test("growthLineFor: no attempts → null (no line)", () => {
  assert.equal(growthLineFor([]), null);
});

test("growthLineFor: first encounter hit/miss", () => {
  assert.equal(growthLineFor([attempt({ hit: true, distanceKm: 5 })]), LEARNING_COPY.firstHit);
  assert.equal(growthLineFor([attempt({ hit: false })]), LEARNING_COPY.firstMiss);
});

test("growthLineFor: newly mastered wins over other classifications", () => {
  const attempts = [
    attempt({ hit: false, distanceKm: 400 }),
    attempt({ hit: true, distanceKm: 60, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 50, radiusKm: 200, at: NOW + 1 }),
  ];
  assert.equal(growthLineFor(attempts), LEARNING_COPY.mastered);
});

test("growthLineFor: already mastered before → falls through to improvement wording", () => {
  const attempts = [
    attempt({ hit: true, distanceKm: 60, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 50, radiusKm: 200 }),
    attempt({ hit: true, distanceKm: 40, radiusKm: 200, at: NOW + 1 }),
  ];
  // Still mastered, not newly: latest is closer than the previous attempt.
  assert.equal(growthLineFor(attempts), LEARNING_COPY.closer);
});

test("growthLineFor: hit after a miss → remembered", () => {
  const attempts = [
    attempt({ hit: false, distanceKm: 400 }),
    attempt({ hit: true, distanceKm: 120, radiusKm: 200 }), // not confident → not mastered
  ];
  assert.equal(growthLineFor(attempts), LEARNING_COPY.remembered);
});

test("growthLineFor: closer miss than last time → encouragement", () => {
  const attempts = [
    attempt({ hit: false, distanceKm: 400 }),
    attempt({ hit: false, distanceKm: 250 }),
  ];
  assert.equal(growthLineFor(attempts), LEARNING_COPY.closer);
});

test("growthLineFor: not improved → kind, never shaming", () => {
  const attempts = [
    attempt({ hit: false, distanceKm: 200 }),
    attempt({ hit: false, distanceKm: 400 }),
  ];
  assert.equal(growthLineFor(attempts), LEARNING_COPY.tricky);
});

test("growthLineFor: all shipped lines are kid-friendly (banned tone absent)", () => {
  const banned = ["crushed", "destroyed", "noob", "god-tier", "dominated"];
  const lines = [
    LEARNING_COPY.firstHit,
    LEARNING_COPY.firstMiss,
    LEARNING_COPY.closer,
    LEARNING_COPY.remembered,
    LEARNING_COPY.mastered,
    LEARNING_COPY.tricky,
  ];
  for (const line of lines) {
    assert.ok(line.length > 0, "copy bank lines must not be empty");
    for (const word of banned) {
      assert.ok(
        !line.toLowerCase().includes(word),
        `banned tone in copy bank: ${JSON.stringify(line)}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// recordAnswer — pure update, caps, LRU
// ---------------------------------------------------------------------------

test("recordAnswer: first encounter records the attempt + day key, is pure", () => {
  const before = emptyLearningStore();
  const snapshot = JSON.stringify(before);
  const { store, event } = recordAnswer(before, input());
  assert.equal(JSON.stringify(before), snapshot, "input store must not be mutated");
  assert.equal(store.records["place-1"].attempts.length, 1);
  assert.deepEqual(store.records["place-1"].attempts[0], {
    at: NOW,
    hit: false,
    distanceKm: 100,
    radiusKm: 200,
    edition: "globe",
    regionId: "world",
    score: 0,
  });
  assert.deepEqual(store.daysPlayed, [learningDateKey(NOW)]);
  assert.equal(store.regionNames["world"], "World");
  assert.equal(event.isFirstEncounter, true);
  assert.equal(event.line, LEARNING_COPY.firstMiss);
});

test("recordAnswer: appends oldest-first and classifies a hit-after-miss", () => {
  const first = recordAnswer(emptyLearningStore(), input()).store;
  const { store, event } = recordAnswer(
    first,
    input({ hit: true, distanceKm: 60, at: NOW + 1000, score: 120 }),
  );
  const attempts = store.records["place-1"].attempts;
  assert.equal(attempts.length, 2);
  assert.ok(attempts[0].at < attempts[1].at, "oldest first");
  assert.equal(event.isFirstEncounter, false);
  assert.equal(event.hit, true);
  assert.equal(event.improved, true);
  assert.equal(event.line, LEARNING_COPY.remembered);
});

test("recordAnswer: newlyMastered fires only on crossing the bar", () => {
  let store = emptyLearningStore();
  // Two confident hits → mastered on the second.
  store = recordAnswer(store, input({ hit: true, distanceKm: 40, at: NOW })).store;
  const second = recordAnswer(store, input({ hit: true, distanceKm: 30, at: NOW + 1 }));
  assert.equal(second.event.newlyMastered, true);
  assert.equal(second.event.line, LEARNING_COPY.mastered);
  // A third confident hit stays mastered but is not "newly" mastered.
  const third = recordAnswer(second.store, input({ hit: true, distanceKm: 20, at: NOW + 2 }));
  assert.equal(third.event.newlyMastered, false);
  assert.equal(third.event.line, LEARNING_COPY.closer);
});

test("recordAnswer: attempts cap at 8, oldest dropped first", () => {
  let store = emptyLearningStore();
  for (let i = 0; i < MAX_ATTEMPTS_PER_PLACE + 3; i++) {
    store = recordAnswer(store, input({ at: NOW + i * 1000, distanceKm: 500 - i })).store;
  }
  const attempts = store.records["place-1"].attempts;
  assert.equal(attempts.length, MAX_ATTEMPTS_PER_PLACE);
  assert.equal(attempts[0].at, NOW + 3 * 1000, "the three oldest attempts are gone");
  assert.equal(attempts[attempts.length - 1].at, NOW + (MAX_ATTEMPTS_PER_PLACE + 2) * 1000);
});

test("recordAnswer: regionNames are last-write-wins", () => {
  let store = emptyLearningStore();
  store = recordAnswer(store, input({ regionId: "tx", regionName: "Texas" })).store;
  store = recordAnswer(store, input({ regionId: "tx", regionName: "Tejas", placeId: "place-2" })).store;
  assert.equal(store.regionNames["tx"], "Tejas");
});

test("recordAnswer: daysPlayed dedups and caps at the last 90 keys", () => {
  let store = emptyLearningStore();
  for (let i = 0; i < MAX_DAYS_PLAYED + 5; i++) {
    store = recordAnswer(store, input({ at: NOW - i * DAY_MS })).store;
  }
  assert.equal(store.daysPlayed.length, MAX_DAYS_PLAYED);
  const sorted = [...store.daysPlayed].sort();
  assert.deepEqual(store.daysPlayed, sorted, "oldest-first");
  assert.ok(!store.daysPlayed.includes(learningDateKey(NOW - (MAX_DAYS_PLAYED + 4) * DAY_MS)));
  // Same-day answers don't add a second key.
  const again = recordAnswer(store, input({ at: NOW, placeId: "place-9" })).store;
  assert.equal(again.daysPlayed.length, MAX_DAYS_PLAYED);
});

test("recordAnswer: LRU eviction drops the stalest record at 1000 places", () => {
  let store = emptyLearningStore();
  // 1000 places, each answered once; "stale-1" answered first (oldest).
  store = recordAnswer(store, input({ placeId: "stale-1", at: NOW - 1000 * DAY_MS })).store;
  for (let i = 2; i <= MAX_PLACE_RECORDS; i++) {
    store = recordAnswer(store, input({ placeId: `p-${i}`, at: NOW - (1000 - i) * DAY_MS })).store;
  }
  assert.equal(Object.keys(store.records).length, MAX_PLACE_RECORDS);
  // One more new place → the record whose last attempt is oldest goes.
  const next = recordAnswer(store, input({ placeId: "newcomer", at: NOW })).store;
  assert.equal(Object.keys(next.records).length, MAX_PLACE_RECORDS);
  assert.ok(!next.records["stale-1"], "LRU victim evicted");
  assert.ok(next.records["newcomer"], "new record kept");
  // Re-answering an existing place never triggers eviction.
  const touched = recordAnswer(next, input({ placeId: "p-2", at: NOW + 1 })).store;
  assert.equal(Object.keys(touched.records).length, MAX_PLACE_RECORDS);
  assert.ok(touched.records["newcomer"], "no spurious eviction on re-answer");
});

test("recordAnswer: LRU tie in last-attempt time is deterministic", () => {
  let store = emptyLearningStore();
  for (let i = 0; i < MAX_PLACE_RECORDS; i++) {
    store = recordAnswer(store, input({ placeId: `tie-${String(i).padStart(4, "0")}`, at: NOW })).store;
  }
  const next = recordAnswer(store, input({ placeId: "zzz-new", at: NOW })).store;
  assert.ok(!next.records["tie-0000"], "lexicographically smallest id wins the tie");
});

// ---------------------------------------------------------------------------
// Persistence — fail closed, one key, no other storage touched
// ---------------------------------------------------------------------------

test("persistence: round-trip through a single localStorage key", () => {
  const storage = fakeStorage();
  let store = emptyLearningStore();
  store = recordAnswer(store, input({ hit: true, distanceKm: 30 })).store;
  writeLearningStore(store, storage);
  assert.deepEqual(storage.writes, [LEARNING_STORE_KEY], "exactly one key written");
  const read = readLearningStore(storage);
  assert.deepEqual(read, store);
});

test("persistence: corrupt payloads fail closed to null", () => {
  const storage = fakeStorage();
  const cases: Array<[string, string]> = [
    ["garbage", "not json at all {"],
    ["wrong top-level shape", JSON.stringify({ v: 1, nope: true })],
    ["unknown schema version", JSON.stringify({ v: 2, records: {}, regionNames: {}, daysPlayed: [] })],
    ["bad daysPlayed", JSON.stringify({ v: 1, records: {}, regionNames: {}, daysPlayed: ["yesterday"] })],
    ["null payload", "null"],
  ];
  // (A store whose records map itself is malformed is also null; a store
  // with one malformed *record* drops just that record — see next test.)
  storage.data.set(
    LEARNING_STORE_KEY,
    JSON.stringify({ v: 1, records: "oops", regionNames: {}, daysPlayed: [] }),
  );
  assert.equal(readLearningStore(storage), null, "fail closed: bad records map");
  for (const [name, body] of cases) {
    storage.data.set(LEARNING_STORE_KEY, body);
    assert.equal(readLearningStore(storage), null, `fail closed: ${name}`);
  }
});

test("persistence: one malformed record is dropped, the store survives", () => {
  const storage = fakeStorage();
  const good = recordAnswer(emptyLearningStore(), input({ placeId: "good" })).store;
  const raw = JSON.parse(JSON.stringify(good));
  raw.records["bad"] = { v: 1, placeId: "bad", attempts: [{ at: "yesterday" }] };
  storage.data.set(LEARNING_STORE_KEY, JSON.stringify(raw));
  const read = readLearningStore(storage);
  assert.ok(read, "store still parses");
  assert.ok(read!.records["good"], "good record kept");
  assert.ok(!read!.records["bad"], "bad record dropped");
});

test("persistence: unknown future version leaves existing data untouched (new key on bump)", () => {
  const storage = fakeStorage();
  const v2 = { v: 99, records: {}, regionNames: {}, daysPlayed: [] };
  storage.data.set(LEARNING_STORE_KEY, JSON.stringify(v2));
  assert.equal(readLearningStore(storage), null);
  assert.equal(
    storage.data.get(LEARNING_STORE_KEY),
    JSON.stringify(v2),
    "a failed read never rewrites the stored payload",
  );
});

test("persistence: missing key and missing storage read as null", () => {
  const storage = fakeStorage();
  assert.equal(readLearningStore(storage), null);
  // Under node there is no localStorage; read must still fail closed.
  assert.equal(readLearningStore(), null);
});

test("persistence: write failures are swallowed (game never breaks)", () => {
  const throwing = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => writeLearningStore(emptyLearningStore(), throwing));
  assert.doesNotThrow(() => clearLearningStore(throwing));
});

test("persistence: clearLearningStore removes the key", () => {
  const storage = fakeStorage();
  writeLearningStore(emptyLearningStore(), storage);
  clearLearningStore(storage);
  assert.equal(storage.data.has(LEARNING_STORE_KEY), false);
});

// ---------------------------------------------------------------------------
// Non-interference: the module only ever touches its own key
// ---------------------------------------------------------------------------

test("non-interference: learning storage never reads or writes dealing/session keys", () => {
  const storage = fakeStorage();
  storage.data.set("meridian:seen:v2:globe:world", JSON.stringify({ dealt: ["x"] }));
  storage.data.set("meridian:session:v1", JSON.stringify({ score: 999 }));
  let store = readLearningStore(storage) ?? emptyLearningStore();
  store = recordAnswer(store, input()).store;
  writeLearningStore(store, storage);
  assert.deepEqual(storage.reads, [LEARNING_STORE_KEY], "only its own key is read");
  assert.deepEqual(storage.writes, [LEARNING_STORE_KEY], "only its own key is written");
  assert.equal(
    storage.data.get("meridian:seen:v2:globe:world"),
    JSON.stringify({ dealt: ["x"] }),
    "dealing history untouched",
  );
  assert.equal(
    storage.data.get("meridian:session:v1"),
    JSON.stringify({ score: 999 }),
    "session untouched",
  );
});

test("non-interference: recordAnswer is pure — no storage access at all", () => {
  // recordAnswer takes no storage parameter by design: pure derivation only.
  const before = emptyLearningStore();
  const { store, event } = recordAnswer(before, input({ score: 123 }));
  assert.equal(store.records["place-1"].attempts[0].score, 123, "score recorded for analysis");
  assert.ok(event.line, "an event is always produced");
  assert.equal(Object.keys(before.records).length, 0, "input untouched");
});

// ---------------------------------------------------------------------------
// M1 — retention rate
// ---------------------------------------------------------------------------

test("retentionRate: null when no re-encounters exist", () => {
  const store = recordAnswer(emptyLearningStore(), input()).store;
  assert.equal(retentionRate(store, NOW + DAY_MS), null);
});

test("retentionRate: hit-after-miss and shrinking-miss count as improved", () => {
  let store = emptyLearningStore();
  // place A: miss, then hit → improved.
  store = recordAnswer(store, input({ placeId: "a", hit: false, distanceKm: 400, at: NOW - 10 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "a", hit: true, distanceKm: 30, at: NOW - 2 * DAY_MS })).store;
  // place B: miss, then miss at 0.5× first error → improved (0.75 bar).
  store = recordAnswer(store, input({ placeId: "b", hit: false, distanceKm: 400, at: NOW - 10 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "b", hit: false, distanceKm: 200, at: NOW - 2 * DAY_MS })).store;
  // place C: miss, then wider miss → not improved.
  store = recordAnswer(store, input({ placeId: "c", hit: false, distanceKm: 400, at: NOW - 10 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "c", hit: false, distanceKm: 500, at: NOW - 2 * DAY_MS })).store;
  // place D: hit first — excluded from the denominator.
  store = recordAnswer(store, input({ placeId: "d", hit: true, distanceKm: 20, at: NOW - 10 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "d", hit: true, distanceKm: 10, at: NOW - 2 * DAY_MS })).store;
  const r = retentionRate(store, NOW);
  assert.ok(r);
  assert.equal(r.reEncountered, 3);
  assert.equal(r.improved, 2);
  assert.ok(Math.abs(r.rate - 2 / 3) < 1e-9);
});

test("retentionRate: attempts outside the 28-day window are ignored", () => {
  let store = emptyLearningStore();
  store = recordAnswer(store, input({ placeId: "old", hit: false, distanceKm: 400, at: NOW - 60 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "old", hit: true, distanceKm: 10, at: NOW - 50 * DAY_MS })).store;
  assert.equal(retentionRate(store, NOW), null);
});

// ---------------------------------------------------------------------------
// M3 — error trend by region
// ---------------------------------------------------------------------------

function seedTrend(store: LearningStore, regionId: string, regionName: string, recent: number[], baseline: number[]): LearningStore {
  let s = store;
  baseline.forEach((d, i) => {
    s = recordAnswer(
      s,
      input({ placeId: `${regionId}-b${i}`, regionId, regionName, distanceKm: d, at: NOW - 20 * DAY_MS + i }),
    ).store;
  });
  recent.forEach((d, i) => {
    s = recordAnswer(
      s,
      input({ placeId: `${regionId}-r${i}`, regionId, regionName, distanceKm: d, at: NOW - i * DAY_MS }),
    ).store;
  });
  return s;
}

test("errorTrendByRegion: positive when the recent median shrank", () => {
  let store = emptyLearningStore();
  store = seedTrend(store, "tx", "Texas", [40, 42, 44, 46, 48], [90, 95, 100, 105, 110]);
  const trends = errorTrendByRegion(store, NOW);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].regionName, "Texas");
  // Baseline = trailing 28 days (includes the recent 7): sorted
  // [40,42,44,46,48,90,95,100,105,110] → median 69; recent median 44.
  const expected = (69 - 44) / 69;
  assert.ok(Math.abs(trends[0].trend - expected) < 1e-9, `got ${trends[0].trend}`);
  assert.equal(trends[0].attempts7, 5);
  assert.equal(trends[0].attempts28, 10);
});

test("errorTrendByRegion: median ignores one wild miss; minimums keep the note honest", () => {
  let store = emptyLearningStore();
  // A wild 9000 km globe miss in the recent window must not move the median.
  store = seedTrend(store, "tx", "Texas", [40, 42, 44, 46, 9000], [90, 95, 100, 105, 110]);
  const trends = errorTrendByRegion(store, NOW);
  assert.equal(trends.length, 1);
  assert.ok(trends[0].trend > 0.5, `median robust, got ${trends[0].trend}`);
  // Fewer than 5 recent attempts → region not reported.
  let thin = emptyLearningStore();
  thin = seedTrend(thin, "ok", "Oklahoma", [40, 42], [90, 95, 100, 105, 110]);
  assert.equal(errorTrendByRegion(thin, NOW).length, 0);
});

test("errorTrendByRegion: negative when errors grew", () => {
  let store = emptyLearningStore();
  store = seedTrend(store, "tx", "Texas", [190, 195, 200, 205, 210], [90, 95, 100, 105, 110]);
  const trends = errorTrendByRegion(store, NOW);
  assert.equal(trends.length, 1);
  assert.ok(trends[0].trend < 0);
});

// ---------------------------------------------------------------------------
// M4 — engagement
// ---------------------------------------------------------------------------

test("engagement: day streak counts today, and tolerates not-yet-played-today", () => {
  let store = emptyLearningStore();
  for (let i = 0; i < 3; i++) {
    store = recordAnswer(store, input({ placeId: `p${i}`, at: NOW - i * DAY_MS })).store;
  }
  const e = engagement(store, NOW);
  assert.equal(e.dayStreak, 3);
  assert.equal(e.daysPlayed7, 3);
  assert.equal(e.daysPlayed28, 3);
  assert.equal(e.places7, 3);

  // Same streak evaluated at breakfast before playing: yesterday anchors it.
  const breakfast = engagement(store, NOW + 6 * 60 * 60 * 1000);
  assert.equal(breakfast.dayStreak, 3, "not-yet-played-today keeps the streak");
});

test("engagement: a missed day breaks the streak", () => {
  let store = emptyLearningStore();
  store = recordAnswer(store, input({ placeId: "a", at: NOW })).store;
  store = recordAnswer(store, input({ placeId: "b", at: NOW - 2 * DAY_MS })).store;
  assert.equal(engagement(store, NOW).dayStreak, 1);
});

test("engagement: windows count distinct days, places7 counts attempts", () => {
  let store = emptyLearningStore();
  for (let i = 0; i < 10; i++) {
    store = recordAnswer(store, input({ placeId: `q${i}`, at: NOW - 2 * DAY_MS })).store;
  }
  store = recordAnswer(store, input({ placeId: "old", at: NOW - 20 * DAY_MS })).store;
  const e = engagement(store, NOW);
  assert.equal(e.daysPlayed7, 1, "ten attempts on one day = one day");
  assert.equal(e.daysPlayed28, 2);
  assert.equal(e.places7, 10);
});

// ---------------------------------------------------------------------------
// growthSummary — the "My growth" section model
// ---------------------------------------------------------------------------

test("growthSummary: counts explored/mastered, streak, and improving regions", () => {
  let store = emptyLearningStore();
  // One mastered place (two confident hits).
  store = recordAnswer(store, input({ placeId: "m", hit: true, distanceKm: 30, at: NOW - 2 * DAY_MS })).store;
  store = recordAnswer(store, input({ placeId: "m", hit: true, distanceKm: 20, at: NOW - DAY_MS })).store;
  // Trend data: Texas improving, Oklahoma not enough data.
  store = seedTrend(store, "tx", "Texas", [40, 42, 44, 46, 48], [90, 95, 100, 105, 110]);
  store = seedTrend(store, "ok", "Oklahoma", [40, 42], [90, 95, 100, 105, 110]);
  const s = growthSummary(store, NOW);
  assert.ok(s.explored >= 2, `explored=${s.explored}`);
  assert.equal(s.mastered, 1);
  assert.ok(s.dayStreak >= 1);
  assert.equal(s.improvingRegions.length, 1);
  assert.equal(s.improvingRegions[0].regionName, "Texas");
  assert.ok(s.improvingRegions[0].trendPct > 0);
});

test("learningDateKey: YYYY-MM-DD UTC format", () => {
  assert.match(learningDateKey(NOW), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(learningDateKey(Date.UTC(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("constants: schema version matches the shipped key", () => {
  assert.equal(LEARNING_SCHEMA_VERSION, 1);
  assert.equal(LEARNING_STORE_KEY, "meridian:learning:v1");
  assert.equal(MAX_PLACE_RECORDS, 1000);
  assert.equal(MAX_ATTEMPTS_PER_PLACE, 8);
  assert.equal(MAX_DAYS_PLAYED, 90);
});
