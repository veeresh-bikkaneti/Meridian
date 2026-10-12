/**
 * build-coldtrail region-context tests: content audit + anti-leak + red-team.
 *
 * The deck (scripts/build-coldtrail.mjs, seed 20261008) now attaches
 * `region {continent, country, subdivision}` to every sighting, derived from
 * the WITNESS city's gazetteer record. These tests prove, against the
 * freshly-read chunks (not the generator's own memory):
 *   1. every sighting's region traces to its witness city's chunk record
 *      (zero mismatches — content audit);
 *   2. no region string names the hideout (anti-leak);
 *   3. the generator fails closed on unresolvable iso2 / missing
 *      subdivision (red-team).
 * Run: node --test scripts/build-coldtrail-region.test.mjs
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCase,
  buildDeck,
  LARGE_SUBDIVISION_ISO2,
  regionForCity,
} from "./build-coldtrail.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);

/** Fresh witness-city index straight from the chunks (the audit source). */
function cityIndex() {
  const byId = new Map();
  for (const file of readdirSync(join(ROOT, "src/game/data/geonames/chunks"))) {
    if (!file.endsWith(".json")) continue;
    const chunk = JSON.parse(
      readFileSync(join(ROOT, "src/game/data/geonames/chunks", file), "utf8"),
    );
    for (const p of chunk.places ?? []) byId.set(p.id, p);
  }
  return byId;
}

const CITIES = cityIndex();
const DECK = buildDeck();

function regionText(region) {
  return [region.continent, region.country, region.subdivision]
    .filter(Boolean)
    .join(" ");
}

test("content audit: all 180 sightings carry a complete, traced region", () => {
  assert.equal(DECK.length, 60, "60 cases");
  let count = 0;
  for (const c of DECK) {
    assert.equal(c.sightings.length, 3, `case ${c.caseNo}: 3 sightings`);
    for (const s of c.sightings) {
      count++;
      const record = CITIES.get(s.cityId);
      assert.ok(record, `sighting ${s.id}: chunk record for ${s.cityId}`);
      // The region is derivable from the witness city record alone:
      // the checked-in deck must match a fresh recomputation exactly.
      assert.deepEqual(
        s.region,
        regionForCity(record),
        `case ${c.caseNo} ${s.id} (${s.cityName}): region traces to gazetteer record`,
      );
      assert.ok(s.region.continent.length > 0, "continent non-empty");
      assert.ok(s.region.country.length > 0, "country non-empty");
      // Subdivision granularity rule: only the large-country set, and when
      // present it equals the gazetteer subdivision.
      const iso2 = String(record.iso2).toUpperCase();
      if (LARGE_SUBDIVISION_ISO2.has(iso2)) {
        assert.equal(
          s.region.subdivision,
          record.subdivision,
          `${s.cityName}: large-country subdivision matches gazetteer`,
        );
      } else {
        assert.equal(
          s.region.subdivision,
          null,
          `${s.cityName} (${iso2}): subdivision must be null outside the large-country set`,
        );
      }
    }
  }
  assert.equal(count, 180, "180 sightings audited");
});

test("anti-leak: no region string names the hideout", () => {
  for (const c of DECK) {
    const hideout = c.hideout.name.toLowerCase();
    for (const s of c.sightings) {
      const text = regionText(s.region).toLowerCase();
      assert.ok(
        !text.includes(hideout),
        `case ${c.caseNo}: region "${regionText(s.region)}" must not name hideout "${c.hideout.name}"`,
      );
      // The region is a pure function of the witness record (asserted above),
      // so it reveals nothing beyond the already-named witness city. The
      // clue sentence itself is untouched by region data — byte-identity of
      // all 180 clue texts against the pre-region deck was verified at
      // generation time (see the generation log).
    }
  }
});

test("red-team: the owner's Umraniye case resolves to Asia · Türkiye", () => {
  const c = DECK.find((x) => x.caseNo === 1);
  const umraniye = c.sightings.find((s) => s.cityName === "Umraniye");
  assert.ok(umraniye, "case 1 still opens on Umraniye");
  assert.deepEqual(umraniye.region, {
    continent: "Asia",
    country: "Türkiye",
    subdivision: null,
  });
});

function mockCity(over) {
  return {
    id: "gn-test-1",
    name: "Testville",
    lon: 0,
    lat: 0,
    difficulty: 1,
    iso2: "US",
    subdivision: "Texas",
    ...over,
  };
}

function mockHideout() {
  return {
    id: "gn-hideout-1",
    name: "Hideout City",
    lon: 10,
    lat: 0, // ~1112 km east of Testville: inside the 250–4000 band
    difficulty: 2,
  };
}

test("red-team: unknown iso2 fails closed (throws, never a silent gap)", () => {
  const city = mockCity({ iso2: "XX", name: "Nowhere" });
  assert.throws(() => regionForCity(city), /unresolvable iso2/);
  // Integration: three bad-iso2 witnesses at distinct octants inside the
  // witness band — buildCase must throw while mapping sightings, not deal
  // a thin or regionless case.
  const bad = [
    mockCity({ id: "gn-bad-1", iso2: "XX", name: "Nowhere East", lon: 0, lat: 0 }),
    mockCity({ id: "gn-bad-2", iso2: "XX", name: "Nowhere North", lon: 0, lat: 20 }),
    mockCity({ id: "gn-bad-3", iso2: "XX", name: "Nowhere Far", lon: 20, lat: 0 }),
  ];
  assert.throws(() => buildCase(1, mockHideout(), bad, () => 0.5), /unresolvable iso2/);
});

test("red-team: large-country city missing subdivision fails closed", () => {
  const city = mockCity({ iso2: "CN", subdivision: undefined, name: "Chongming-like" });
  assert.throws(() => regionForCity(city), /missing subdivision/);
});

test("red-team: subdivision is dropped outside the large-country set", () => {
  // Gazetteer may carry a subdivision for small countries; the granularity
  // rule says it must not render.
  const city = mockCity({
    iso2: "FR",
    subdivision: "Île-de-France",
    name: "Paris",
  });
  assert.deepEqual(regionForCity(city), {
    continent: "Europe",
    country: "France",
    subdivision: null,
  });
});

test("red-team: disputed-area naming follows the gazetteer (XK → Kosovo)", () => {
  const city = mockCity({ iso2: "XK", subdivision: undefined, name: "Pristina" });
  assert.deepEqual(regionForCity(city), {
    continent: "Europe",
    country: "Kosovo",
    subdivision: null,
  });
});
