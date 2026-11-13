/**
 * Math subject (wave 1) — adapter, answers, band filtering, year math,
 * and the flag-off contract. Plain Node test runner, relative imports
 * only (the src suite runs under node --experimental-strip-types).
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { allMathRows, itemsForGroup, mathUnits, WAVE1_ITEM_IDS } from "./items.ts";
import { MATH_ANSWERS, answerFor, currentYear, yearsSince } from "./answers.ts";
import { isEnabled, scaleParamOn } from "../../lib/flags.ts";
import mathModule from "./index.ts";

it("adapter reads the rows from both data files", () => {
  const rows = allMathRows();
  // docs/scaling/math/number/items.json (30) + applied/items.json (35).
  assert.equal(rows.length, 65);
  for (const row of rows) {
    assert.equal(typeof row.id, "string");
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
    assert.ok(Array.isArray(row.useElsewhere));
  }
});

it("wave-1 slice holds up to 3 items per band", () => {
  const units = mathUnits();
  assert.equal(units.length, WAVE1_ITEM_IDS.length);
  assert.equal(units.length, 9);
  for (const group of ["7-10", "10-18", "18+"] as const) {
    assert.equal(itemsForGroup(group).length, 3, group);
  }
});

it("items filter by band — each band deals only its own items", () => {
  for (const group of ["7-10", "10-18", "18+"] as const) {
    const items = itemsForGroup(group);
    assert.ok(items.length > 0);
    for (const item of items) assert.equal(item.group, group);
  }
  const ids = (g: "7-10" | "10-18" | "18+") => itemsForGroup(g).map((i) => i.id);
  assert.deepEqual(ids("7-10"), [
    "math-number:groups:skip-count",
    "math-number:groups:equal-groups",
    "math-number:tables:buses",
  ]);
  assert.deepEqual(ids("18+"), [
    "math-number:tables:mental-strategies",
    "math-number:fractions:combine-shares",
    "math-applied:measure:survey-check",
  ]);
});

it("every wave-1 item has an answer, and every answer belongs to an item", () => {
  const unitIds = new Set(mathUnits().map((u) => u.id));
  for (const id of unitIds) {
    const entry = answerFor(id);
    assert.ok(entry, `missing answer for ${id}`);
    assert.ok(entry.choices.includes(entry.correct), id);
    assert.ok(entry.choices.length >= 3, id);
    assert.ok(entry.derivation.length > 0, id);
    assert.ok(entry.prompt.length > 0, id);
  }
  for (const id of Object.keys(MATH_ANSWERS)) {
    assert.ok(unitIds.has(id), `answer without item: ${id}`);
  }
  assert.equal(answerFor("math-number:nope"), null);
});

it("each numeric answer matches its derivation", () => {
  const recompute: Record<string, number> = {
    "math-number:groups:skip-count": 40 / 5,
    "math-number:groups:equal-groups": 4 * 6,
    "math-number:tables:buses": 24 / 6,
    "math-number:tables:multi-digit": 23 * 47,
    "math-applied:measure:convert-metric": 2.4 * 1000,
    "math-number:fractions:percent": 80 - 80 * 0.3,
    "math-number:tables:mental-strategies": 24 * 10 + 24 * 5,
    "math-number:fractions:combine-shares": (120 - 120 / 2 - 120 / 4) / 2 * 0.9,
  };
  for (const [id, expected] of Object.entries(recompute)) {
    const entry = answerFor(id);
    assert.ok(entry, id);
    assert.equal(entry.value, expected, id);
    // The displayed correct choice is the value, comma-formatted.
    const shown = expected.toLocaleString("en-US", { maximumFractionDigits: 1 });
    assert.equal(entry.correct, shown, id);
  }
});

it("year math uses the current year", () => {
  // Pinned clock: the mechanism resolves from the year it is given.
  assert.equal(yearsSince(1973, 2030), 57);
  assert.equal(yearsSince(2000, 2000), 0);
  // Live clock: the default read is the device's current year.
  assert.equal(currentYear(), new Date().getFullYear());
  assert.equal(yearsSince(1973, currentYear()), new Date().getFullYear() - 1973);
});

it("flag off changes nothing: scalePlay defaults off without ?scale=1", () => {
  assert.equal(scaleParamOn(""), false);
  assert.equal(scaleParamOn("?scale=0"), false);
  assert.equal(scaleParamOn("?scale=1"), true);
  // No remote overrides are loaded in this process, so the baked-in
  // default rules: off. (In the browser, scaleParamOn() reads the live
  // URL; here the empty-search default keeps it off.)
  assert.equal(isEnabled("scalePlay"), false);
});

it("the subject module matches contract I1 and stays unreleased", () => {
  assert.equal(mathModule.id, "math");
  assert.equal(mathModule.released, false);
  assert.deepEqual(mathModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(mathModule.units.length, 9);
  assert.equal(typeof mathModule.load, "function");
});
