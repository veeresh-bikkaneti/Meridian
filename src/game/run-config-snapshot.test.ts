import assert from "node:assert/strict";
import test from "node:test";
import { resumeRun, startRun, type Run } from "./run.ts";
import { getBandConfig } from "./age-profile/run-config.ts";
import { PROFILE_STORAGE_KEY, resolveBand } from "./age-profile/store.ts";

/**
 * Follow-up Item A: the quiz (main endless) run snapshots its band config
 * ONCE at run start. A mid-run band flip structurally cannot warp the
 * live run — resume keeps the deal-time snapshot.
 */

// Minimal localStorage shim so resolveBand() sees a seeded profile.
// store.ts checks `typeof localStorage` at call time, so installing the
// shim here (after imports) is safe.
const storageBacking = new Map<string, string>();
const hadLocalStorage = "localStorage" in globalThis;
const savedLocalStorage = (globalThis as Record<string, unknown>).localStorage;

function seedProfileBand(band: "5-7" | "8-10" | "11-13" | null): void {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (storageBacking.has(k) ? storageBacking.get(k)! : null),
    setItem: (k: string, v: string) => {
      storageBacking.set(k, v);
    },
    removeItem: (k: string) => {
      storageBacking.delete(k);
    },
    clear: () => storageBacking.clear(),
  };
  storageBacking.clear();
  if (band !== null) {
    storageBacking.set(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        status: "active",
        band,
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 1,
      }),
    );
  }
}

function restoreLocalStorage(): void {
  if (hadLocalStorage) {
    (globalThis as Record<string, unknown>).localStorage = savedLocalStorage;
  } else {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
}

const today = {
  edition: "state" as const,
  regionId: "nebraska",
  regionName: "Nebraska",
  dateKey: "2026-09-28",
  difficultyChoice: "medium" as const,
};

test("startRun snapshots the band config once; hints start unused", () => {
  try {
    seedProfileBand("5-7");
    assert.equal(resolveBand(), "5-7");
    const run = startRun(today, ["p1", "p2", "p3"]);
    assert.deepEqual(run.bandConfig!, getBandConfig("5-7"));
    assert.equal(run.bandConfig!.quizQs, 5);
    assert.equal(run.bandConfig!.hintPolicy, "free");
    assert.equal(run.hintsUsed!, 0);
  } finally {
    restoreLocalStorage();
  }
});

test("a resumed run keeps its deal-time snapshot — a mid-run band flip cannot warp it", () => {
  try {
    seedProfileBand("5-7");
    const run = startRun(today, ["p1", "p2", "p3"]);
    assert.equal(run.bandConfig!.quizQs, 5);
    // The parent flips the band mid-run: the save writes immediately...
    seedProfileBand("11-13");
    assert.equal(resolveBand(), "11-13");
    // ...but the resumed run keeps its 5-7 snapshot.
    const resumed = resumeRun({ ...run }, today, ["p1", "p2", "p3"]);
    assert.equal(resumed.bandConfig!.quizQs, 5);
    assert.deepEqual(resumed.bandConfig!, getBandConfig("5-7"));
    assert.equal(resumed.hintsUsed!, 0);
  } finally {
    restoreLocalStorage();
  }
});

test("a run saved before the snapshot backfills config from the live band", () => {
  try {
    seedProfileBand(null); // unset → full-access default
    const legacy = startRun(today, ["p1"]);
    const { bandConfig: _dropped, hintsUsed: _dropped2, ...withoutSnapshot } = legacy;
    void _dropped;
    void _dropped2;
    const resumed = resumeRun(withoutSnapshot as unknown as Run, today, ["p1"]);
    assert.deepEqual(resumed.bandConfig!, getBandConfig(null));
    assert.equal(resumed.bandConfig!.quizQs, 12); // today's production numbers
    assert.equal(resumed.hintsUsed!, 0);
  } finally {
    restoreLocalStorage();
  }
});
