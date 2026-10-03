/**
 * territory.ts lazy-init tests (P0 Safari launch fix).
 *
 * The TopoJSON→GeoJSON `feature()` conversion must NOT run at module
 * evaluation (it was the heaviest import-time allocation in the boot path);
 * it runs at most once, on the first lookup, and every lookup after that
 * reuses the memoized result.
 *
 * NOTE: this file must not import any other module that touches territory
 * before the "no eager conversion" test runs — node runs a file's tests in
 * order, and the module is fresh per test process.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  missingContinents,
  territoryAt,
  territoryConversionRunsForTests,
} from "./territory.ts";

test("no conversion at module evaluation time", () => {
  assert.equal(
    territoryConversionRunsForTests(),
    0,
    "importing territory.ts must not run the feature() conversion",
  );
});

test("first lookup converts exactly once; later lookups reuse it", () => {
  const paris = territoryAt([2.35, 48.85]);
  assert.deepEqual(paris, { key: "250", name: "France", continent: "europe" });
  assert.equal(territoryConversionRunsForTests(), 1);

  // More lookups — different points, including a miss — must not reconvert.
  assert.deepEqual(territoryAt([151.2, -33.87]), {
    key: "036",
    name: "Australia",
    continent: "oceania",
  });
  assert.equal(territoryAt([0, 0]), null);
  assert.deepEqual(territoryAt([2.35, 48.85]), paris);
  assert.equal(
    territoryConversionRunsForTests(),
    1,
    "the conversion must run exactly once no matter how many lookups happen",
  );
});

test("missingContinents still resolves against the lazy index", () => {
  assert.deepEqual(missingContinents(), []);
});
