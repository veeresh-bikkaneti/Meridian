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

import { GROWNUP_COOLDOWN_KEY, readCooldown, writeCooldown, clearCooldown } from "./cooldown.ts";

const NOW = Date.now();

function clear() {
  backing.clear();
}

// --- write → read round-trip (unmount/remount) ---

test("absent cooldown reads as null", () => {
  clear();
  assert.equal(readCooldown(NOW), null);
});

test("writeCooldown persists; readCooldown returns the future deadline (still cooling after remount)", () => {
  clear();
  const until = NOW + 45_000;
  writeCooldown(until);
  assert.equal(readCooldown(NOW), until); // "remount" reads the live deadline
  assert.equal(readCooldown(until - 1_000), until); // still in the future
});

test("expired timestamp returns null and the key is deleted (never resurrects)", () => {
  clear();
  writeCooldown(NOW - 1_000);
  assert.equal(readCooldown(NOW), null);
  assert.equal(backing.has(GROWNUP_COOLDOWN_KEY), false);
});

test("boundary: deadline equal to now counts as expired and is cleared", () => {
  clear();
  writeCooldown(NOW);
  assert.equal(readCooldown(NOW), null);
  assert.equal(backing.has(GROWNUP_COOLDOWN_KEY), false);
});

test("malformed value returns null and the key is deleted", () => {
  clear();
  backing.set(GROWNUP_COOLDOWN_KEY, "not-a-timestamp");
  assert.equal(readCooldown(NOW), null);
  assert.equal(backing.has(GROWNUP_COOLDOWN_KEY), false);
});

test("clearCooldown deletes the key (cooldown over — expiry leaves no key behind)", () => {
  clear();
  writeCooldown(NOW + 60_000);
  assert.equal(backing.has(GROWNUP_COOLDOWN_KEY), true);
  clearCooldown();
  assert.equal(backing.has(GROWNUP_COOLDOWN_KEY), false);
  assert.equal(readCooldown(NOW), null);
});

// --- Strikes persist across gate remounts (P2-10) ---

import { readStrikes, writeStrikes, clearStrikes, GROWNUP_STRIKES_KEY, STRIKE_WINDOW_MS } from "./cooldown.ts";

test("strikes survive a close/reopen of the gate", () => {
  clear();
  assert.equal(readStrikes(NOW), 0);
  writeStrikes(2, NOW);
  assert.equal(readStrikes(NOW + 5_000), 2, "reopening the gate keeps the two earlier strikes");
});

test("strikes expire after the window and the key is deleted", () => {
  clear();
  writeStrikes(2, NOW);
  assert.equal(readStrikes(NOW + STRIKE_WINDOW_MS + 1), 0);
  assert.equal(backing.has(GROWNUP_STRIKES_KEY), false);
});

test("malformed strike records read as 0; clearStrikes removes the key", () => {
  clear();
  backing.set(GROWNUP_STRIKES_KEY, "not json");
  assert.equal(readStrikes(NOW), 0);
  writeStrikes(1, NOW);
  clearStrikes();
  assert.equal(backing.has(GROWNUP_STRIKES_KEY), false);
});
