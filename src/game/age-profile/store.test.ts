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
  PENDING_TIMEOUT_MS,
  loadProfile,
  setBand,
  requestChange,
  applyPendingAtBoundary,
  cancelPending,
  resetProfile,
  resolveBand,
  hasPendingChange,
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
    pendingBand: null,
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
    { status: "active", band: "5-7", schemaVersion: 2, updatedAt: new Date().toISOString(), changeCount: 0, pendingBand: null }, // wrong version
    { status: "active", band: "4-6", updatedAt: new Date().toISOString(), changeCount: 0, pendingBand: null, schemaVersion: 1 }, // unknown band
    { status: "unset", band: "5-7", updatedAt: new Date().toISOString(), changeCount: 0, pendingBand: null, schemaVersion: 1 }, // unset must have band:null
    { status: "active", band: null, updatedAt: new Date().toISOString(), changeCount: 0, pendingBand: null, schemaVersion: 1 }, // active needs a band
    { status: "pending-change", band: "5-7", pendingBand: null, updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // pending needs pendingBand
    { status: "pending-change", band: "5-7", pendingBand: "5-7", updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 1 }, // pendingBand != band
  ];
  for (const b of bad) assert.equal(validateProfile(b), null, JSON.stringify(b));
});

// --- lifecycle transitions ---

test("empty storage → unset; resolveBand → full-access default", () => {
  clearStorage();
  const p = loadProfile();
  assert.equal(p.status, "unset");
  assert.equal(p.band, null);
  assert.equal(resolveBand(), "11-13");
  assert.equal(hasPendingChange(), false);
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

test("requestChange to the same band is a no-op (no event)", () => {
  clearStorage();
  setBand("8-10");
  const events: unknown[] = [];
  const off = onAgeProfileChanged((e) => events.push(e));
  try {
    const p = requestChange("8-10", { runInProgress: true });
    assert.equal(p.status, "active");
    assert.equal(p.pendingBand, null);
    assert.equal(events.length, 0);
  } finally {
    off();
  }
});

test("requestChange with no run in progress applies immediately", () => {
  clearStorage();
  setBand("8-10");
  const p = requestChange("5-7", { runInProgress: false });
  assert.equal(p.status, "active");
  assert.equal(p.band, "5-7");
  assert.equal(p.changeCount, 1);
  assert.equal(resolveBand(), "5-7");
});

test("requestChange mid-run stages pending-change; boundary applies it", () => {
  clearStorage();
  setBand("11-13");
  const events: { kind: string; midSession: boolean; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) =>
    events.push({ kind: e.kind, midSession: e.midSession, band: e.band, previousBand: e.previousBand }),
  );
  try {
    const staged = requestChange("5-7", { runInProgress: true });
    assert.equal(staged.status, "pending-change");
    assert.equal(staged.band, "11-13"); // current band stays effective
    assert.equal(staged.pendingBand, "5-7");
    assert.equal(hasPendingChange(), true);
    assert.equal(resolveBand(), "11-13"); // staged band NOT effective yet
    assert.equal(events.length, 0); // no event until the boundary

    const applied = applyPendingAtBoundary();
    assert.equal(applied.status, "active");
    assert.equal(applied.band, "5-7");
    assert.equal(applied.changeCount, 1);
    assert.equal(hasPendingChange(), false);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      kind: "change",
      midSession: true,
      band: "5-7",
      previousBand: "11-13",
    });
  } finally {
    off();
  }
});

test("cancelPending drops the staged change", () => {
  clearStorage();
  setBand("11-13");
  requestChange("5-7", { runInProgress: true });
  const p = cancelPending();
  assert.equal(p.status, "active");
  assert.equal(p.band, "11-13");
  assert.equal(p.pendingBand, null);
  assert.equal(p.changeCount, 0);
});

test("pending-change times out after 10 minutes → reverts to active", () => {
  clearStorage();
  assert.equal(PENDING_TIMEOUT_MS, 10 * 60 * 1000);
  const stale = {
    status: "pending-change",
    band: "11-13",
    updatedAt: new Date(Date.now() - PENDING_TIMEOUT_MS - 1000).toISOString(),
    changeCount: 0,
    pendingBand: "5-7",
    schemaVersion: 1,
  };
  backing.set(PROFILE_STORAGE_KEY, JSON.stringify(stale));
  const p = loadProfile();
  assert.equal(p.status, "active");
  assert.equal(p.band, "11-13");
  assert.equal(p.pendingBand, null);
});

test("resetProfile → unset, emits reset, game progress untouched (profile only)", () => {
  clearStorage();
  setBand("5-7");
  const events: { kind: string; band: unknown; previousBand: unknown }[] = [];
  const off = onAgeProfileChanged((e) => events.push({ kind: e.kind, band: e.band, previousBand: e.previousBand }));
  try {
    const p = resetProfile();
    assert.equal(p.status, "unset");
    assert.equal(p.band, null);
    assert.equal(resolveBand(), "11-13");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { kind: "reset", band: null, previousBand: "5-7" });
  } finally {
    off();
  }
});

test("applyPendingAtBoundary is a no-op without a staged change", () => {
  clearStorage();
  setBand("8-10");
  const p = applyPendingAtBoundary();
  assert.equal(p.band, "8-10");
  assert.equal(p.changeCount, 0);
});

test("latest staged selection wins (pending → pending)", () => {
  clearStorage();
  setBand("11-13");
  requestChange("5-7", { runInProgress: true });
  const p = requestChange("8-10", { runInProgress: true });
  assert.equal(p.status, "pending-change");
  assert.equal(p.pendingBand, "8-10");
  const applied = applyPendingAtBoundary();
  assert.equal(applied.band, "8-10");
});
