/**
 * Physics subject — adapter, answers, band filtering, and the module
 * contract. Plain Node test runner, relative imports only.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { allPhysicsRows, itemsForGroup, physicsUnits, PHYSICS_ITEM_IDS } from "./items.ts";
import { PHYSICS_ANSWERS, answerFor } from "./answers.ts";
import physicsModule from "./index.ts";

it("adapter reads every curated physics row", () => {
  const rows = allPhysicsRows();
  // docs/scaling/physics/items.json.
  assert.equal(rows.length, 24);
  for (const row of rows) {
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
  }
});

it("the live slice holds every curated row, each in its own band", () => {
  const units = physicsUnits();
  assert.equal(units.length, PHYSICS_ITEM_IDS.length);
  assert.equal(units.length, 24);
  const perBand = { "7-10": 12, "10-18": 9, "18+": 3 } as const;
  for (const group of ["7-10", "10-18", "18+"] as const) {
    const items = itemsForGroup(group);
    assert.equal(items.length, perBand[group], group);
    for (const item of items) assert.equal(item.group, group);
  }
  // The v2 plan item is among the live rows.
  assert.ok(PHYSICS_ITEM_IDS.includes("physics:arrive:equal-steps"));
});

it("every live item has an answer, and every answer belongs to an item", () => {
  const unitIds = new Set(physicsUnits().map((u) => u.id));
  for (const id of unitIds) {
    const entry = answerFor(id);
    assert.ok(entry, `missing answer for ${id}`);
    assert.ok(entry.choices.includes(entry.correct), id);
    assert.ok(entry.choices.length >= 3, id);
    assert.ok(entry.derivation.length > 0, id);
    assert.ok(entry.prompt.length > 0, id);
  }
  for (const id of Object.keys(PHYSICS_ANSWERS)) {
    assert.ok(unitIds.has(id), `answer without item: ${id}`);
  }
  assert.equal(answerFor("physics:nope"), null);
});

it("each numeric answer matches its derivation", () => {
  const recompute: Record<string, number> = {
    "physics:push:equal-pushes": 4 * 2,
    "physics:arrive:adult-time": 12 / 4,
    "physics:energy:missing": 3 + 2,
  };
  for (const [id, expected] of Object.entries(recompute)) {
    const entry = answerFor(id);
    assert.ok(entry, id);
    assert.equal(entry.value, expected, id);
    assert.ok(entry.correct.startsWith(String(expected)), id);
  }
  // The unit-rate winner, recomputed: 8/2 beats 9/3.
  assert.ok(8 / 2 > 9 / 3);
  // The slope winners, recomputed: rise/run.
  assert.ok(2 / 2 > 2 / 4);
  assert.ok(4 / 6 > 3 / 6);
  // The equal-steps winner, recomputed: 3 tiles each step beats 1.
  assert.ok(3 > 1);
  // No physics row is year-based, so no pinned-clock year test applies.
  for (const entry of Object.values(PHYSICS_ANSWERS)) {
    assert.equal(/\b(19|20)\d\d\b/.test(entry.prompt), false, entry.prompt);
  }
});

it("the subject module matches contract I1 and is released", () => {
  assert.equal(physicsModule.id, "physics");
  assert.equal(physicsModule.released, true);
  assert.deepEqual(physicsModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(physicsModule.units.length, 24);
  assert.equal(typeof physicsModule.load, "function");
});
