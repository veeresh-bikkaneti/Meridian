/**
 * Tests for the GeoDetective guess-index pipeline (scripts/build-loop.mjs).
 *
 * Covers: name normalization, the (name, region) dedupe policy, the
 * day-index contract shared with the Loop runtime, and schema validity of
 * the generated public/loop/names.json guess index.
 *
 * The names.json tests assume `node scripts/build-loop.mjs` has run.
 * This script owns ONLY the guess index: public/loop/clues/** and
 * public/loop/manifest.json are production content (PR #59) and are never
 * written or asserted by this pipeline.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildNamesIndex,
  dayIndexFor,
  dedupeEntries,
  loadLoopTargetIds,
  normalizeName,
  regionLabel,
} from "./build-loop.mjs";
import { rankLoopSuggestions } from "../src/game/loop/evaluate.ts";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
const OUT_DIR = join(ROOT, "public/loop");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// ---------------------------------------------------------------------------
// normalization
// ---------------------------------------------------------------------------

test("normalizeName strips diacritics, punctuation, and case", () => {
  assert.equal(normalizeName("São Paulo"), "sao paulo");
  assert.equal(normalizeName("St. Louis"), "st louis");
  assert.equal(normalizeName("Zürich"), "zurich");
  assert.equal(normalizeName("  Côte-d'Ivoire  "), "cote d ivoire");
  assert.equal(normalizeName("N'Djamena"), "n djamena");
});

test("normalizeName transliterates non-decomposable letters (build/runtime parity)", () => {
  // 2026-10-05 B1: these letters have no NFD decomposition — without the
  // transliteration map the build and the runtime typeahead disagreed and
  // Białystok/Hınıs were unfindable.
  assert.equal(normalizeName("Białystok"), "bialystok");
  assert.equal(normalizeName("Hınıs"), "hinis");
  assert.equal(normalizeName("Straße"), "strasse");
  assert.equal(normalizeName("Œuvre"), "oeuvre");
  assert.equal(normalizeName("Winston-Salem"), "winston salem");
  assert.equal(normalizeName("Coeur d'Alene"), "coeur d alene");
});

test("normalizeName leaves plain names untouched", () => {
  assert.equal(normalizeName("springfield"), "springfield");
  assert.equal(normalizeName("New York City"), "new york city");
});

// ---------------------------------------------------------------------------
// day-index contract: index = Math.floor(Date.now()/86400000) % size
// ---------------------------------------------------------------------------

test("dayIndexFor matches the runtime contract formula exactly", () => {
  const size = 387;
  for (const ms of [0, 1, 86_399_999, 86_400_000, 1_759_324_800_000, Date.now()]) {
    assert.equal(
      dayIndexFor(ms, size),
      Math.floor(ms / 86_400_000) % size,
      `mismatch at ${ms}`,
    );
  }
});

test("dayIndexFor stays within the pool and advances daily", () => {
  const size = 387;
  const day = 2_000 * 86_400_000;
  assert.ok(dayIndexFor(day, size) >= 0 && dayIndexFor(day, size) < size);
  assert.notEqual(
    dayIndexFor(day, size),
    dayIndexFor(day + 86_400_000, size),
    "index should usually advance each day (387-day cycle)",
  );
});

// ---------------------------------------------------------------------------
// dedupe: same (name, region) -> keep highest population; distinct regions kept
// ---------------------------------------------------------------------------

test("dedupeEntries keeps distinct (name, region) combos", () => {
  const mk = (n, r, p) => ({ n, id: "x", lon: 0, lat: 0, r, p });
  const out = dedupeEntries([
    mk("springfield", "Illinois, United States", 100),
    mk("springfield", "Missouri, United States", 200),
    mk("springfield", "Illinois, United States", 50),
  ]);
  assert.equal(out.length, 2);
  const il = out.find((e) => e.r.startsWith("Illinois"));
  const mo = out.find((e) => e.r.startsWith("Missouri"));
  assert.equal(il.p, 100, "Illinois keeps the higher-population entry");
  assert.equal(mo.p, 200);
});

test("dedupeEntries pins loop targets past the population heuristic", () => {
  const mk = (id, n, r, p) => ({ n, id, lon: 0, lat: 0, r, p });
  const pins = new Set(["geonames:2"]);
  // Shadow arrives first: the pinned target still wins the lane.
  const out = dedupeEntries(
    [mk("geonames:1", "la ceiba", "Honduras", 222055), mk("geonames:2", "la ceiba", "Honduras", 215973)],
    pins,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "geonames:2");
  // The higher-population shadow is dropped even when it arrives second.
  const out2 = dedupeEntries(
    [mk("geonames:2", "la ceiba", "Honduras", 215973), mk("geonames:1", "la ceiba", "Honduras", 222055)],
    pins,
  );
  assert.equal(out2.length, 1);
  assert.equal(out2[0].id, "geonames:2");
});

test("dedupeEntries never collapses two pinned targets sharing a name+region", () => {
  const mk = (id, n, r, p) => ({ n, id, lon: 0, lat: 0, r, p });
  // The La Ceiba twins (clues 130/132): duplicate GeoNames records for the
  // same city, both production days — both must survive.
  const pins = new Set(["geonames:1", "geonames:2"]);
  const out = dedupeEntries(
    [mk("geonames:1", "la ceiba", "Honduras", 222055), mk("geonames:2", "la ceiba", "Honduras", 215973)],
    pins,
  );
  assert.equal(out.length, 2);
});

test("dedupeEntries without pins keeps the old highest-population behavior", () => {
  const mk = (id, n, r, p) => ({ n, id, lon: 0, lat: 0, r, p });
  const out = dedupeEntries([
    mk("geonames:1", "la ceiba", "Honduras", 222055),
    mk("geonames:2", "la ceiba", "Honduras", 215973),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "geonames:1");
});

test("dedupeEntries drops empty normalized names", () => {
  const out = dedupeEntries([{ n: "", id: "x", lon: 0, lat: 0, r: "r", p: 0 }]);
  assert.equal(out.length, 0);
});

test("regionLabel builds State, Country for states and Country otherwise", () => {
  assert.equal(
    regionLabel({ iso2: "US", edition: "state", regionId: "new-york" }),
    "New York, United States",
  );
  assert.equal(
    regionLabel({ iso2: "GB", edition: "country", regionId: "united-kingdom" }),
    "United Kingdom",
  );
  assert.equal(
    regionLabel({ iso2: "RU", edition: "globe", regionId: "globe" }),
    "Russia",
  );
});

// ---------------------------------------------------------------------------
// generated guess index
// ---------------------------------------------------------------------------

test("names.json entries are well-formed and normalized", () => {
  const entries = readJson(join(OUT_DIR, "names.json"));
  const targetIds = loadLoopTargetIds(join(OUT_DIR, "clues"));
  assert.ok(Array.isArray(entries) && entries.length > 100_000);
  const seen = new Map();
  for (const e of entries) {
    assert.equal(typeof e.n, "string");
    assert.ok(e.n.length > 0);
    assert.equal(e.n, normalizeName(e.n), `not normalized: ${e.n}`);
    assert.match(e.id, /^geonames:\d+$/);
    assert.ok(typeof e.lon === "number" && e.lon >= -180 && e.lon <= 180);
    assert.ok(typeof e.lat === "number" && e.lat >= -90 && e.lat <= 90);
    assert.equal(typeof e.r, "string");
    assert.ok(e.r.length > 0);
    assert.equal(typeof e.p, "number");
    const key = `${e.n}||${e.r}`;
    // (name, region) is unique except for pinned production-target twins
    // (e.g. the two La Ceiba clue days) — identical options a typist cannot
    // tell apart, each carrying its own day's placeId.
    if (seen.has(key)) {
      const other = seen.get(key);
      assert.ok(
        targetIds.has(e.id) && targetIds.has(other.id),
        `duplicate ${key} with non-target entry`,
      );
    } else {
      seen.set(key, e);
    }
  }
  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i - 1].p >= entries[i].p, "not sorted by population desc");
  }
});

test("springfield yields several distinct regions", () => {
  const entries = readJson(join(OUT_DIR, "names.json"));
  const regions = new Set(
    entries.filter((e) => e.n === "springfield").map((e) => e.r),
  );
  assert.ok(regions.size >= 3, `only ${regions.size} springfields`);
  assert.ok([...regions].some((r) => r.includes("Illinois")));
  assert.ok([...regions].some((r) => r.includes("Missouri")));
});

test("production loop targets are guessable by their own names", () => {
  const entries = readJson(join(OUT_DIR, "names.json"));
  const byId = new Map();
  for (const e of entries) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  // La Ceiba (clues/132.json) and Williamstown (clues/370.json) — both
  // absent from the old placeholder-era index; the regenerate-don't-patch
  // rule requires the builder to pick them up from the chunks.
  assert.ok(byId.has("geonames:8556321"), "La Ceiba missing from names.json");
  assert.ok(byId.has("geonames:2058304"), "Williamstown missing from names.json");

  // B1 build gate: EVERY production clue target must be present in the
  // index — pin-through-dedupe, not hand-patching.
  const targetIds = [...loadLoopTargetIds(join(OUT_DIR, "clues"))].sort();
  assert.equal(targetIds.length, 387, `expected 387 clue targets, got ${targetIds.length}`);
  const absent = targetIds.filter((id) => !byId.has(id));
  assert.deepEqual(absent, [], `${absent.length} clue targets missing from names.json`);
});

test("every production loop target is reachable by typing its own display name", () => {
  // Presence is not enough — a target crowded out of the typeahead's top-8
  // is still an unwinnable day. Typing the target's own display name must
  // surface it in the top-8 suggestions, using the REAL runtime ranker (no
  // logic duplication). NOTE: this types the indexed (normalized) name; the
  // natural-name findability gate lives in build-loop.mjs itself
  // (assertTargetsFindable), which has the unnormalized names in memory.
  const entries = readJson(join(OUT_DIR, "names.json"));
  const byId = new Map();
  for (const e of entries) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const targetIds = [...loadLoopTargetIds(join(OUT_DIR, "clues"))].sort();
  const failures = [];
  for (const id of targetIds) {
    const entry = byId.get(id);
    if (!entry) {
      failures.push(`${id}: absent from names.json`);
      continue;
    }
    // A player types the display name ("La Ceiba, Honduras" normalizes to
    // the entry's own normalized name) — the day's placeId must be pickable.
    const { suggestions, total } = rankLoopSuggestions(entries, entry.n, 8);
    if (!suggestions.some((s) => s.id === id)) {
      failures.push(`${id} (${entry.n}, ${entry.r}): not in top-8 for its own name (${total} matches)`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} targets unreachable by their own name:\n${failures.join("\n")}`);
});

test("tricky natural names are findable (B1 regression: build/runtime normalizer parity)", () => {
  // 2026-10-05: the build pipeline and the runtime typeahead had duplicated
  // normalizers that disagreed on punctuation and non-decomposable letters
  // (ł, ı) — Białystok and Hınıs were in the index but unfindable by typing
  // their natural names. These queries must surface the right place id.
  const entries = readJson(join(OUT_DIR, "names.json"));
  const cases = [
    ["Białystok", "geonames:776069"],
    ["Hınıs", "geonames:312114"],
    ["Winston-Salem", "geonames:4499612"],
    ["N'Djamena", "geonames:2427123"],
  ];
  for (const [query, id] of cases) {
    const { suggestions, total } = rankLoopSuggestions(entries, query, 8);
    assert.ok(
      suggestions.some((s) => s.id === id),
      `"${query}" should surface ${id} (got ${total} matches: ${suggestions.map((s) => s.id).join(", ")})`,
    );
  }
});

test("buildNamesIndex sorts by population desc then name", () => {
  const places = [
    { numericId: "1", name: "Bravo", lon: 0, lat: 0, iso2: "US", edition: "state", regionId: "texas" },
    { numericId: "2", name: "Alpha", lon: 0, lat: 0, iso2: "US", edition: "state", regionId: "texas" },
    { numericId: "3", name: "Charlie", lon: 0, lat: 0, iso2: "US", edition: "state", regionId: "texas" },
  ];
  const pops = new Map([["1", 10], ["2", 10], ["3", 99]]);
  const out = buildNamesIndex(places, pops, []);
  assert.deepEqual(out.map((e) => e.n), ["charlie", "alpha", "bravo"]);
});
