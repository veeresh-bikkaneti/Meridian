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
  pinCompareLine,
  preloadAdmin1Boundaries,
  resolvePin,
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
