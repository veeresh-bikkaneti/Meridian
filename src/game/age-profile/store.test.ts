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
  assert.ok(p !== null && p.band === "8-10" && p.status === "active");
});

test("corrupt blobs are rejected (fail-closed)", () => {
  const bad = [
    null,
    42,
    "x",
    {},
    { status: "active", schemaVersion: 1 }, // missing fields
    { status: "active", band: "5-7", schemaVersion: 2, updatedAt: new Date().toISOString(), changeCount: 0 }, // wrong version
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
  assert.equal(p.band, "11-13");
  assert.equal(p.changeCount, 1);
  assert.ok(!("pendingBand" in p));
});

// --- lifecycle transitions (2-state machine) ---

test("empty storage → unset; resolveBand → full-access default", () => {
  clearStorage();
  const p = loadProfile();
  assert.equal(p.status, "unset");
  assert.equal(p.band, null);
  assert.equal(resolveBand(), "11-13");
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
    const p = setBand("5-7");
    assert.equal(p.status, "active");
    assert.equal(p.band, "5-7");
    assert.equal(p.changeCount, 0);
    assert.equal(resolveBand(), "5-7");
    assert.equal(events.length, 1);
    assert.deepEqual((events[0] as { kind: string }).kind, "set");
    // Persisted across loads.
    assert.equal(loadProfile().band, "5-7");
  } finally {
    off();
  }
});

test("saveBand with no run in progress: writes immediately + fires immediately", () => {
  clearStorage();
  setBand("8-10");
  const events: { kind: string; midSession: boolean; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) =>
    events.push({ kind: e.kind, midSession: e.midSession, band: e.band, previousBand: e.previousBand }),
  );
  try {
    const p = saveBand("5-7", { runInProgress: false });
    assert.equal(p.status, "active");
    assert.equal(p.band, "5-7");
    assert.equal(p.changeCount, 1);
    assert.equal(resolveBand(), "5-7");
    // Nothing deferred: the change event fired immediately above, and the
    // boundary hook below stays silent.
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      kind: "change",
      midSession: false,
      band: "5-7",
      previousBand: "8-10",
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
  setBand("8-10");
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = saveBand("8-10", { runInProgress: true });
    assert.equal(p.status, "active");
    assert.equal(p.band, "8-10");
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
  setBand("11-13");
  const events: { kind: string; midSession: boolean; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) =>
    events.push({ kind: e.kind, midSession: e.midSession, band: e.band, previousBand: e.previousBand }),
  );
  try {
    // Save writes immediately — even mid-run. The live run is protected by
    // its own config snapshot (see run-config.ts), not by staging.
    const saved = saveBand("5-7", { runInProgress: true });
    assert.equal(saved.status, "active");
    assert.equal(saved.band, "5-7");
    assert.equal(saved.changeCount, 1);
    assert.equal(loadProfile().band, "5-7");
    // Deferred, not dropped: the save is held back — no subscriber
    // re-renders until the boundary event fires.
    assert.equal(events.length, 0);

    const boundaryProfile = applyPendingAtBoundary();
    assert.equal(boundaryProfile.band, "5-7");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      kind: "change",
      midSession: true,
      band: "5-7",
      previousBand: "11-13",
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
  setBand("11-13");
  const events: { band: unknown }[] = [];
  const off = onAgeProfileChanged((e) => events.push({ band: e.band }));
  try {
    saveBand("5-7", { runInProgress: true });
    saveBand("8-10", { runInProgress: true });
    assert.equal(loadProfile().band, "8-10");
    applyPendingAtBoundary();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.band, "8-10");
  } finally {
    off();
  }
});

test("resetProfile → unset, clears deferred state, emits reset", () => {
  clearStorage();
  setBand("5-7");
  saveBand("8-10", { runInProgress: true });
  // …its change event is deferred to the boundary (observed below: the
  // reset clears the deferred event, so the boundary hook stays silent).
  const events: { kind: string; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) => events.push({ kind: e.kind, band: e.band, previousBand: e.previousBand }));
  try {
    const p = resetProfile();
    assert.equal(p.status, "unset");
    assert.equal(p.band, null);
    assert.equal(resolveBand(), "11-13");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { kind: "reset", band: null, previousBand: "8-10" });
    // Nothing deferred survives the reset.
    applyPendingAtBoundary();
    assert.equal(events.length, 1);
  } finally {
    off();
  }
});

test("applyPendingAtBoundary is a no-op without a deferred save", () => {
  clearStorage();
  setBand("8-10");
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = applyPendingAtBoundary();
    assert.equal(p.band, "8-10");
    assert.equal(p.changeCount, 0);
    // No deferred save → no boundary event fires.
    assert.equal(events.length, 0);
  } finally {
    off();
  }
});
