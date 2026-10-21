/**
 * territory.ts lazy-load FAILURE path — executed, not source-pinned
 * (PR #203 QA nit). The never-rejects / fail-closed / retry-eviction
 * contract used to be pinned by shape only, because the module had no
 * seam to force a load failure. territoryImporterForTests is that seam;
 * this file runs in its own process so the module state starts fresh.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  preloadTerritory,
  territoryAt,
  territoryImporterForTests,
  territoryLoadRunsForTests,
} from "./territory.ts";

test("a failed atlas import degrades fail-closed, never rejects, and the next preload retries", async () => {
  let attempts = 0;
  territoryImporterForTests(() => {
    attempts += 1;
    return Promise.reject(new Error("simulated chunk failure"));
  });
  try {
    // preloadTerritory must RESOLVE even when the import fails — openRun,
    // the boot restore, and onReplay await it before a run commits.
    await assert.doesNotReject(() => preloadTerritory());
    assert.equal(attempts, 1, "the failing importer ran once");
    assert.equal(territoryLoadRunsForTests(), 1);

    // Sync readers degrade to their fail-closed result while unloaded.
    assert.equal(territoryAt([2.35, 48.85]), null, "Paris fails closed to null");

    // Retry eviction: the failed load must not poison the cache — the
    // next preload starts a fresh import instead of reusing the corpse.
    await assert.doesNotReject(() => preloadTerritory());
    assert.equal(attempts, 2, "the retry re-imports (failed load was evicted)");
    assert.equal(territoryLoadRunsForTests(), 2);
    assert.equal(territoryAt([2.35, 48.85]), null, "still fail-closed after a second failure");
  } finally {
    territoryImporterForTests(null);
  }

  // Recovery: with the real importer restored, the very next preload
  // succeeds and lookups resolve for real.
  await preloadTerritory();
  assert.deepEqual(territoryAt([2.35, 48.85]), {
    key: "250",
    name: "France",
    continent: "europe",
  });
});
