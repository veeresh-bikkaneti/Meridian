import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PACKED_NAMES_VERSION, packNameIndex, unpackNameIndex } from "./names-codec.ts";
import { rankLoopSuggestions } from "./evaluate.ts";
import type { LoopNameEntry } from "./types.ts";

function entry(over: Partial<LoopNameEntry> = {}): LoopNameEntry {
  return { n: "springfield", id: "geonames:4250542", lon: -89.6501, lat: 39.7817, r: "Illinois, United States", p: 114230, ...over };
}

const SAMPLE: LoopNameEntry[] = [
  entry(),
  entry({ id: "geonames:4409896", lon: -93.2922, lat: 37.2153, r: "Missouri, United States", p: 169176 }),
  entry({ n: "new york", id: "geonames:5128581", lon: -74.006, lat: 40.7143, r: "New York, United States", p: 8804190 }),
  entry({ n: "bialystok", id: "geonames:776069", lon: 23.1643, lat: 53.1333, r: "Poland", p: 296000 }),
  entry({ n: "null island", id: "geonames:1", lon: 0, lat: 0, r: "Ocean", p: 0 }),
  entry({ n: "south pole", id: "geonames:9", lon: -180, lat: -90, r: "Antarctica", p: 12 }),
  entry({ n: "big id", id: "geonames:11111111111", lon: 179.9999, lat: 89.9999, r: "Poland", p: 2_000_000_000 }),
];

test("pack → unpack returns the exact entries, key order included", () => {
  const back = unpackNameIndex(JSON.parse(JSON.stringify(packNameIndex(SAMPLE))));
  assert.deepStrictEqual(back, SAMPLE);
});

test("pack interns each region once", () => {
  const packed = packNameIndex(SAMPLE);
  assert.equal(packed.v, PACKED_NAMES_VERSION);
  assert.equal(new Set(packed.regions).size, packed.regions.length);
  assert.equal(packed.regions.length, 6);
});

test("pack refuses entries it cannot round-trip", () => {
  assert.throws(() => packNameIndex([entry({ id: "tap:1,2" })]), /geonames/);
  assert.throws(() => packNameIndex([entry({ id: "geonames:12abc" })]), /geonames/);
  assert.throws(() => packNameIndex([entry({ id: "geonames:007" })]), /geonames/);
  assert.throws(() => packNameIndex([entry({ lon: 1.23456 })]), /decimals/);
  assert.throws(() => packNameIndex([entry({ lat: 1.00005 })]), /decimals/);
  assert.throws(() => packNameIndex([entry({ p: 1.5 })]), /integer/);
});

test("unpack fails closed on anything but a well-formed v2 index", () => {
  const good = JSON.parse(JSON.stringify(packNameIndex(SAMPLE)));
  const bad = (mutate: (d: Record<string, unknown>) => void): unknown => {
    const d = structuredClone(good) as Record<string, unknown>;
    mutate(d);
    return d;
  };
  const cases: unknown[] = [
    null,
    [],
    "x",
    // the pre-v2 array-of-objects file must not be mistaken for the new one
    [{ n: "a", id: "geonames:1", lon: 0, lat: 0, r: "x", p: 1 }],
    bad((d) => (d.v = 1)),
    bad((d) => delete d.regions),
    bad((d) => (d.lon = (d.lon as number[]).slice(1))),
    bad((d) => (d.p = (d.p as number[]).slice(0, -1))),
    bad((d) => ((d.r as number[])[0] = 99)),
    bad((d) => ((d.r as number[])[0] = -1)),
    bad((d) => ((d.id as unknown[])[0] = "1")),
    bad((d) => ((d.lat as number[])[0] = 1.5)),
    bad((d) => ((d.n as unknown[])[0] = 7)),
    bad((d) => (d.regions = [1])),
  ];
  for (const c of cases) assert.throws(() => unpackNameIndex(c), /unexpected shape/, JSON.stringify(c)?.slice(0, 80));
});

test("an empty index round-trips", () => {
  assert.deepStrictEqual(unpackNameIndex(packNameIndex([])), []);
});

test("packing does not change what the typeahead returns", () => {
  const through = unpackNameIndex(packNameIndex(SAMPLE));
  for (const q of ["springfield", "spring", "york", "new york", "bialystok", "pole", "zzz", "", "island null"]) {
    assert.deepStrictEqual(rankLoopSuggestions(through, q, 8), rankLoopSuggestions(SAMPLE, q, 8), q);
  }
});

// The shipped file. Reads from public/ so the check follows whatever
// build-loop.mjs last emitted.
const SHIPPED = new URL("../../../public/loop/names.v2.json", import.meta.url);

test("shipped names.v2.json decodes, and re-packing it reproduces it byte for byte", () => {
  const text = readFileSync(SHIPPED, "utf8");
  const decoded = unpackNameIndex(JSON.parse(text));
  assert.ok(decoded.length > 100_000, `only ${decoded.length} entries`);
  assert.equal(JSON.stringify(packNameIndex(decoded)), text);
});

test("shipped index: typeahead is identical before and after a pack round trip", () => {
  const decoded = unpackNameIndex(JSON.parse(readFileSync(SHIPPED, "utf8")));
  const roundTripped = unpackNameIndex(packNameIndex(decoded));
  // Names drawn from across the index (every 1999th row) plus the multi-word,
  // substring and region-suffix shapes players actually type.
  const queries = ["york", "new york", "springfield", "san", "st ", "lagos", "moscow", "paris texas", "la ceiba"];
  for (let i = 0; i < decoded.length; i += 1999) queries.push(decoded[i].n, decoded[i].n.slice(1, 5));
  assert.ok(queries.length > 100);
  for (const q of queries) {
    assert.deepStrictEqual(rankLoopSuggestions(roundTripped, q, 8), rankLoopSuggestions(decoded, q, 8), q);
  }
});
