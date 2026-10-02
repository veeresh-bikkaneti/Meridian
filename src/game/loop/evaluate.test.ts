import assert from "node:assert/strict";
import test from "node:test";
import {
  LOOP_SUGGESTION_LIMIT,
  clearLoopIndexCache,
  displayLoopName,
  evaluateGuess,
  fetchLoopIndex,
  isDuplicateGuess,
  loopNamesUrl,
  normalizeLoopName,
  rankLoopSuggestions,
} from "./evaluate.ts";
import type { FetchLike } from "./evaluate.ts";
import type { LoopGuess, LoopNameEntry } from "./types.ts";

function entry(over: Partial<LoopNameEntry> = {}): LoopNameEntry {
  return {
    n: "springfield",
    id: "geonames:1",
    lon: -89.65,
    lat: 39.78,
    r: "Illinois, US",
    p: 1000,
    ...over,
  };
}

function guess(over: Partial<LoopGuess> = {}): LoopGuess {
  return {
    name: "Springfield, Illinois, US",
    placeId: "geonames:1",
    distKm: 100,
    octant: "north",
    warmer: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// normalizeLoopName
// ---------------------------------------------------------------------------

test("normalizeLoopName strips diacritics, punctuation, case, extra space", () => {
  assert.equal(normalizeLoopName("São Paulo"), "sao paulo");
  assert.equal(normalizeLoopName("Zürich!"), "zurich");
  assert.equal(normalizeLoopName("St. Louis"), "st louis");
  assert.equal(normalizeLoopName("  New   York  "), "new york");
  assert.equal(normalizeLoopName(""), "");
});

test("displayLoopName renders 'Name, Region'", () => {
  assert.equal(displayLoopName(entry()), "Springfield, Illinois, US");
  assert.equal(displayLoopName(entry({ n: "sao paulo", r: "São Paulo, BR" })), "Sao Paulo, São Paulo, BR");
});

// ---------------------------------------------------------------------------
// rankLoopSuggestions
// ---------------------------------------------------------------------------

const FAKE_INDEX: LoopNameEntry[] = [
  entry({ n: "springfield", id: "geonames:1", r: "Illinois, US", p: 114000 }),
  entry({ n: "springfield", id: "geonames:2", r: "Missouri, US", p: 169000 }),
  entry({ n: "springfield", id: "geonames:3", r: "Massachusetts, US", p: 155000 }),
  entry({ n: "coldspring", id: "geonames:4", r: "Minnesota, US", p: 4000 }),
  entry({ n: "sao paulo", id: "geonames:5", r: "São Paulo, BR", p: 12300000 }),
];

test("rankLoopSuggestions: substring match, ranked by population desc", () => {
  const out = rankLoopSuggestions(FAKE_INDEX, "spring");
  assert.deepEqual(
    out.map((e) => e.id),
    ["geonames:2", "geonames:3", "geonames:1", "geonames:4"],
  );
});

test("rankLoopSuggestions: query normalization matches diacritic-free index", () => {
  const out = rankLoopSuggestions(FAKE_INDEX, "São");
  assert.deepEqual(out.map((e) => e.id), ["geonames:5"]);
});

test("rankLoopSuggestions: blank query and no match return []", () => {
  assert.deepEqual(rankLoopSuggestions(FAKE_INDEX, "   "), []);
  assert.deepEqual(rankLoopSuggestions(FAKE_INDEX, "zzz-no-such-place"), []);
});

test("rankLoopSuggestions: caps at the limit and dedupes ids", () => {
  const many: LoopNameEntry[] = [];
  for (let i = 0; i < 20; i++) {
    many.push(entry({ id: `geonames:dup`, n: `spring${i}`, p: 1000 - i }));
  }
  const out = rankLoopSuggestions(many, "spring", 5);
  assert.equal(out.length, 1); // deduped to the single id
  const twenty: LoopNameEntry[] = [];
  for (let i = 0; i < 20; i++) {
    twenty.push(entry({ id: `geonames:${i}`, n: `springtown${i}`, p: i }));
  }
  assert.equal(rankLoopSuggestions(twenty, "spring").length, LOOP_SUGGESTION_LIMIT);
  assert.equal(LOOP_SUGGESTION_LIMIT, 8);
});

// ---------------------------------------------------------------------------
// fetchLoopIndex
// ---------------------------------------------------------------------------

test("loopNamesUrl respects the app base path", () => {
  assert.ok(loopNamesUrl().endsWith("loop/names.json"), loopNamesUrl());
});

test("fetchLoopIndex: loads, validates, and caches the index", async () => {
  clearLoopIndexCache();
  let calls = 0;
  const fake: FetchLike = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => FAKE_INDEX };
  };
  const first = await fetchLoopIndex(fake);
  const second = await fetchLoopIndex(fake);
  assert.equal(first.length, FAKE_INDEX.length);
  assert.equal(calls, 1); // cached: one network hit
  assert.equal(first, second); // same promise result
  clearLoopIndexCache();
});

test("fetchLoopIndex: bad shape and HTTP errors reject (and allow retry)", async () => {
  clearLoopIndexCache();
  const badShape: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [{ nope: true }],
  });
  await assert.rejects(() => fetchLoopIndex(badShape), /unexpected shape/);

  let calls = 0;
  const flaky: FetchLike = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 500, json: async () => null };
    return { ok: true, status: 200, json: async () => FAKE_INDEX };
  };
  await assert.rejects(() => fetchLoopIndex(flaky), /HTTP 500/);
  const recovered = await fetchLoopIndex(flaky); // retry works: cache was cleared
  assert.equal(recovered.length, FAKE_INDEX.length);
  clearLoopIndexCache();
});

// ---------------------------------------------------------------------------
// evaluateGuess / isDuplicateGuess
// ---------------------------------------------------------------------------

test("evaluateGuess: distance, octant, placeId; warmer null for first guess", () => {
  // Guess: Springfield IL; target: Chicago IL (north-east of Springfield).
  const out = evaluateGuess(entry(), { lon: -87.6298, lat: 41.8781 }, null);
  assert.equal(out.placeId, "geonames:1");
  assert.ok(out.distKm > 250 && out.distKm < 350, `dist ${out.distKm}`);
  assert.equal(out.octant, "north-east");
  assert.equal(out.warmer, null);
  assert.ok(!("name" in out), "name is the caller's job");
});

test("evaluateGuess: warmer compares against the previous distance", () => {
  const near = evaluateGuess(entry(), { lon: -89.6, lat: 39.8 }, 1000);
  assert.equal(near.warmer, true);
  const far = evaluateGuess(entry(), { lon: 139.69, lat: 35.68 }, 1000);
  assert.equal(far.warmer, false);
  assert.equal(far.octant, "north-west"); // Springfield IL -> Tokyo: over the pole-ish, westward
  const tie = evaluateGuess(entry(), { lon: -89.6, lat: 39.8 }, near.distKm);
  assert.equal(tie.warmer, false); // equal distance is not warmer
});

test("isDuplicateGuess matches on placeId", () => {
  const guesses = [guess({ placeId: "geonames:1" }), guess({ placeId: "geonames:2" })];
  assert.equal(isDuplicateGuess("geonames:1", guesses), true);
  assert.equal(isDuplicateGuess("geonames:9", guesses), false);
  assert.equal(isDuplicateGuess("geonames:1", []), false);
});

test("rankLoopSuggestions: a non-matching alias never swallows the canonical name", () => {
  // Real-world shape: "big apple" sorts before "new york city" in the
  // index and shares its place id. Typing "new york" must still surface
  // the city — match first, dedupe second.
  const index: LoopNameEntry[] = [
    entry({ n: "big apple", id: "geonames:5128581", r: "New York, United States", p: 8804190 }),
    entry({ n: "new york city", id: "geonames:5128581", r: "New York, United States", p: 8804190 }),
    entry({ n: "east new york", id: "geonames:5115985", r: "New York, United States", p: 173198 }),
  ];
  const out = rankLoopSuggestions(index, "new york");
  assert.deepEqual(
    out.map((e) => e.n),
    ["new york city", "east new york"],
  );
});
