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
  normalizeName,
  regionLabel,
} from "./build-loop.mjs";

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
  assert.ok(Array.isArray(entries) && entries.length > 100_000);
  const seen = new Set();
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
    assert.ok(!seen.has(`${e.n}||${e.r}`), `duplicate ${e.n}||${e.r}`);
    seen.add(`${e.n}||${e.r}`);
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
