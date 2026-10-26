/**
 * territory.ts HUNG-load path (#209) — executed, not source-pinned.
 *
 * territory-failure.test.ts covers a load that fails fast. This file
 * covers the twin case from the issue: an import that NEVER settles.
 * `preloadTerritory` must still resolve at its timeout bound (its
 * awaiters — openRun, the boot restore — sit behind loading
 * fallbacks), readers must stay fail-closed, and the timed-out
 * attempt must be evicted so the next preload retries for real.
 * Runs in its own process so the module state starts fresh.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  preloadTerritory,
  territoryAt,
  territoryConversionRunsForTests,
  territoryImporterForTests,
  territoryLoadRunsForTests,
} from "./territory.ts";

test("a hung atlas import resolves preloadTerritory at the bound, fails closed, and retries next time", async () => {
  let attempts = 0;
  territoryImporterForTests(() => {
    attempts += 1;
    // Never settles: the hung-import case.
    return new Promise<{ default: unknown }>(() => {});
  });
  try {
    const started = Date.now();
    await assert.doesNotReject(() => preloadTerritory(25));
    assert.ok(
      Date.now() - started < 2_000,
      "preloadTerritory resolved at the timeout bound, not whenever the import felt like it",
    );
    assert.equal(attempts, 1);
    assert.equal(territoryAt([2.35, 48.85]), null, "Paris fails closed while unloaded");

    // Eviction: the timed-out corpse must not be reused — the next
    // preload starts a fresh import (which also hangs here, and also
    // resolves at its bound).
    await assert.doesNotReject(() => preloadTerritory(25));
    assert.equal(attempts, 2, "the retry re-imports (timed-out load was evicted)");
    assert.equal(territoryLoadRunsForTests(), 2);
  } finally {
    territoryImporterForTests(null);
  }

  // Recovery: with the real importer restored, the next preload
  // succeeds and lookups resolve for real.
  await preloadTerritory();
  assert.deepEqual(territoryAt([2.35, 48.85]), {
    key: "250",
    name: "France",
    continent: "europe",
  });
});

test("an import that lands AFTER its timeout is discarded, not cached (#209 zombie guard)", async () => {
  const realAtlas = await import("world-atlas/countries-50m.json", {
    with: { type: "json" },
  });
  let calls = 0;
  territoryImporterForTests(() => {
    calls += 1;
    if (calls === 1) {
      // Slow, not hung: lands at ~150 ms, long past the 25 ms bound.
      return new Promise<{ default: unknown }>((resolve) => {
        setTimeout(() => resolve(realAtlas as { default: unknown }), 150);
      });
    }
    return Promise.resolve(realAtlas as { default: unknown });
  });
  // conversionRuns is cumulative across this file's tests — assert
  // relative to wherever it stands now.
  const conversionsBefore = territoryConversionRunsForTests();
  try {
    await assert.doesNotReject(() => preloadTerritory(25));
    assert.equal(territoryAt([2.35, 48.85]), null, "timed out: still unloaded");

    // The retry imports again and lands inside its bound.
    await preloadTerritory(5_000);
    assert.equal(territoryAt([2.35, 48.85])?.name, "France");
    assert.equal(
      territoryConversionRunsForTests(),
      conversionsBefore + 1,
      "only the retry converted into the cache",
    );

    // Let the zombie land. It must change nothing: no second
    // conversion counted, no cache overwrite.
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(
      territoryConversionRunsForTests(),
      conversionsBefore + 1,
      "the late landing was discarded",
    );
    assert.equal(territoryAt([2.35, 48.85])?.name, "France");
  } finally {
    territoryImporterForTests(null);
  }
});
