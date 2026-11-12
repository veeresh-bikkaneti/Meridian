import assert from "node:assert/strict";
import test from "node:test";

// --- Minimal localStorage shim (node has none). ---
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => {
    backing.set(k, v);
  },
  removeItem: (k: string) => {
    backing.delete(k);
  },
  clear: () => backing.clear(),
};

import {
  PROFILE_STORAGE_KEY,
  loadProfile,
  setBand,
  saveBand,
  applyPendingAtBoundary,
  resetProfile,
  resolveBand,
  validateProfile,
  __resetMemoryFallback,
} from "./store.ts";
import { onAgeProfileChanged } from "./events.ts";
import * as ageProfile from "./index.ts";

const STORED_AT = "2020-01-02T03:04:05.000Z";

function v1Active(band: string, changeCount: number) {
  return {
    status: "active" as const,
    band,
    updatedAt: STORED_AT,
    changeCount,
    schemaVersion: 1,
  };
}

function clearStorage() {
  backing.clear();
  __resetMemoryFallback();
}

// --- validateProfile: corrupt blobs fail closed to unset ---

test("validateProfile accepts a well-formed v1 profile", () => {
  const p = validateProfile({
    status: "active",
    band: "8-10",
    updatedAt: new Date().toISOString(),
    changeCount: 2,
    schemaVersion: 1,
  });
  assert.ok(p !== null && p.band === "7-10" && p.status === "active" && p.schemaVersion === 2);
  assert.equal(p.changeCount, 2);
});

test("corrupt blobs are rejected (fail-closed)", () => {
  const bad = [
    null,
    42,
    "x",
    {},
    { status: "active", schemaVersion: 1 }, // missing fields
    { status: "active", band: "5-7", schemaVersion: 2, updatedAt: new Date().toISOString(), changeCount: 0 }, // legacy id is not a current group
    { status: "active", band: "4-6", updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // unknown band
    { status: "unset", band: "5-7", updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // unset must have band:null
    { status: "active", band: null, updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // active needs a band
    { status: "pending-change", band: null, updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // legacy staging without a band is corrupt
    { status: "bogus", band: "5-7", updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // unknown status
  ];
  for (const b of bad) assert.equal(validateProfile(b), null, JSON.stringify(b));
});

test("Item B migration: a legacy pending-change blob normalizes to active", () => {
  // Blobs written by the pre-Item-B store may still sit in storage.
  // The staged change simply applies — no timeout, no revert.
  const p = validateProfile({
    status: "pending-change",
    band: "11-13",
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    changeCount: 1,
    pendingBand: "5-7", // stray field is ignored
    schemaVersion: 1,
  });
  assert.ok(p !== null);
  assert.equal(p.status, "active");
  assert.equal(p.band, "10-18");
  assert.equal(p.changeCount, 1);
  assert.equal(p.schemaVersion, 2);
  assert.ok(!("pendingBand" in p));
});

// --- manifest §2: legacy ids map inside validateProfile, then persist as v2 ---

test("v1 active 5-7 loads as 7-10 and keeps changeCount and updatedAt", () => {
  clearStorage();
  backing.set(PROFILE_STORAGE_KEY, JSON.stringify(v1Active("5-7", 2)));
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const validated = validateProfile(v1Active("5-7", 2));
    assert.ok(validated !== null);
    assert.equal(validated.band, "7-10");
    assert.equal(validated.changeCount, 2);
    assert.equal(validated.updatedAt, STORED_AT);
    assert.equal(validated.schemaVersion, 2);

    const loaded = loadProfile();
    assert.equal(loaded.status, "active");
    assert.equal(loaded.band, "7-10");
    assert.equal(loaded.changeCount, 2);
    assert.equal(loaded.updatedAt, STORED_AT);
    assert.equal(events.length, 0);

    const stored = JSON.parse(backing.get(PROFILE_STORAGE_KEY)!) as {
      band: string;
      changeCount: number;
      updatedAt: string;
      schemaVersion: number;
    };
    assert.equal(stored.band, "7-10");
    assert.equal(stored.changeCount, 2);
    assert.equal(stored.updatedAt, STORED_AT);
    assert.equal(stored.schemaVersion, 2);
    assert.notEqual(stored.band, "18+");
    assert.equal(loadProfile().band, "7-10");
  } finally {
    off();
  }
});

test("v1 active 8-10 loads as 7-10 and getAgeGroup returns 7-10", () => {
  clearStorage();
  backing.set(PROFILE_STORAGE_KEY, JSON.stringify(v1Active("8-10", 4)));
  const loaded = loadProfile();
  assert.equal(loaded.status, "active");
  assert.equal(loaded.band, "7-10");
  assert.equal(loaded.changeCount, 4);
  assert.equal(loaded.updatedAt, STORED_AT);
  assert.equal(typeof ageProfile.getAgeGroup, "function");
  assert.equal(ageProfile.getAgeGroup.length, 0);
  assert.equal(ageProfile.getAgeGroup(), "7-10");
});

test("v1 active 11-13 loads as 10-18, not unset", () => {
  clearStorage();
  backing.set(PROFILE_STORAGE_KEY, JSON.stringify(v1Active("11-13", 1)));
  const loaded = loadProfile();
  assert.equal(loaded.status, "active");
  assert.notEqual(loaded.status, "unset");
  assert.equal(loaded.band, "10-18");
  assert.equal(loaded.changeCount, 1);
  assert.equal(loaded.updatedAt, STORED_AT);
  const stored = JSON.parse(backing.get(PROFILE_STORAGE_KEY)!) as { band: string };
  assert.equal(stored.band, "10-18");
  assert.notEqual(stored.band, "18+");
});

test("v1 unset stays unset; getAgeGroup returns 10-18 and nothing writes 18+", () => {
  clearStorage();
  backing.set(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      status: "unset",
      band: null,
      updatedAt: STORED_AT,
      changeCount: 3,
      schemaVersion: 1,
    }),
  );
  const loaded = loadProfile();
  assert.equal(loaded.status, "unset");
  assert.equal(loaded.band, null);
  assert.equal(loaded.changeCount, 3);
  assert.equal(loaded.updatedAt, STORED_AT);
  assert.equal(ageProfile.FULL_ACCESS_BAND, "10-18");
  assert.equal(ageProfile.getAgeGroup(), "10-18");
  const stored = JSON.parse(backing.get(PROFILE_STORAGE_KEY)!) as {
    band: string | null;
    schemaVersion: number;
    changeCount: number;
  };
  assert.equal(stored.band, null);
  assert.equal(stored.schemaVersion, 2);
  assert.equal(stored.changeCount, 3);
  assert.notEqual(stored.band, "18+");
});

test("getAgeGroup is exported with no argument and returns AgeGroup", () => {
  clearStorage();
  assert.equal(typeof ageProfile.getAgeGroup, "function");
  assert.equal(ageProfile.getAgeGroup.length, 0);
  const group: ageProfile.AgeGroup = ageProfile.getAgeGroup();
  assert.equal(group, "10-18");
});

test("migration of every legacy id never stores 18+", () => {
  for (const band of ["5-7", "8-10", "11-13"]) {
    clearStorage();
    backing.set(PROFILE_STORAGE_KEY, JSON.stringify(v1Active(band, 0)));
    loadProfile();
    const stored = JSON.parse(backing.get(PROFILE_STORAGE_KEY)!) as { band: string };
    assert.notEqual(stored.band, "18+", band);
  }
});

test("v2 legacy band and schemaVersion 3 are rejected; v1 18+ is not migrated", () => {
  assert.equal(
    validateProfile({
      status: "active",
      band: "5-7",
      updatedAt: STORED_AT,
      changeCount: 0,
      schemaVersion: 2,
    }),
    null,
  );
  assert.equal(
    validateProfile({
      status: "active",
      band: "7-10",
      updatedAt: STORED_AT,
      changeCount: 0,
      schemaVersion: 3,
    }),
    null,
  );
  assert.equal(
    validateProfile({
      status: "active",
      band: "18+",
      updatedAt: STORED_AT,
      changeCount: 0,
      schemaVersion: 1,
    }),
    null,
  );
});

test("owner labels, owner copy, 7-10 loops, and the 11-13 difficulty row", () => {
  assert.equal(ageProfile.FULL_ACCESS_BAND, "10-18");
  const young = ageProfile.AGE_BANDS["7-10"];
  const mid = ageProfile.AGE_BANDS["10-18"];
  const adult = ageProfile.AGE_BANDS["18+"];
  assert.ok(young && mid && adult);
  assert.equal(young.label, "Ages 7-10");
  assert.equal(mid.label, "Ages 10-18");
  assert.equal(adult.label, "Ages 18+");
  assert.equal(young.description, "Stories to read or hear, mysteries to solve, capitals to find.");
  assert.equal(mid.description, "The full game: every story, every mystery, head-to-head duels.");
  assert.equal(adult.description, "The full game with no hints.");
  assert.equal(young.whatChanges, "📖 Read or listen · mysteries · free hints");
  assert.equal(mid.whatChanges, "🗺️ The whole game · one hint per round");
  assert.equal(adult.whatChanges, "🗺️ The whole game · no hints");
  assert.ok(young.description.length <= 140);
  assert.ok(mid.description.length <= 140);
  assert.ok(adult.description.length <= 140);
  assert.equal(adult.ageMax, null);
  assert.equal(young.ageMin, 7);
  assert.equal(young.ageMax, 10);
  assert.equal(mid.ageMin, 10);
  assert.equal(mid.ageMax, 18);
  assert.equal(adult.ageMin, 18);
  assert.equal(young.rungCeiling, "wikitext");
  assert.deepEqual(young.loops, [
    "terrain-detective",
    "quiz",
    "passport-stamps",
    "geodetective",
    "capital-quest",
    "expedition-trails",
  ]);
  assert.equal(young.loops.includes("duel"), false);
  assert.deepEqual(young.difficulty, {
    toleranceMultiplier: 1.25,
    startingClues: 3,
    guessCap: 6,
    quizQuestions: 8,
    terrainImages: 6,
    capitalQuestions: 8,
    pinsPerRun: 8,
    duelSecondsPerTurn: null,
  });
  assert.deepEqual(mid.difficulty, {
    toleranceMultiplier: 1.0,
    startingClues: 1,
    guessCap: 5,
    quizQuestions: 12,
    terrainImages: 8,
    capitalQuestions: 12,
    pinsPerRun: 12,
    duelSecondsPerTurn: 60,
  });
  assert.deepEqual(adult.difficulty, mid.difficulty);
  assert.equal(ageProfile.getBandConfig("7-10").hintPolicy, "free");
  assert.equal(ageProfile.getBandConfig("10-18").hintPolicy, "one-per-round");
  assert.equal(ageProfile.getBandConfig("18+").hintPolicy, "none");
  assert.equal(ageProfile.getBandConfig(null).hintPolicy, ageProfile.DEFAULT_HINT_POLICY);
  for (const legacy of ["5-7", "8-10", "11-13"]) {
    assert.equal(
      ageProfile.isBandRunConfig({ ...ageProfile.getBandConfig(null), band: legacy }),
      true,
      legacy,
    );
  }
});

// --- lifecycle transitions (2-state machine) ---

test("empty storage → unset; resolveBand → full-access default", () => {
  clearStorage();
  const p = loadProfile();
  assert.equal(p.status, "unset");
  assert.equal(p.band, null);
  assert.equal(resolveBand(), "10-18");
  // Nothing deferred on a fresh store: the boundary hook fires no event.
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    applyPendingAtBoundary();
    assert.equal(events.length, 0);
  } finally {
    off();
  }
});

test("corrupt JSON in storage → unset (never strands a child locked-down)", () => {
  clearStorage();
  backing.set(PROFILE_STORAGE_KEY, "{not json");
  assert.equal(loadProfile().status, "unset");
  backing.set(PROFILE_STORAGE_KEY, JSON.stringify({ status: "active", band: "5-7" }));
  assert.equal(loadProfile().status, "unset");
});

test("setBand: unset → active, emits a set event", () => {
  clearStorage();
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = setBand("7-10");
    assert.equal(p.status, "active");
    assert.equal(p.band, "7-10");
    assert.equal(p.changeCount, 0);
    assert.equal(resolveBand(), "7-10");
    assert.equal(events.length, 1);
    assert.deepEqual((events[0] as { kind: string }).kind, "set");
    // Persisted across loads.
    assert.equal(loadProfile().band, "7-10");
  } finally {
    off();
  }
});

test("saveBand with no run in progress: writes immediately + fires immediately", () => {
  clearStorage();
  setBand("10-18");
  const events: { kind: string; midSession: boolean; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) =>
    events.push({ kind: e.kind, midSession: e.midSession, band: e.band, previousBand: e.previousBand }),
  );
  try {
    const p = saveBand("7-10", { runInProgress: false });
    assert.equal(p.status, "active");
    assert.equal(p.band, "7-10");
    assert.equal(p.changeCount, 1);
    assert.equal(resolveBand(), "7-10");
    // Nothing deferred: the change event fired immediately above, and the
    // boundary hook below stays silent.
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      kind: "change",
      midSession: false,
      band: "7-10",
      previousBand: "10-18",
    });
    // The boundary hook is a no-op: nothing was deferred.
    const before = events.length;
    applyPendingAtBoundary();
    assert.equal(events.length, before);
  } finally {
    off();
  }
});

test("saveBand to the same band is a no-op (no event)", () => {
  clearStorage();
  setBand("10-18");
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = saveBand("10-18", { runInProgress: true });
    assert.equal(p.status, "active");
    assert.equal(p.band, "10-18");
    assert.equal(p.changeCount, 0);
    assert.equal(events.length, 0);
    // Nothing deferred by the no-op save: the boundary hook stays silent.
    applyPendingAtBoundary();
    assert.equal(events.length, 0);
  } finally {
    off();
  }
});

test("saveBand mid-run: writes immediately, event defers to the boundary", () => {
  clearStorage();
  setBand("10-18");
  const events: { kind: string; midSession: boolean; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) =>
    events.push({ kind: e.kind, midSession: e.midSession, band: e.band, previousBand: e.previousBand }),
  );
  try {
    // Save writes immediately — even mid-run. The live run is protected by
    // its own config snapshot (see run-config.ts), not by staging.
    const saved = saveBand("7-10", { runInProgress: true });
    assert.equal(saved.status, "active");
    assert.equal(saved.band, "7-10");
    assert.equal(saved.changeCount, 1);
    assert.equal(loadProfile().band, "7-10");
    // Deferred, not dropped: the save is held back — no subscriber
    // re-renders until the boundary event fires.
    assert.equal(events.length, 0);

    const boundaryProfile = applyPendingAtBoundary();
    assert.equal(boundaryProfile.band, "7-10");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      kind: "change",
      midSession: true,
      band: "7-10",
      previousBand: "10-18",
    });

    // A second boundary call is a no-op.
    applyPendingAtBoundary();
    assert.equal(events.length, 1);
  } finally {
    off();
  }
});

test("latest mid-run save wins; one boundary event", () => {
  clearStorage();
  setBand("10-18");
  const events: { band: unknown }[] = [];
  const off = onAgeProfileChanged((e) => events.push({ band: e.band }));
  try {
    saveBand("7-10", { runInProgress: true });
    saveBand("18+", { runInProgress: true });
    assert.equal(loadProfile().band, "18+");
    applyPendingAtBoundary();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.band, "18+");
  } finally {
    off();
  }
});

test("resetProfile → unset, clears deferred state, emits reset", () => {
  clearStorage();
  setBand("7-10");
  saveBand("18+", { runInProgress: true });
  // …its change event is deferred to the boundary (observed below: the
  // reset clears the deferred event, so the boundary hook stays silent).
  const events: { kind: string; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) => events.push({ kind: e.kind, band: e.band, previousBand: e.previousBand }));
  try {
    const p = resetProfile();
    assert.equal(p.status, "unset");
    assert.equal(p.band, null);
    assert.equal(resolveBand(), "10-18");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { kind: "reset", band: null, previousBand: "18+" });
    // Nothing deferred survives the reset.
    applyPendingAtBoundary();
    assert.equal(events.length, 1);
  } finally {
    off();
  }
});

test("applyPendingAtBoundary is a no-op without a deferred save", () => {
  clearStorage();
  setBand("7-10");
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = applyPendingAtBoundary();
    assert.equal(p.band, "7-10");
    assert.equal(p.changeCount, 0);
    // No deferred save → no boundary event fires.
    assert.equal(events.length, 0);
  } finally {
    off();
  }
});
