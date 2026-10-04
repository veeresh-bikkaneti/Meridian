import assert from "node:assert/strict";
import test from "node:test";
import { STATES } from "./regions.ts";
import { STATE_NAMES, STATE_NEIGHBORS } from "./state-neighbors.ts";

const stateIds = new Set(STATES.map((s) => s.id));

test("every neighbor key is a real playable state regionId", () => {
  for (const key of Object.keys(STATE_NEIGHBORS)) {
    assert.ok(stateIds.has(key), `neighbor key "${key}" is not a state regionId`);
  }
});

test("every neighbor value is a real playable state regionId", () => {
  for (const [key, neighbors] of Object.entries(STATE_NEIGHBORS)) {
    for (const neighbor of neighbors) {
      assert.ok(
        stateIds.has(neighbor),
        `"${key}" suggests "${neighbor}", which is not a state regionId`,
      );
    }
  }
});

test("no state lists more than two neighbors", () => {
  for (const [key, neighbors] of Object.entries(STATE_NEIGHBORS)) {
    assert.ok(
      neighbors.length <= 2,
      `"${key}" lists ${neighbors.length} neighbors (max 2)`,
    );
  }
});

test("no state neighbors itself", () => {
  for (const [key, neighbors] of Object.entries(STATE_NEIGHBORS)) {
    assert.ok(!neighbors.includes(key), `"${key}" lists itself as a neighbor`);
  }
});

test("neighbor pairs are symmetric", () => {
  for (const [key, neighbors] of Object.entries(STATE_NEIGHBORS)) {
    for (const neighbor of neighbors) {
      const back = STATE_NEIGHBORS[neighbor] ?? [];
      assert.ok(
        back.includes(key),
        `"${key}" -> "${neighbor}" is not reciprocated`,
      );
    }
  }
});

test("all 50 states have an entry (no missing-key surprises at runtime)", () => {
  assert.equal(Object.keys(STATE_NEIGHBORS).length, STATES.length);
  for (const state of STATES) {
    assert.ok(
      state.id in STATE_NEIGHBORS,
      `missing neighbor entry for "${state.id}"`,
    );
  }
});

test("landlocked-neighbor-less states fall back cleanly (empty list, not missing)", () => {
  assert.deepEqual(STATE_NEIGHBORS["alaska"], []);
  assert.deepEqual(STATE_NEIGHBORS["hawaii"], []);
});

test("STATE_NAMES covers every state regionId with its menu name", () => {
  for (const state of STATES) {
    assert.equal(
      STATE_NAMES[state.id],
      state.name,
      `STATE_NAMES["${state.id}"] should be "${state.name}"`,
    );
  }
});
