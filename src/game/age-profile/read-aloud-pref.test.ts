import assert from "node:assert/strict";
import test from "node:test";

// --- Minimal localStorage shim (node has none), mirroring store.test.ts. ---
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
  READ_ALOUD_PREF_KEY,
  getReadAloudPref,
  setReadAloudPref,
  shouldAskReadAloudPref,
  shouldAutoPlayReadAloud,
  __resetReadAloudPrefMemory,
} from "./read-aloud-pref.ts";

function clearStorage() {
  backing.clear();
  __resetReadAloudPrefMemory();
}

// --- Absent → unset → ask once ---

test("absent preference is unset and triggers the one-time ask", () => {
  clearStorage();
  assert.equal(getReadAloudPref(), "unset");
  assert.equal(shouldAskReadAloudPref(), true);
});

// --- Asked once, never nags ---

test("an answered preference persists and never re-asks", () => {
  clearStorage();
  setReadAloudPref("sometimes");
  assert.equal(getReadAloudPref(), "sometimes");
  assert.equal(shouldAskReadAloudPref(), false);
});

test("each answer persists under the documented key with schemaVersion 1", () => {
  clearStorage();
  setReadAloudPref("always");
  const raw = backing.get(READ_ALOUD_PREF_KEY);
  assert.ok(raw, "record written to meridian.readAloudPref.v1");
  const parsed = JSON.parse(raw!) as Record<string, unknown>;
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.value, "always");
  assert.ok(typeof parsed.updatedAt === "string");
});

test("overwriting still never re-asks (answered stays answered)", () => {
  clearStorage();
  setReadAloudPref("never");
  setReadAloudPref("always");
  assert.equal(getReadAloudPref(), "always");
  assert.equal(shouldAskReadAloudPref(), false);
});

// --- Migration story: corrupt / wrong-version / legacy → unset ---

test("corrupt blobs fail closed to unset (ask once)", () => {
  clearStorage();
  backing.set(READ_ALOUD_PREF_KEY, "not-json{{{");
  assert.equal(getReadAloudPref(), "unset");
  assert.equal(shouldAskReadAloudPref(), true);
});

test("wrong schemaVersion fails closed to unset", () => {
  clearStorage();
  backing.set(
    READ_ALOUD_PREF_KEY,
    JSON.stringify({ schemaVersion: 999, value: "always", updatedAt: "" }),
  );
  assert.equal(getReadAloudPref(), "unset");
});

test("unknown value fails closed to unset", () => {
  clearStorage();
  backing.set(
    READ_ALOUD_PREF_KEY,
    JSON.stringify({ schemaVersion: 1, value: "maybe", updatedAt: "" }),
  );
  assert.equal(getReadAloudPref(), "unset");
});

test("legacy bare-string value is migrated into the v1 record", () => {
  clearStorage();
  backing.set(READ_ALOUD_PREF_KEY, '"never"');
  assert.equal(getReadAloudPref(), "never");
  assert.equal(shouldAskReadAloudPref(), false);
  const parsed = JSON.parse(backing.get(READ_ALOUD_PREF_KEY)!) as Record<string, unknown>;
  assert.equal(parsed.schemaVersion, 1);
});

// --- "Sometimes" semantics ---

test("sometimes: never auto-read (tap-to-play only)", () => {
  assert.equal(shouldAutoPlayReadAloud("sometimes", true, true), false);
  assert.equal(shouldAutoPlayReadAloud("sometimes", true, false), false);
  assert.equal(shouldAutoPlayReadAloud("sometimes", false, true), false);
});

test("never: never auto-read (button stays visible)", () => {
  assert.equal(shouldAutoPlayReadAloud("never", true, true), false);
  assert.equal(shouldAutoPlayReadAloud("never", false, true), false);
});

test("always: auto-read on EVERY card in EVERY band when sound is on (owner 2026-10-09)", () => {
  assert.equal(shouldAutoPlayReadAloud("always", true, true), true);
  assert.equal(shouldAutoPlayReadAloud("always", true, false), false);
  // The broken promise this fixes: 8-10/11-13 cards (bandAutoplay=false)
  // must still auto-read when the kid chose "Always" and sound is on.
  assert.equal(shouldAutoPlayReadAloud("always", false, true), true);
  assert.equal(shouldAutoPlayReadAloud("always", false, false), false);
});

test("unset: today's band default is preserved (5-7 auto, others not)", () => {
  assert.equal(shouldAutoPlayReadAloud("unset", true, true), true);
  assert.equal(shouldAutoPlayReadAloud("unset", false, true), false);
});
