/**
 * Unit tests for scripts/facts-qid-join.mjs.
 *
 * All tests use canned fixtures — NO network calls. Network paths
 * (resolveQidsByTitles, searchEntities, entityData, resolveCountryQid) are
 * exercised only in live runs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BATCH_TITLES,
  VERIFY_RADIUS_KM,
  entityCoords,
  entityCountries,
  haversineKm,
  interleaveRoundRobin,
  parseArgs,
  parseCrawlCache,
  parseResume,
  slugToTitle,
  verifyCandidate,
} from "./facts-qid-join.mjs";

// ---------------------------------------------------------------------------
// haversineKm
// ---------------------------------------------------------------------------

test("haversine: same point is 0 km", () => {
  assert.equal(haversineKm(40.7, -74.0, 40.7, -74.0), 0);
});

test("haversine: known distance — NYC to Philadelphia ~129 km", () => {
  // NYC (40.7128,-74.0060), Philadelphia (39.9526,-75.1652)
  const km = haversineKm(40.7128, -74.006, 39.9526, -75.1652);
  assert.ok(km > 120 && km < 140, `expected ~129 km, got ${km}`);
});

test("haversine: symmetric", () => {
  const a = haversineKm(10, 20, 30, 40);
  const b = haversineKm(30, 40, 10, 20);
  assert.ok(Math.abs(a - b) < 1e-9);
});

// ---------------------------------------------------------------------------
// verifyCandidate (the search-fallback acceptance gate)
// ---------------------------------------------------------------------------

const PLACE = { id: "gn-4046319", name: "Bayou La Batre", lat: 30.40352, lon: -88.24852, iso2: "US" };
const Q_US = "Q30"; // United States

function entityWith({ lat, lon, countries = [Q_US] }) {
  const e = { claims: {} };
  if (lat !== undefined && lon !== undefined) {
    e.claims.P625 = [
      { mainsnak: { datavalue: { value: { latitude: lat, longitude: lon } } } },
    ];
  }
  e.claims.P17 = countries.map((id) => ({
    mainsnak: { datavalue: { value: { id } } },
  }));
  return e;
}

test("verifyCandidate accepts an entity ~5 km away with matching country", () => {
  // ~5 km north of the place
  const e = entityWith({ lat: 30.44852, lon: -88.24852 });
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.equal(v.ok, true);
  assert.ok(v.km < VERIFY_RADIUS_KM, `expected <25 km, got ${v.km}`);
});

test("verifyCandidate rejects an entity ~30 km away", () => {
  // ~30 km north of the place
  const e = entityWith({ lat: 30.67352, lon: -88.24852 });
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "too-far");
  assert.ok(v.km > VERIFY_RADIUS_KM, `expected >25 km, got ${v.km}`);
});

test("verifyCandidate rejects an entity with no P625 coords", () => {
  const v = verifyCandidate(PLACE, entityWith({ countries: [Q_US] }), Q_US);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "missing-coords");
  assert.equal(v.km, null);
});

test("verifyCandidate rejects a near entity with the wrong country", () => {
  const e = entityWith({ lat: 30.44852, lon: -88.24852, countries: ["Q142"] }); // France
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "country-mismatch");
});

test("verifyCandidate skips the country check when the entity has no P17", () => {
  const e = entityWith({ lat: 30.44852, lon: -88.24852, countries: [] });
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.equal(v.ok, true);
});

test("verifyCandidate skips the country check when countryQid is unknown (null)", () => {
  const e = entityWith({ lat: 30.44852, lon: -88.24852, countries: ["Q142"] });
  const v = verifyCandidate(PLACE, e, null);
  assert.equal(v.ok, true);
});

test("verifyCandidate accepts an entity with several P17 values incl. the right one", () => {
  const e = entityWith({ lat: 30.44852, lon: -88.24852, countries: ["Q142", Q_US] });
  assert.equal(verifyCandidate(PLACE, e, Q_US).ok, true);
});

test("verifyCandidate boundary: just under 25 km accepts", () => {
  // 24.5 km north -> degrees: 24.5 / 111.195 ≈ 0.22034
  const e = entityWith({ lat: 30.40352 + 0.22034, lon: -88.24852 });
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.ok(v.km > 24 && v.km < 25, `km=${v.km}`);
  assert.equal(v.ok, true);
});

test("verifyCandidate boundary: just over 25 km rejects", () => {
  const e = entityWith({ lat: 30.40352 + 0.23, lon: -88.24852 });
  const v = verifyCandidate(PLACE, e, Q_US);
  assert.ok(v.km > 25 && v.km < 26, `km=${v.km}`);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "too-far");
});

// ---------------------------------------------------------------------------
// entityCoords / entityCountries edge cases
// ---------------------------------------------------------------------------

test("entityCoords returns null for non-numeric or missing values", () => {
  assert.equal(entityCoords({}), null);
  assert.equal(entityCoords(null), null);
  assert.equal(entityCoords({ claims: { P625: [] } }), null);
  assert.equal(
    entityCoords({
      claims: { P625: [{ mainsnak: { datavalue: { value: { latitude: "30", longitude: -88 } } } }] },
    }),
    null,
  );
});

test("entityCountries returns [] when P17 absent", () => {
  assert.deepEqual(entityCountries({}), []);
  assert.deepEqual(entityCountries(null), []);
});

// ---------------------------------------------------------------------------
// slugToTitle
// ---------------------------------------------------------------------------

test("slugToTitle normalizes underscores to spaces", () => {
  assert.equal(slugToTitle("Juneau,_Alaska"), "Juneau, Alaska");
  assert.equal(slugToTitle("Clio,_Alabama"), "Clio, Alabama");
});

test("slugToTitle leaves already-canonical titles alone", () => {
  assert.equal(slugToTitle("Beebe, Arkansas"), "Beebe, Arkansas");
  assert.equal(slugToTitle("Paris"), "Paris");
});

test("slugToTitle collapses stray whitespace", () => {
  assert.equal(slugToTitle("  Saint__Louis__  "), "Saint Louis");
});

// ---------------------------------------------------------------------------
// parseResume (resume-skip logic)
// ---------------------------------------------------------------------------

test("parseResume builds the done set and tolerates junk", () => {
  const lines = [
    '{"geonamesId":"gn-1","qid":"Q1","method":"slug","at":"2026-10-02T00:00:00Z"}',
    '{"geonamesId":"gn-2","qid":null,"method":"unmatched","at":"2026-10-02T00:00:00Z"}',
    "",
    "   ",
    '{"geonamesId":123}', // wrong type
    "{not json", // malformed
    '{"qid":"Q9"}', // no geonamesId
  ];
  const { done, malformed } = parseResume(lines);
  assert.deepEqual([...done].sort(), ["gn-1", "gn-2"]);
  assert.equal(malformed, 3);
});

test("parseResume: empty input gives an empty set", () => {
  const { done, malformed } = parseResume([]);
  assert.equal(done.size, 0);
  assert.equal(malformed, 0);
});

// ---------------------------------------------------------------------------
// parseCrawlCache
// ---------------------------------------------------------------------------

test("parseCrawlCache takes matched titles, ignores errors and junk", () => {
  const lines = [
    '{"id":"gn-4100984","status":"matched","title":"Beebe, Arkansas","at":"2026-10-01T00:00:00Z"}',
    '{"id":"gn-9972848","status":"error","error":"fetch failed","at":"2026-10-01T00:00:00Z"}',
    '{"id":"gn-x","status":"matched","at":"2026-10-01T00:00:00Z"}', // matched, no title
    "{broken",
    "",
  ];
  const r = parseCrawlCache(lines);
  assert.equal(r.titles.get("gn-4100984"), "Beebe, Arkansas");
  assert.equal(r.titles.size, 1);
  assert.equal(r.matched, 1);
  assert.equal(r.errors, 1);
  assert.equal(r.malformed, 1);
});

// ---------------------------------------------------------------------------
// interleaveRoundRobin
// ---------------------------------------------------------------------------

test("interleaveRoundRobin interleaves across groups", () => {
  assert.deepEqual(interleaveRoundRobin([["a1", "a2"], ["b1"], ["c1", "c2", "c3"]]), [
    "a1",
    "b1",
    "c1",
    "a2",
    "c2",
    "c3",
  ]);
});

test("interleaveRoundRobin handles empty groups", () => {
  assert.deepEqual(interleaveRoundRobin([[], ["a"], []]), ["a"]);
  assert.deepEqual(interleaveRoundRobin([]), []);
});

// ---------------------------------------------------------------------------
// buildWorkList: US/non-US alternation + resume skip
// ---------------------------------------------------------------------------

test("buildWorkList alternates US and non-US and skips done ids", async () => {
  const { buildWorkList } = await import("./facts-qid-join.mjs");
  const mk = (id, iso2, wiki) => ({ id, name: id, lon: 0, lat: 0, iso2, wiki: wiki ?? null });
  const groups = [
    [mk("gn-us-1", "US"), mk("gn-us-2", "US")],
    [mk("gn-fr-1", "FR", "Paris"), mk("gn-de-1", "DE")],
  ];
  const crawl = new Map([["gn-us-2", "Someplace, USA"]]);
  const done = new Set(["gn-de-1"]);
  const work = buildWorkList(groups, crawl, done, 10);
  assert.deepEqual(
    work.map((w) => w.place.id),
    ["gn-us-1", "gn-fr-1", "gn-us-2"],
  );
  // wiki slug preferred over crawl title; crawl title used when no slug
  assert.equal(work[1].title, "Paris");
  assert.equal(work[2].title, "Someplace, USA");
  // limit truncates the alternating order
  assert.deepEqual(
    buildWorkList(groups, crawl, done, 2).map((w) => w.place.id),
    ["gn-us-1", "gn-fr-1"],
  );
});

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

test("parseArgs parses run/report/--limit", () => {
  assert.deepEqual(parseArgs(["node", "x.mjs"]), { command: "run", limit: null });
  assert.deepEqual(parseArgs(["node", "x.mjs", "report"]), { command: "report", limit: null });
  assert.deepEqual(parseArgs(["node", "x.mjs", "--limit", "200"]), { command: "run", limit: 200 });
});

test("parseArgs rejects a bad --limit", () => {
  assert.throws(() => parseArgs(["node", "x.mjs", "--limit", "abc"]), /--limit/);
  assert.throws(() => parseArgs(["node", "x.mjs", "--limit", "0"]), /--limit/);
});

// ---------------------------------------------------------------------------
// Constants sanity
// ---------------------------------------------------------------------------

test("batch and verify constants match the spec", () => {
  assert.equal(BATCH_TITLES, 50);
  assert.equal(VERIFY_RADIUS_KM, 25);
});
