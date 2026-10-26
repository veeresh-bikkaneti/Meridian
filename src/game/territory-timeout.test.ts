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
