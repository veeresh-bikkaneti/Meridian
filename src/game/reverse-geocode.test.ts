/**
 * reverse-geocode.ts tests.
 *
 * Covers the Worker A contract for the reveal pin-compare feature:
 * - importing the module parses NO admin-1 JSONs (Safari jetsam rule);
 * - resolvePin degrades to country-only before preload and never throws;
 * - preloadAdmin1Boundaries() is idempotent (no double parse);
 * - known coordinates encode what the vendored data REALLY says
 *   (verified by hand against us-atlas / ne-50m / world-atlas);
 * - pinCompareLine emits the four fixed copy variants and fails closed.
 *
 * NOTE: node runs a file's tests in order, so the "no eager parse"
 * assertions must come before the first preload call in this file.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  admin1LoadRunsForTests,
  NEAREST_PLACE_MAX_KM,
  nearestPoolPlace,
  pinCompareLine,
  preloadAdmin1Boundaries,
  resolvePin,
  revealPinLine,
  type PoolPlace,
  type ResolvedPin,
} from "./reverse-geocode.ts";

test("importing the module parses no admin-1 boundaries", () => {
  assert.deepEqual(
    admin1LoadRunsForTests(),
    { us: 0, ne: 0 },
    "importing reverse-geocode.ts must not load the admin-1 JSONs",
  );
});

test("resolvePin is country-only before preload and never triggers loading", () => {
  const lincoln = resolvePin(40.8126, -96.7026);
  assert.deepEqual(lincoln, { admin1: null, country: "United States of America" });
  assert.deepEqual(
    admin1LoadRunsForTests(),
    { us: 0, ne: 0 },
    "resolvePin must never start an admin-1 load",
  );
});

test("resolvePin never throws, even on garbage input", () => {
  assert.equal(resolvePin(Number.NaN, Number.NaN), null);
  assert.equal(resolvePin(Infinity, -Infinity), null);
  // Still null (not a throw) for ocean points.
  assert.equal(resolvePin(0, -140), null);
});

test("preloadAdmin1Boundaries loads once; repeat calls do not re-parse", async () => {
  await preloadAdmin1Boundaries();
  assert.deepEqual(admin1LoadRunsForTests(), { us: 1, ne: 1 });
  await preloadAdmin1Boundaries();
  await preloadAdmin1Boundaries();
  assert.deepEqual(
    admin1LoadRunsForTests(),
    { us: 1, ne: 1 },
    "preload must be idempotent — no double parse of the JSONs",
  );
});

test("known pins resolve to what the vendored data really says", () => {
  // Lincoln, Nebraska — us-atlas name is "Nebraska"; world-atlas names the
  // country "United States of America" (verified, not assumed).
  assert.deepEqual(resolvePin(40.8126, -96.7026), {
    admin1: "Nebraska",
    country: "United States of America",
  });
  // us-atlas DOES include DC (56 geometries); verified by geoContains.
  assert.deepEqual(resolvePin(38.9072, -77.0369), {
    admin1: "District of Columbia",
    country: "United States of America",
  });
  // France has no admin-1 source (ne-50m covers AU/BR/CA/CN/IN only).
  assert.deepEqual(resolvePin(48.8566, 2.3522), { admin1: null, country: "France" });
  assert.deepEqual(resolvePin(-33.8688, 151.2093), {
    admin1: "New South Wales",
    country: "Australia",
  });
  // Mid-Pacific ocean point — fail closed.
  assert.equal(resolvePin(0, -140), null);
});

test("pinCompareLine: same admin1 -> 'Right state, wrong town!'", () => {
  const pin: ResolvedPin = { admin1: "Nebraska", country: "United States of America" };
  assert.equal(pinCompareLine(pin, pin), "Right state, wrong town!");
});

test("pinCompareLine: same country, different admin1 -> named pair", () => {
  const player: ResolvedPin = { admin1: "Nebraska", country: "United States of America" };
  const truth: ResolvedPin = {
    admin1: "District of Columbia",
    country: "United States of America",
  };
  assert.equal(
    pinCompareLine(player, truth),
    "Your pin: Nebraska · True spot: District of Columbia",
  );
});

test("pinCompareLine: same country, admin1 unknown -> 'Right country, wrong town!'", () => {
  const player: ResolvedPin = { admin1: null, country: "France" };
  const truth: ResolvedPin = { admin1: null, country: "France" };
  assert.equal(pinCompareLine(player, truth), "Right country, wrong town!");

  // One side missing admin-1 still takes the country branch (not the named
  // pair branch), per the contract.
  const usPlayer: ResolvedPin = { admin1: null, country: "United States of America" };
  const usTruth: ResolvedPin = { admin1: "Nebraska", country: "United States of America" };
  assert.equal(pinCompareLine(usPlayer, usTruth), "Right country, wrong town!");
});

test("pinCompareLine: different countries -> named pair, admin1 preferred", () => {
  const player: ResolvedPin = { admin1: "Nebraska", country: "United States of America" };
  const truth: ResolvedPin = { admin1: null, country: "France" };
  assert.equal(
    pinCompareLine(player, truth),
    "Your pin: Nebraska · True spot: France",
  );
  // Both sides with admin-1.
  const sydney: ResolvedPin = { admin1: "New South Wales", country: "Australia" };
  assert.equal(
    pinCompareLine(sydney, player),
    "Your pin: New South Wales · True spot: Nebraska",
  );
});

test("pinCompareLine fails closed on nulls", () => {
  const pin: ResolvedPin = { admin1: "Nebraska", country: "United States of America" };
  assert.equal(pinCompareLine(null, pin), null);
  assert.equal(pinCompareLine(pin, null), null);
  assert.equal(pinCompareLine(null, null), null);
  assert.equal(pinCompareLine({ admin1: "Nebraska", country: null }, pin), null);
  assert.equal(pinCompareLine(pin, { admin1: null, country: null }), null);
});

test("end-to-end: resolvePin output feeds pinCompareLine", () => {
  const player = resolvePin(40.8126, -96.7026); // Nebraska
  const truth = resolvePin(38.9072, -77.0369); // District of Columbia
  assert.equal(
    pinCompareLine(player, truth),
    "Your pin: Nebraska · True spot: District of Columbia",
  );
  // Same pin twice: same admin1 branch.
  assert.equal(pinCompareLine(player, player), "Right state, wrong town!");
});

// ---------------------------------------------------------------------------
// Nearest-place "Your pin" fallback (fix/reveal-your-pin-country-globe)
//
// Veeresh's live-play diagnostic (2026-10-04): ne-50m-admin-1.json carries
// admin-1 features for exactly AU/BR/CA/CN/IN (36 for IN) and ZERO for
// IT/FR — US comes from us-atlas. So Italy/France pins resolve admin1: null
// on both sides and the classic path silently drops the "Your pin" line
// ("Right country, wrong town!"), while India works via its 36 vendored
// features. These tests lock the fallback in the same established style:
// known coordinates encode what the vendored data REALLY says (measured,
// not assumed — see the probe notes).
// ---------------------------------------------------------------------------

// Synthetic Italy-chunk-style pool: distances measured with haversine.
const ITALY_POOL: PoolPlace[] = [
  { name: "Cagliari", lon: 9.1217, lat: 39.2238, subdivision: "Sardinia" },
  { name: "Sassari", lon: 8.5603, lat: 40.7259, subdivision: "Sardinia" },
  { name: "Olbia", lon: 9.4975, lat: 40.9239, subdivision: "Sardinia" },
  { name: "Reggio di Calabria", lon: 15.6512, lat: 38.1144, subdivision: "Calabria" },
];

// Synthetic globe-chunk-style pool: the 13 country-chunk nations (incl.
// Italy) are excluded from the real globe chunk, so a Milan pin's nearest
// candidate is cross-border. NOTE: Chiasso can NOT be the test candidate —
// the vendored world-atlas 50m boundary places Chiasso inside Italy
// (key "380"); Mendrisio, 48.1 km from Milan, genuinely resolves to
// Switzerland ("756") and is the honest gate test.
const GLOBE_POOL_NO_ITALY: PoolPlace[] = [
  { name: "Mendrisio", lon: 8.9814, lat: 45.8719, subdivision: "Ticino" },
  { name: "Nice", lon: 7.2663, lat: 43.7034, subdivision: "Provence-Alpes-Côte d'Azur" },
];

const CALABRIA_TRUTH = {
  name: "Reggio di Calabria",
  lat: 38.1144,
  lon: 15.6512,
  subdivision: "Calabria",
  iso2: "IT",
  regionId: "italy",
};

test("NEAREST_PLACE_MAX_KM is the 100 km honesty budget", () => {
  assert.equal(NEAREST_PLACE_MAX_KM, 100);
});

test("nearestPoolPlace: Sardinia pin names the nearest Italian place", () => {
  const detail = nearestPoolPlace(39.3, 9.15, ITALY_POOL);
  assert.ok(detail, "a same-territory place within 100 km must produce detail");
  assert.equal(detail.territoryKey, "380");
  assert.equal(detail.territoryName, "Italy");
  assert.equal(detail.nearest.name, "Cagliari");
  assert.equal(detail.nearest.subdivision, "Sardinia");
  assert.ok(
    detail.nearest.distanceKm < NEAREST_PLACE_MAX_KM,
    "Cagliari is ~8.8 km from the pin",
  );
});

test("nearestPoolPlace: territory gate rejects a nearer cross-border place", () => {
  // Milan pin (Italy, "380"); Mendrisio is Switzerland ("756") at 48.1 km —
  // inside the budget, but the gate must reject it (numeric keys, never
  // name-compared).
  assert.equal(nearestPoolPlace(45.4642, 9.19, GLOBE_POOL_NO_ITALY), null);
});

test("nearestPoolPlace: 100 km cap rejects a far same-territory place", () => {
  const far = [{ name: "Rome", lon: 12.4964, lat: 41.9028, subdivision: "Lazio" }];
  // Milan→Rome is ~477 km: same territory, over the budget.
  assert.equal(nearestPoolPlace(45.4642, 9.19, far), null);
});

test("nearestPoolPlace fails closed: ocean, empty pool, garbage input", () => {
  assert.equal(nearestPoolPlace(0, -140, ITALY_POOL), null, "ocean pin");
  assert.equal(nearestPoolPlace(40.8126, -96.7026, []), null, "empty pool");
  assert.equal(nearestPoolPlace(Number.NaN, 9.15, ITALY_POOL), null);
  assert.equal(nearestPoolPlace(39.3, Number.NaN, ITALY_POOL), null);
});

test("revealPinLine: state edition keeps the classic line byte-identical", () => {
  const input = {
    edition: "state" as const,
    playerLat: 40.8126,
    playerLon: -96.7026,
    truth: {
      name: "Washington",
      lat: 38.9072,
      lon: -77.0369,
      subdivision: "District of Columbia",
      iso2: "US",
      regionId: "district-of-columbia",
    },
    pool: [{ name: "Lincoln", lon: -96.7026, lat: 40.8126, subdivision: "Nebraska" }],
  };
  const classic = pinCompareLine(
    resolvePin(input.playerLat, input.playerLon),
    resolvePin(input.truth.lat, input.truth.lon),
  );
  assert.equal(revealPinLine(input), classic, "state edition is the regression lock");
  // Even with an honest detail available in the pool, the state line must
  // NOT change — the detail path is country/globe only.
  assert.notEqual(
    nearestPoolPlace(input.playerLat, input.playerLon, input.pool),
    null,
    "sanity: the pool really does contain an honest detail",
  );
});

test("revealPinLine: country edition, same country — the Sardinia screenshot", () => {
  const line = revealPinLine({
    edition: "country",
    playerLat: 39.3,
    playerLon: 9.15,
    truth: CALABRIA_TRUTH,
    pool: ITALY_POOL,
  });
  assert.equal(
    line,
    "Your pin: near Cagliari, Sardinia · True spot: Reggio di Calabria, Calabria",
  );
});

test("revealPinLine: country edition, different country — pin side carries the suffix", () => {
  // Pin exactly ON Nice (distance 0): the "near" qualifier is still
  // unconditional — the pin is a raw lat/lon, never an exact pick.
  const line = revealPinLine({
    edition: "country",
    playerLat: 43.7034,
    playerLon: 7.2663,
    truth: CALABRIA_TRUTH,
    pool: [
      { name: "Nice", lon: 7.2663, lat: 43.7034, subdivision: "Provence-Alpes-Côte d'Azur" },
    ],
  });
  assert.equal(
    line,
    "Your pin: near Nice, Provence-Alpes-Côte d'Azur, France · True spot: Reggio di Calabria, Calabria",
  );
});

test("revealPinLine: globe edition — both sides carry the country suffix", () => {
  const line = revealPinLine({
    edition: "globe",
    playerLat: 39.3,
    playerLon: 9.15,
    truth: CALABRIA_TRUTH,
    pool: ITALY_POOL,
  });
  assert.equal(
    line,
    "Your pin: near Cagliari, Sardinia, Italy · True spot: Reggio di Calabria, Calabria, Italy",
  );
});

test("revealPinLine: globe truth country funnels through regionId (no iso2)", () => {
  const line = revealPinLine({
    edition: "globe",
    playerLat: 39.3,
    playerLon: 9.15,
    // Curated place: no iso2 — the regionId path must still name the country.
    truth: {
      name: "Reggio di Calabria",
      lat: 38.1144,
      lon: 15.6512,
      subdivision: "Calabria",
      regionId: "italy",
    },
    pool: ITALY_POOL,
  });
  assert.equal(
    line,
    "Your pin: near Cagliari, Sardinia, Italy · True spot: Reggio di Calabria, Calabria, Italy",
  );
});

test("revealPinLine: missing subdivision omits the segment, never renders 'null'", () => {
  // Kyoto has no subdivision in this pool; the vendored territory name is
  // "Japan" (key "392") — verified, not assumed.
  const line = revealPinLine({
    edition: "globe",
    playerLat: 35.0116,
    playerLon: 135.7681,
    truth: CALABRIA_TRUTH,
    pool: [{ name: "Kyoto", lon: 135.7681, lat: 35.0116 }],
  });
  assert.equal(
    line,
    "Your pin: near Kyoto, Japan · True spot: Reggio di Calabria, Calabria, Italy",
  );
});

test("revealPinLine: detail null → classic line (never silently drops)", () => {
  // Globe-style pool without Italy: the Milan pin's nearest candidate is
  // cross-border (gate) — the classic country-level line must render.
  const input = {
    edition: "globe" as const,
    playerLat: 43.7034,
    playerLon: 7.2663,
    truth: CALABRIA_TRUTH,
    pool: [{ name: "Genoa", lon: 8.9332, lat: 44.4056, subdivision: "Liguria" }],
  };
  const line = revealPinLine(input);
  const classic = pinCompareLine(
    resolvePin(input.playerLat, input.playerLon),
    resolvePin(input.truth.lat, input.truth.lon),
  );
  assert.equal(line, classic, "gate failure must fall back to the classic line");
  assert.equal(line, "Your pin: France · True spot: Italy");
});

test("INDIA REGRESSION LOCK: country edition names both locations, never drops the line", () => {
  // India is the working reference: ne-50m-admin-1.json carries 36 Indian
  // admin-1 features (verified: Mumbai → Maharashtra, Bengaluru →
  // Karnataka), so the classic path names both states. The detail line may
  // supersede it — the invariant is: both locations named, line never null.
  const indiaPool: PoolPlace[] = [
    { name: "Mumbai", lon: 72.8777, lat: 19.076, subdivision: "Maharashtra" },
    { name: "Bengaluru", lon: 77.5946, lat: 12.9716, subdivision: "Karnataka" },
  ];
  const line = revealPinLine({
    edition: "country",
    playerLat: 19.076,
    playerLon: 72.8777,
    truth: {
      name: "Bengaluru",
      lat: 12.9716,
      lon: 77.5946,
      subdivision: "Karnataka",
      iso2: "IN",
      regionId: "india",
    },
    pool: indiaPool,
  });
  assert.ok(line, "the line must never be null when both locations are known");
  assert.ok(line.includes("Your pin:"), "the player's side must be named");
  assert.ok(line.includes("True spot:"), "the truth side must be named");
  assert.ok(line.includes("Mumbai"), "player city named");
  assert.ok(line.includes("Bengaluru"), "truth city named");
  // The richer detail line supersedes the classic named pair here.
  assert.equal(
    line,
    "Your pin: near Mumbai, Maharashtra · True spot: Bengaluru, Karnataka",
  );
});

test("India: the classic reference path already names both admin-1s", () => {
  const line = pinCompareLine(
    resolvePin(19.076, 72.8777),
    resolvePin(12.9716, 77.5946),
  );
  assert.equal(line, "Your pin: Maharashtra · True spot: Karnataka");
});
