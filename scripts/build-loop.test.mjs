/**
 * Tests for the Daily Loop data pipeline (scripts/build-loop.mjs).
 *
 * Covers: name normalization, the (name, region) dedupe policy, the
 * day-index contract shared with the Loop runtime, seed guardrails
 * (no place name / demonym / region tag leaks into any clue), and schema
 * validity of the generated public/loop/{manifest,names,clues/*} files.
 *
 * The generated-file tests assume `node scripts/build-loop.mjs` has run.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildNamesIndex,
  dayIndexFor,
  dedupeEntries,
  loadSeed,
  normalizeName,
  regionLabel,
  verifySeedClues,
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
  const size = 12;
  for (const ms of [0, 1, 86_399_999, 86_400_000, 1_759_324_800_000, Date.now()]) {
    assert.equal(
      dayIndexFor(ms, size),
      Math.floor(ms / 86_400_000) % size,
      `mismatch at ${ms}`,
    );
  }
});

test("dayIndexFor stays within the pool and advances daily", () => {
  const size = 12;
  const day = 2_000 * 86_400_000;
  assert.ok(dayIndexFor(day, size) >= 0 && dayIndexFor(day, size) < size);
  assert.notEqual(
    dayIndexFor(day, size),
    dayIndexFor(day + 86_400_000, size),
    "index should usually advance each day (12-day cycle)",
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
// guardrails
// ---------------------------------------------------------------------------

test("verifySeedClues rejects a banned place name in any clue", () => {
  const seed = {
    place: "Paris",
    banned: ["paris"],
    eponyms: [],
    clues: ["a", "b", "c", "d", "the great city of Paris shines"],
  };
  assert.throws(() => verifySeedClues(seed), /banned phrase "paris"/);
});

test("verifySeedClues rejects an embedded banned word", () => {
  const seed = {
    place: "Paris",
    banned: ["paris"],
    eponyms: [],
    clues: ["a", "b", "c", "d", "full of parisians"],
  };
  assert.throws(() => verifySeedClues(seed), /embedded/);
});

test("verifySeedClues rejects eponyms only in clues 1-3", () => {
  const early = {
    place: "X",
    banned: [],
    eponyms: ["smith"],
    clues: ["smith founded it", "b", "c", "d", "e"],
  };
  assert.throws(() => verifySeedClues(early), /banned phrase "smith"/);
  const late = {
    place: "X",
    banned: [],
    eponyms: ["smith"],
    clues: ["a", "b", "c", "d", "named after smith himself"],
  };
  assert.doesNotThrow(() => verifySeedClues(late));
});

test("verifySeedClues rejects long or missing clues", () => {
  const long = {
    place: "X",
    banned: [],
    eponyms: [],
    clues: ["a", "b", "c", "d", new Array(42).fill("word").join(" ")],
  };
  assert.throws(() => verifySeedClues(long), /max 40/);
  assert.throws(
    () => verifySeedClues({ place: "X", banned: [], eponyms: [], clues: ["a"] }),
    /expected 5 clues/,
  );
});

test("all 12 seed clue sets pass the guardrails", () => {
  const { seeds } = loadSeed();
  assert.equal(seeds.length, 12);
  for (const seed of seeds) {
    assert.doesNotThrow(() => verifySeedClues(seed), `seed ${seed.place}`);
    assert.match(seed.wikipedia, /^https:\/\/en\.wikipedia\.org\/wiki\//);
  }
});

// ---------------------------------------------------------------------------
// generated files
// ---------------------------------------------------------------------------

test("manifest.json has the pool contract shape", () => {
  const manifest = readJson(join(OUT_DIR, "manifest.json"));
  assert.equal(manifest.v, 1);
  assert.equal(manifest.size, 12);
  assert.ok(!Number.isNaN(Date.parse(manifest.generatedAt)), "ISO timestamp");
});

test("clue files match seeds in order with valid schema", () => {
  const { seeds } = loadSeed();
  const files = readdirSync(join(OUT_DIR, "clues"))
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  assert.equal(files.length, seeds.length);
  files.forEach((file, i) => {
    const clueFile = readJson(join(OUT_DIR, "clues", file));
    const seed = seeds[i];
    assert.equal(clueFile.v, 1, file);
    assert.equal(clueFile.placeId, `geonames:${seed.geonamesId}`, file);
    assert.ok(
      clueFile.target.lon >= -180 && clueFile.target.lon <= 180,
      `${file} lon`,
    );
    assert.ok(
      clueFile.target.lat >= -90 && clueFile.target.lat <= 90,
      `${file} lat`,
    );
    assert.equal(clueFile.clues.length, 5, file);
    for (const clue of clueFile.clues) {
      assert.equal(typeof clue, "string");
      assert.ok(clue.trim().split(/\s+/).length <= 40, `${file} clue too long`);
    }
    assert.deepEqual(clueFile.clues, seed.clues, `${file} clues != seed`);
    assert.equal(clueFile.source.label, "Wikipedia");
    assert.equal(clueFile.source.href, seed.wikipedia);
  });
});

test("day index always resolves to an existing clue file", () => {
  const manifest = readJson(join(OUT_DIR, "manifest.json"));
  const files = new Set(readdirSync(join(OUT_DIR, "clues")));
  for (let d = 0; d < 40; d++) {
    const idx = dayIndexFor(d * 86_400_000, manifest.size);
    assert.ok(files.has(`${idx}.json`), `missing clues/${idx}.json`);
  }
});

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

test("every seed place is guessable and aliases resolve", () => {
  const { seeds, aliases } = loadSeed();
  const entries = readJson(join(OUT_DIR, "names.json"));
  for (const seed of seeds) {
    const matches = entries.filter((e) => e.id === `geonames:${seed.geonamesId}`);
    assert.ok(
      matches.some((e) => e.n === normalizeName(seed.place)),
      `seed ${seed.place} not guessable by its own name in names.json`,
    );
  }
  const byName = new Map();
  for (const e of entries) if (!byName.has(e.n)) byName.set(e.n, e);
  assert.equal(byName.get("nyc").id, "geonames:5128581");
  assert.equal(byName.get("rio").id, "geonames:3451190");
  assert.equal(byName.get("big apple").id, "geonames:5128581");
  assert.equal(byName.get("la").id, "geonames:5368361");
  assert.equal(byName.get("sf").id, "geonames:5391959");
  assert.ok(byName.get("nyc").p > 1_000_000, "alias keeps real population");
  for (const a of aliases) {
    assert.ok(byName.get(a.alias), `alias ${a.alias} missing`);
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
