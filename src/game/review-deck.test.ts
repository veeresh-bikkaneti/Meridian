import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_DECK_ENTRIES,
  REVIEW_DECK_REGION_ID,
  REVIEW_DECK_SCHEMA_VERSION,
  REVIEW_DECK_STORE_KEY,
  REVIEW_INTERVALS_DAYS,
  deckCounts,
  deckStarter,
  dueEntries,
  emptyReviewDeck,
  parseReviewDeck,
  readReviewDeck,
  recordReview,
  removeDeckEntry,
  upsertMiss,
  writeReviewDeck,
  type DeckEntry,
  type DeckPlaceSnapshot,
  type ReviewDeckStore,
} from "./review-deck.ts";

/**
 * Unit tests for the misses-review deck (game-review improvement #1):
 * miss upsert, Leitner-lite scheduling, due ordering, mastery-driven
 * removal, the deck cap, and fail-closed persistence.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_789_000_000_000;

function snapshot(id: string, overrides: Partial<DeckPlaceSnapshot> = {}): DeckPlaceSnapshot {
  return {
    id,
    name: `Place ${id}`,
    lon: -96.7,
    lat: 40.8,
    story: "A test story.",
    difficulty: 2,
    edition: "state",
    regionId: "nebraska",
    regionName: "Nebraska",
    sourceLabel: "Test",
    sourceHref: "https://example.com",
    mapMode: "flat",
    regionBounds: [-104.1, 39.9, -95.2, 43.0],
    radiusKm: 75,
    ...overrides,
  };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

test("upsertMiss: a fresh miss joins the deck due immediately", () => {
  const store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  const entries = Object.values(store.entries);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.place.id, "a");
  assert.equal(entry.streak, 0);
  assert.equal(entry.nextDueAt, NOW);
  assert.equal(entry.lastReviewedAt, 0);
  assert.equal(entry.reviews, 0);
  assert.deepEqual(dueEntries(store, NOW).map((e) => e.place.id), ["a"]);
});

test("upsertMiss: a re-miss resets the streak and refreshes the snapshot", () => {
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  store = recordReview(store, "a", true, NOW);
  store = recordReview(store, "a", true, NOW + 1000);
  assert.equal(store.entries["a"].streak, 2);
  const refreshed = snapshot("a", { name: "Place a (new)" });
  store = upsertMiss(store, refreshed, NOW + 2000);
  const entry = store.entries["a"];
  assert.equal(entry.streak, 0);
  assert.equal(entry.nextDueAt, NOW + 2000);
  assert.equal(entry.place.name, "Place a (new)");
  // Review history is preserved across the re-miss.
  assert.equal(entry.reviews, 2);
});

test("upsertMiss: pure — does not mutate its input", () => {
  const before = emptyReviewDeck();
  upsertMiss(before, snapshot("a"), NOW);
  assert.deepEqual(before, emptyReviewDeck());
});

test("recordReview: hits walk the Leitner intervals [0,1,3,7,14,30]", () => {
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  const expectedDays = [1, 3, 7, 14, 30, 30];
  for (let i = 0; i < expectedDays.length; i++) {
    store = recordReview(store, "a", true, NOW);
    const entry = store.entries["a"];
    assert.equal(entry.streak, i + 1);
    assert.equal(entry.nextDueAt, NOW + expectedDays[i] * DAY_MS);
    assert.equal(entry.reviews, i + 1);
    assert.equal(entry.lastReviewedAt, NOW);
  }
});

test("recordReview: a miss resets the streak and makes the card due now", () => {
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  store = recordReview(store, "a", true, NOW);
  store = recordReview(store, "a", true, NOW);
  assert.equal(store.entries["a"].streak, 2);
  store = recordReview(store, "a", false, NOW + 5000);
  const entry = store.entries["a"];
  assert.equal(entry.streak, 0);
  assert.equal(entry.nextDueAt, NOW + 5000);
  assert.equal(entry.reviews, 3);
  assert.deepEqual(dueEntries(store, NOW + 5000).map((e) => e.place.id), ["a"]);
});

test("recordReview: unknown placeId leaves the store unchanged", () => {
  const store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  const next = recordReview(store, "nope", true, NOW);
  assert.equal(next, store);
});

test("removeDeckEntry: drops the card; unknown id is a no-op", () => {
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  store = upsertMiss(store, snapshot("b"), NOW);
  const same = removeDeckEntry(store, "nope");
  assert.equal(same, store);
  const next = removeDeckEntry(store, "a");
  assert.deepEqual(Object.keys(next.entries), ["b"]);
  assert.deepEqual(Object.keys(store.entries).sort(), ["a", "b"]);
});

test("dueEntries: oldest-due first, ties broken deterministically", () => {
  let store = emptyReviewDeck();
  store = upsertMiss(store, snapshot("b"), NOW + 2000);
  store = upsertMiss(store, snapshot("a"), NOW + 1000);
  store = upsertMiss(store, snapshot("c"), NOW + 3000);
  // Push "c" into the future with a successful review.
  store = recordReview(store, "c", true, NOW + 3000);
  const due = dueEntries(store, NOW + 3000);
  assert.deepEqual(due.map((e) => e.place.id), ["a", "b"]);
  // "c" is not due until tomorrow.
  assert.ok(!due.some((e) => e.place.id === "c"));
  const later = dueEntries(store, NOW + 3000 + DAY_MS + 1);
  assert.deepEqual(later.map((e) => e.place.id), ["a", "b", "c"]);
});

test("deckCounts: total vs due", () => {
  let store = emptyReviewDeck();
  store = upsertMiss(store, snapshot("a"), NOW);
  store = upsertMiss(store, snapshot("b"), NOW);
  store = recordReview(store, "b", true, NOW);
  assert.deepEqual(deckCounts(store, NOW), { total: 2, due: 1 });
});

test("upsertMiss: cap evicts the least-urgent cards, never the new one", () => {
  let store = emptyReviewDeck();
  for (let i = 0; i < MAX_DECK_ENTRIES; i++) {
    store = upsertMiss(store, snapshot(`p${i}`), NOW);
    // Give each card a different urgency: p0 due soonest.
    store = recordReview(store, `p${i}`, true, NOW - i * 1000);
  }
  assert.equal(Object.keys(store.entries).length, MAX_DECK_ENTRIES);
  // All cards reviewed once → streak 1 → due in 1 day, staggered by seconds:
  // p0 was reviewed latest, so it is due furthest in the future.
  store = upsertMiss(store, snapshot("new"), NOW);
  const ids = Object.keys(store.entries);
  assert.equal(ids.length, MAX_DECK_ENTRIES);
  assert.ok(ids.includes("new"), "the just-added card must survive the cap");
  // The furthest-due card (p0) is evicted.
  assert.ok(!ids.includes("p0"));
});

test("deckStarter: rebuilds the Starter the game loop needs", () => {
  const store = upsertMiss(
    emptyReviewDeck(),
    snapshot("a", { history: "Hook.", subdivision: "Nebraska", iso2: "US" }),
    NOW,
  );
  const starter = deckStarter(store.entries["a"]);
  assert.equal(starter.id, "a");
  assert.equal(starter.name, "Place a");
  assert.equal(starter.lon, -96.7);
  assert.equal(starter.lat, 40.8);
  assert.equal(starter.story, "A test story.");
  assert.equal(starter.history, "Hook.");
  assert.equal(starter.subdivision, "Nebraska");
  assert.equal(starter.iso2, "US");
  assert.equal(starter.edition, "state");
  assert.equal(starter.regionId, "nebraska");
  assert.equal(starter.difficulty, 2);
});

test("parseReviewDeck: round-trips a valid store", () => {
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  store = recordReview(store, "a", true, NOW);
  const parsed = parseReviewDeck(JSON.parse(JSON.stringify(store)));
  assert.deepEqual(parsed, store);
});

test("parseReviewDeck: fail closed on malformed store-level payloads", () => {
  for (const bad of [null, undefined, 42, "x", [], {}, { v: 999, entries: {} }, { v: 1 }, { v: 1, entries: [] }, { v: 1, entries: null }]) {
    assert.equal(parseReviewDeck(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("parseReviewDeck: drops malformed entries, keeps good ones", () => {
  const good: DeckEntry = {
    v: 1,
    place: snapshot("good"),
    streak: 0,
    nextDueAt: NOW,
    lastReviewedAt: 0,
    reviews: 0,
  };
  const raw = {
    v: 1,
    entries: {
      good,
      badCoords: { ...good, place: { ...good.place, id: "badCoords", lon: 999 } },
      badRadius: { ...good, place: { ...good.place, id: "badRadius", radiusKm: -5 } },
      badStreak: { ...good, place: { ...good.place, id: "badStreak" }, streak: -1 },
      idMismatch: { ...good, place: { ...good.place, id: "other" } },
      notAnEntry: 42,
    },
  };
  const parsed = parseReviewDeck(raw);
  assert.deepEqual(Object.keys(parsed!.entries), ["good"]);
});

test("parseReviewDeck: caps entries at MAX_DECK_ENTRIES", () => {
  const entries: Record<string, DeckEntry> = {};
  for (let i = 0; i < MAX_DECK_ENTRIES + 10; i++) {
    const s = snapshot(`p${i}`);
    entries[`p${i}`] = { v: 1, place: s, streak: 0, nextDueAt: NOW, lastReviewedAt: 0, reviews: 0 };
  }
  const parsed = parseReviewDeck({ v: 1, entries });
  assert.equal(Object.keys(parsed!.entries).length, MAX_DECK_ENTRIES);
});

test("persistence: read/write round-trip through a storage shim", () => {
  const storage = memoryStorage();
  assert.equal(readReviewDeck(storage), null);
  let store = upsertMiss(emptyReviewDeck(), snapshot("a"), NOW);
  writeReviewDeck(store, storage);
  assert.equal(storage.getItem(REVIEW_DECK_STORE_KEY) !== null, true);
  const read = readReviewDeck(storage);
  assert.deepEqual(read, store);
});

test("persistence: corrupt JSON reads as null (fail closed)", () => {
  const storage = memoryStorage();
  storage.setItem(REVIEW_DECK_STORE_KEY, "{not json");
  assert.equal(readReviewDeck(storage), null);
});

test("persistence: throwing storage never throws", () => {
  const bad = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  assert.equal(readReviewDeck(bad), null);
  assert.doesNotThrow(() => writeReviewDeck(emptyReviewDeck(), bad));
});

test("review deck region id is distinct from real editions", () => {
  assert.ok(!["state", "country", "globe"].includes(REVIEW_DECK_REGION_ID));
  assert.equal(REVIEW_DECK_SCHEMA_VERSION, 1);
});

test("intervals: fresh miss is due immediately, then 1/3/7/14/30 days", () => {
  assert.deepEqual([...REVIEW_INTERVALS_DAYS], [0, 1, 3, 7, 14, 30]);
});

test("emptyReviewDeck: schema version and empty entries", () => {
  const store: ReviewDeckStore = emptyReviewDeck();
  assert.equal(store.v, 1);
  assert.deepEqual(store.entries, {});
  assert.deepEqual(dueEntries(store, NOW), []);
  assert.deepEqual(deckCounts(store, NOW), { total: 0, due: 0 });
});
