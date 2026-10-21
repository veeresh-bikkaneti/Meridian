/**
 * territory.ts lazy-load tests (P0 Safari launch fix; F2b deferral).
 *
 * The countries-50m TopoJSON must NOT load — and its TopoJSON→GeoJSON
 * `feature()` conversion must NOT run — at module evaluation (it was
 * the heaviest import-time allocation in the boot path, and the static
 * import made Rolldown preload the chunk on the home screen). The data
 * loads only when `preloadTerritory()` is called, at most once, and the
 * conversion runs at most once, on that first load; every lookup after
 * that reuses the memoized result. Before the load lands, the sync
 * `territoryAt` fails closed to null and never starts the load itself
 * (the reverse-geocode admin-1 contract).
 *
 * NOTE: this file must not import any other module that touches territory
 * before the "no eager load" tests run — node runs a file's tests in
 * order, and the module is fresh per test process.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  missingContinents,
  preloadTerritory,
  territoryAt,
  territoryConversionRunsForTests,
  territoryLoadRunsForTests,
} from "./territory.ts";

test("no load and no conversion at module evaluation time", () => {
  assert.equal(
    territoryLoadRunsForTests(),
    0,
    "importing territory.ts must not start the countries-50m load",
  );
  assert.equal(
    territoryConversionRunsForTests(),
    0,
    "importing territory.ts must not run the feature() conversion",
  );
});

test("territoryAt fails closed before preload and never triggers the load", () => {
  assert.equal(territoryAt([2.35, 48.85]), null);
  assert.equal(territoryAt([0, 0]), null);
  assert.equal(
    territoryLoadRunsForTests(),
    0,
    "a sync lookup must never start the async load",
  );
});

test("preload loads exactly once; lookups then resolve and reuse it", async () => {
  await preloadTerritory();
  assert.equal(territoryLoadRunsForTests(), 1);
  assert.equal(territoryConversionRunsForTests(), 1);

  const paris = territoryAt([2.35, 48.85]);
  assert.deepEqual(paris, { key: "250", name: "France", continent: "europe" });

  // More lookups — different points, including a miss — must not reload
  // or reconvert.
  assert.deepEqual(territoryAt([151.2, -33.87]), {
    key: "036",
    name: "Australia",
    continent: "oceania",
  });
  assert.equal(territoryAt([0, 0]), null);
  assert.deepEqual(territoryAt([2.35, 48.85]), paris);
  assert.equal(territoryLoadRunsForTests(), 1);
  assert.equal(
    territoryConversionRunsForTests(),
    1,
    "the conversion must run exactly once no matter how many lookups happen",
  );

  // Repeat preloads are no-ops (idempotent cached promise).
  await preloadTerritory();
  await preloadTerritory();
  assert.equal(territoryLoadRunsForTests(), 1);
});

test("missingContinents still resolves against the lazy index", async () => {
  assert.deepEqual(await missingContinents(), []);
});

test("preloadTerritory resolves — the never-rejects contract its awaiters rely on", async () => {
  // openRun, the boot restore, and onReplay all await preloadTerritory
  // before a run commits; the contract they rely on is that the promise
  // RESOLVES (a failed load degrades the sync readers fail-closed and
  // the next call retries — the retry-eviction branch itself is pinned
  // by shape in territory-lazy-boundary.test.ts, because this harness
  // loads the real atlas file and has no seam to force a load failure
  // without deforming production code).
  await assert.doesNotReject(() => preloadTerritory());
  await assert.doesNotReject(() => preloadTerritory());
  assert.equal(territoryLoadRunsForTests(), 1, "repeat preloads still reuse the settled load");
});
