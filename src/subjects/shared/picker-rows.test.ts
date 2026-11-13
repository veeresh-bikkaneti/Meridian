/**
 * Picker rows — the pure merge behind the subject picker: released
 * subjects with a playable item for the band are ready; everything
 * else on the map shows "Coming soon" (owner rule, Nov 13).
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import type { SubjectModule, UnitItem } from "../registry.ts";
import { PLANNED_SUBJECTS, pickerRows } from "./picker-rows.ts";

function unit(id: string, group: UnitItem["group"]): UnitItem {
  return {
    id,
    group,
    objective: "objective",
    standard: "UNVERIFIED",
    why: "why",
    buildsOn: [],
    useElsewhere: [],
  };
}

function mod(id: string, title: string, units: UnitItem[]): SubjectModule {
  return {
    id,
    title,
    groups: ["7-10", "10-18", "18+"],
    released: true,
    units,
    load: () => Promise.resolve({ default: () => null }),
  };
}

it("a released subject with band items is ready, in plan order", () => {
  const math = mod("math", "Math", [unit("m1", "7-10"), unit("m2", "7-10")]);
  const rows = pickerRows([math], "7-10");
  assert.deepEqual(
    rows.map((r) => r.id),
    PLANNED_SUBJECTS.map((p) => p.id),
  );
  const first = rows[0];
  assert.equal(first.id, "math");
  assert.equal(first.state, "ready");
  assert.equal(first.caseCount, 2);
  assert.equal(first.module, math);
});

it("a released subject with nothing for the band shows Coming soon", () => {
  const physics = mod("physics", "Physics", [unit("p1", "10-18")]);
  const rows = pickerRows([physics], "7-10");
  const row = rows.find((r) => r.id === "physics");
  assert.equal(row?.state, "coming-soon");
  assert.equal(row?.caseCount, 0);
  assert.equal(row?.module, undefined);
  // The same subject is ready for the band it does cover.
  const older = pickerRows([physics], "10-18");
  assert.equal(older.find((r) => r.id === "physics")?.state, "ready");
});

it("unreleased planned subjects show Coming soon, journals included", () => {
  const rows = pickerRows([], "18+");
  assert.equal(rows.length, PLANNED_SUBJECTS.length);
  for (const row of rows) {
    assert.equal(row.state, "coming-soon", row.id);
    assert.equal(row.caseCount, 0, row.id);
  }
  assert.equal(rows[rows.length - 1].id, "journals");
});

it("a released subject outside the plan still shows, after the plan", () => {
  const extra = mod("astronomy", "Astronomy", [unit("a1", "18+")]);
  const rows = pickerRows([extra], "18+");
  const last = rows[rows.length - 1];
  assert.equal(last.id, "astronomy");
  assert.equal(last.state, "ready");
  assert.equal(last.title, "Astronomy");
});
