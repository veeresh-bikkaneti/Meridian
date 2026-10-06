import assert from "node:assert/strict";
import test from "node:test";
// The combobox component itself (guess-input.tsx) is a thin interactive shell
// over these helpers; there is no React/DOM test harness in this repo, so
// this file pins the component's whole logic surface — normalization,
// ranking, display, and the lazy index load (mock fetch) — against a tiny
// fake index. The component is jump-only: picking a suggestion calls onJump
// (camera fly); the bottom sheet commits the guess.
import {
  clearLoopIndexCache,
  displayLoopName,
  fetchLoopIndex,
  normalizeLoopName,
  rankLoopSuggestions,
} from "./evaluate.ts";
import type { FetchLike } from "./evaluate.ts";
import type { LoopNameEntry } from "./types.ts";

const FAKE_INDEX: LoopNameEntry[] = [
  { n: "springfield", id: "geonames:4250542", lon: -89.65, lat: 39.78, r: "Illinois, United States", p: 114000 },
  { n: "springfield", id: "geonames:4409896", lon: -93.292, lat: 37.215, r: "Missouri, United States", p: 169000 },
  { n: "sao paulo", id: "geonames:3448439", lon: -46.633, lat: -23.55, r: "Brazil", p: 12300000 },
  { n: "paris", id: "geonames:2988507", lon: 2.35, lat: 48.85, r: "France", p: 2138551 },
  { n: "paris", id: "geonames:4719457", lon: -95.55, lat: 33.66, r: "Texas, United States", p: 25171 },
  { n: "pica", id: "geonames:3876175", lon: -69.33, lat: -20.48, r: "Chile", p: 4000 },
  { n: "picacho", id: "geonames:9999999", lon: -110.0, lat: 32.0, r: "Arizona, United States", p: 90000 },
];

function mockFetch(index: unknown): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => index });
}

test("component pipeline: type 'spring' -> top-8 suggestions ranked by population", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  const { suggestions, total } = rankLoopSuggestions(index, "spring");
  assert.deepEqual(
    suggestions.map((e) => displayLoopName(e)),
    ["Springfield, Missouri, United States", "Springfield, Illinois, United States"],
  );
  assert.equal(total, 2);
  clearLoopIndexCache();
});

test("component pipeline: diacritics in the query still match", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  const { suggestions } = rankLoopSuggestions(index, "São Paulo");
  assert.equal(suggestions.length, 1);
  assert.equal(displayLoopName(suggestions[0]), "Sao Paulo, Brazil");
  clearLoopIndexCache();
});

test("component pipeline: no match -> empty suggestions (inline message, no jump)", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  assert.deepEqual(rankLoopSuggestions(index, "xyzzy"), { suggestions: [], total: 0 });
  assert.deepEqual(rankLoopSuggestions(index, ""), { suggestions: [], total: 0 });
  clearLoopIndexCache();
});

test("ranker: exact-name match outranks substring noise (pica -> Pica, CL)", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  // "picacho" out-populates Pica 22x — the old population-only ranker buried
  // Pica below the top-8; exact-name tiering must surface it first.
  const { suggestions } = rankLoopSuggestions(index, "pica");
  assert.equal(displayLoopName(suggestions[0]), "Pica, Chile");
  clearLoopIndexCache();
});

test("ranker: query words match across name + region (paris texas -> Paris, TX)", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  const { suggestions, total } = rankLoopSuggestions(index, "paris texas");
  assert.equal(total, 1);
  assert.equal(suggestions[0].id, "geonames:4719457");
  clearLoopIndexCache();
});

test("ranker: total counts pre-cap matches for the keep-typing hint", async () => {
  const many: LoopNameEntry[] = Array.from({ length: 10 }, (_, i) => ({
    n: `springfield`,
    id: `geonames:${1000 + i}`,
    lon: 0,
    lat: 0,
    r: `State${i}, United States`,
    p: 1000 - i,
  }));
  const { suggestions, total } = rankLoopSuggestions(many, "springfield", 8);
  assert.equal(suggestions.length, 8);
  assert.equal(total, 10);
});

test("component pipeline: load failure -> fetchLoopIndex rejects (error state)", async () => {
  clearLoopIndexCache();
  const failing: FetchLike = async () => ({ ok: false, status: 503, json: async () => null });
  await assert.rejects(() => fetchLoopIndex(failing), /HTTP 503/);
  clearLoopIndexCache();
});

test("query normalization matches the index contract", () => {
  // The build-time index stores n pre-normalized; the component must apply
  // the identical transform to the raw query.
  assert.equal(normalizeLoopName("St. Louis"), "st louis");
  assert.equal(normalizeLoopName("Zürich"), "zurich");
});
