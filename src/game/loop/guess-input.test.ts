import assert from "node:assert/strict";
import test from "node:test";
// The combobox component itself (guess-input.tsx) is a thin interactive shell
// over these helpers; there is no React/DOM test harness in this repo, so
// this file pins the component's whole logic surface — normalization,
// ranking, display, and the lazy index load (mock fetch) — against a tiny
// fake index.
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
  { n: "springfield", id: "geonames:4250542", lon: -89.65, lat: 39.78, r: "Illinois, US", p: 114000 },
  { n: "springfield", id: "geonames:4409896", lon: -93.292, lat: 37.215, r: "Missouri, US", p: 169000 },
  { n: "sao paulo", id: "geonames:3448439", lon: -46.633, lat: -23.55, r: "São Paulo, BR", p: 12300000 },
];

function mockFetch(index: unknown): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => index });
}

test("component pipeline: type 'spring' -> top-8 suggestions ranked by population", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  const suggestions = rankLoopSuggestions(index, "spring");
  assert.deepEqual(
    suggestions.map((e) => displayLoopName(e)),
    ["Springfield, Missouri, US", "Springfield, Illinois, US"],
  );
  clearLoopIndexCache();
});

test("component pipeline: diacritics in the query still match", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  const suggestions = rankLoopSuggestions(index, "São Paulo");
  assert.equal(suggestions.length, 1);
  assert.equal(displayLoopName(suggestions[0]), "Sao Paulo, São Paulo, BR");
  clearLoopIndexCache();
});

test("component pipeline: no match -> empty suggestions (inline message, no onPick)", async () => {
  clearLoopIndexCache();
  const index = await fetchLoopIndex(mockFetch(FAKE_INDEX));
  assert.deepEqual(rankLoopSuggestions(index, "xyzzy"), []);
  assert.deepEqual(rankLoopSuggestions(index, ""), []);
  clearLoopIndexCache();
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
