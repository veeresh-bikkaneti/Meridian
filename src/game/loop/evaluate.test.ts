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
  unlabeledSpotEntry,
} from "./evaluate.ts";
import type { FetchLike } from "./evaluate.ts";
import { preloadAdmin1Boundaries } from "../reverse-geocode.ts";
import { submitGuess } from "./engine.ts";
import { freshLoopPuzzleState } from "./store.ts";
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

test("normalizeLoopName transliterates non-decomposable letters (shared with build pipeline)", () => {
  // Single source of truth: ./normalize.ts, also used by scripts/build-loop.mjs.
  assert.equal(normalizeLoopName("Białystok"), "bialystok");
  assert.equal(normalizeLoopName("Hınıs"), "hinis");
  assert.equal(normalizeLoopName("Straße"), "strasse");
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

test("rankLoopSuggestions: word-boundary name matches outrank substring noise", () => {
  const { suggestions } = rankLoopSuggestions(FAKE_INDEX, "spring");
  assert.deepEqual(
    suggestions.map((e) => e.id),
    // "springfield" x3 are word-boundary hits (tier 1, pop desc);
    // "coldspring" is a mid-word substring (tier 2) and sorts last.
    ["geonames:2", "geonames:3", "geonames:1", "geonames:4"],
  );
});

test("rankLoopSuggestions: query normalization matches diacritic-free index", () => {
  const { suggestions } = rankLoopSuggestions(FAKE_INDEX, "São");
  assert.deepEqual(suggestions.map((e) => e.id), ["geonames:5"]);
});

test("rankLoopSuggestions: blank query and no match return empty", () => {
  assert.deepEqual(rankLoopSuggestions(FAKE_INDEX, "   "), { suggestions: [], total: 0 });
  assert.deepEqual(rankLoopSuggestions(FAKE_INDEX, "zzz-no-such-place"), {
    suggestions: [],
    total: 0,
  });
});

test("rankLoopSuggestions: caps at the limit and dedupes ids", () => {
  const many: LoopNameEntry[] = [];
  for (let i = 0; i < 20; i++) {
    many.push(entry({ id: `geonames:dup`, n: `spring${i}`, p: 1000 - i }));
  }
  const deduped = rankLoopSuggestions(many, "spring", 5);
  assert.equal(deduped.suggestions.length, 1); // deduped to the single id
  assert.equal(deduped.total, 1);
  const twenty: LoopNameEntry[] = [];
  for (let i = 0; i < 20; i++) {
    twenty.push(entry({ id: `geonames:${i}`, n: `springtown${i}`, p: i }));
  }
  const capped = rankLoopSuggestions(twenty, "spring");
  assert.equal(capped.suggestions.length, LOOP_SUGGESTION_LIMIT);
  assert.equal(capped.total, 20);
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
  const { suggestions } = rankLoopSuggestions(index, "new york");
  assert.deepEqual(
    suggestions.map((e) => e.n),
    ["new york city", "east new york"],
  );
});

test("rankLoopSuggestions: haystack cache is transparent across repeated scans", () => {
  // Regression guard for the per-entry haystack cache (the typeahead-freeze
  // fix): repeated scans over the same entries must return identical
  // results, and a fresh-identity array with equal content must agree —
  // proving the cache never serves stale strings for live entries.
  const queries = ["spring", "sao", "paris texas", "zzz-no-such-place", "   "];
  const first = queries.map((q) => rankLoopSuggestions(FAKE_INDEX, q));
  const second = queries.map((q) => rankLoopSuggestions(FAKE_INDEX, q));
  assert.deepEqual(second, first);
  const freshIdentity: LoopNameEntry[] = FAKE_INDEX.map((e) => ({ ...e }));
  const third = queries.map((q) => rankLoopSuggestions(freshIdentity, q));
  assert.deepEqual(
    third.map((r) => r.suggestions.map((e) => e.id)),
    first.map((r) => r.suggestions.map((e) => e.id)),
  );
  assert.deepEqual(
    third.map((r) => r.total),
    first.map((r) => r.total),
  );
});

test("unlabeledSpotEntry: ocean tap becomes an honest Open Water guess", () => {
  // Owner directive 2026-10-12: every map tap registers a guess — a tap
  // on no labeled place is never rejected.
  const e = unlabeledSpotEntry(-150, 0);
  assert.equal(e.n, "open water");
  assert.equal(e.r, "");
  assert.equal(e.lon, -150);
  assert.equal(e.lat, 0);
  assert.equal(e.p, 0);
  assert.match(e.id, /^tap:-150\.0000,0\.0000$/);
  assert.equal(displayLoopName(e), "Open Water");
});

test("unlabeledSpotEntry: remote land tap is named by its country", () => {
  // Northern Saskatchewan wilderness — no labeled place within tolerance.
  const e = unlabeledSpotEntry(-106, 56);
  assert.equal(e.n, "canada");
  assert.equal(e.lon, -106);
  assert.equal(e.lat, 56);
  assert.equal(displayLoopName(e), "Canada");
});

test("unlabeledSpotEntry: id is stable per spot so repeat taps dedupe", () => {
  // The duplicate-guess check keys on entry.id: tapping the same
  // wilderness twice must warn, not burn a second guess.
  const a = unlabeledSpotEntry(-106.00001, 56.00001);
  const b = unlabeledSpotEntry(-106.00002, 56.00002);
  assert.equal(a.id, b.id);
  const c = unlabeledSpotEntry(-107, 56);
  assert.notEqual(a.id, c.id);
});

test("unlabeledSpotEntry: feeds the normal guess pipeline", () => {
  // The synthetic entry must satisfy the store's guess validation and the
  // engine's win check (a tap id never equals a GeoNames target id, so an
  // unlabeled tap can never accidentally win — proven by submitGuess below).
  const e = unlabeledSpotEntry(135.5, -24.5);
  assert.ok(typeof e.id === "string");
  assert.ok(e.id.length > 0);
  assert.ok(e.id.startsWith("tap:"));
  const g = guess({ name: displayLoopName(e), placeId: e.id, lon: e.lon, lat: e.lat });
  assert.equal(g.placeId, e.id);
  // Same spot twice → duplicate (warns, never burns a second guess).
  assert.ok(isDuplicateGuess(e.id, [g]));
  // A different spot → not a duplicate.
  assert.ok(!isDuplicateGuess("tap:0.0000,0.0000", [g]));
  // Win-safety: the tap id can never match the GeoNames target id, so even
  // a tap exactly on the target stays "playing" — never an accidental win.
  const played = submitGuess(freshLoopPuzzleState(0, 1), g, "geonames:123456");
  assert.equal(played.status, "playing");
  assert.equal(played.guesses.length, 1);
});

test("unlabeledSpotEntry: the name gets finer once admin-1 loads, the id never changes", async () => {
  // Same tap, two sessions: before the admin-1 boundaries load the spot is
  // named by its country; after they load it is named by its state. Only the
  // label differs. The id keys the duplicate check, so it must not move.
  // Keep this test LAST in the file: the preload is module-global state, and
  // the country-only tests above assume it has not happened yet.
  const before = unlabeledSpotEntry(-96.7, 40.8);
  assert.equal(before.n, "united states of america");
  assert.equal(before.r, "");

  await preloadAdmin1Boundaries();
  const after = unlabeledSpotEntry(-96.7, 40.8);
  assert.equal(after.n, "nebraska");
  assert.equal(after.r, "United States of America");
  assert.equal(displayLoopName(after), "Nebraska, United States of America");

  assert.equal(after.id, before.id);
  assert.equal(after.lon, before.lon);
  assert.equal(after.lat, before.lat);
});
