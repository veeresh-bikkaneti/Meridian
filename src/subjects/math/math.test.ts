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
  assert.equal(rows.length, 71);
  for (const row of rows) {
    assert.equal(typeof row.id, "string");
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
    assert.ok(Array.isArray(row.useElsewhere));
  }
});

it("playable slice: wave 1 plus up to 10 wave-2 items per band", () => {
  const units = mathUnits();
  assert.equal(units.length, WAVE1_ITEM_IDS.length);
  // Wave 1 dealt 3 per band (9 total). Wave 2 adds 10 for 7-10 and 10
  // for 10-18; 18+ has no unplayed rows left, so it stays at 3.
  assert.equal(units.length, 29);
  assert.equal(itemsForGroup("7-10").length, 13);
  assert.equal(itemsForGroup("10-18").length, 13);
  assert.equal(itemsForGroup("18+").length, 3);
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
    "math-number:place:hundreds-tens-ones",
    "math-number:place:compare",
    "math-number:place:round",
    "math-number:place:ten-times",
    "math-number:tables:facts",
    "math-number:tables:big-products",
    "math-number:division:fair-share",
    "math-number:division:unknown-factor",
    "math-number:division:remainders",
    "math-number:division:big-quotients",
  ]);
  assert.deepEqual(ids("10-18"), [
    "math-number:tables:multi-digit",
    "math-applied:measure:convert-metric",
    "math-number:fractions:percent",
    "math-applied:geometry:scale-drawing",
    "math-number:division:standard-algorithm",
    "math-number:fractions:multiply",
    "math-number:fractions:divide",
    "math-applied:measure:accuracy",
    "math-applied:rates:unit-rate",
    "math-applied:rates:constant-speed",
    "math-applied:rates:one-step",
    "math-applied:rates:two-step",
    "math-applied:trig:bearings",
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

it("each wave-2 numeric answer matches its derivation", () => {
  // id -> [recomputed value, displayed correct choice]
  const recompute: Record<string, [number, string]> = {
    "math-number:place:hundreds-tens-ones": [3 * 100 + 4 * 10 + 5, "345"],
    "math-number:place:compare": [Math.max(358, 385), "385"],
    "math-number:place:round": [Math.round(287 / 100) * 100, "300"],
    "math-number:place:ten-times": [70 * 10, "700"],
    "math-number:tables:facts": [7 * 4, "28"],
    "math-number:tables:big-products": [126 * 8, "1,008"],
    "math-number:division:fair-share": [12 / 4, "3"],
    "math-number:division:unknown-factor": [40 / 8, "5"],
    "math-number:division:remainders": [Math.ceil(26 / 6), "5"],
    "math-number:division:big-quotients": [1248 / 8, "156"],
    "math-applied:geometry:scale-drawing": [4 * 2, "8"],
    "math-number:division:standard-algorithm": [4368 / 28, "156"],
    "math-number:fractions:divide": [6 / (3 / 4), "8"],
    "math-applied:measure:accuracy": [Math.round(2.4837 * 100) / 100, "2.48"],
    "math-applied:rates:unit-rate": [8 / 5, "1.6"],
    "math-applied:rates:constant-speed": [20 / (12 / 3), "5"],
    "math-applied:rates:one-step": [12 - 5, "7"],
    "math-applied:rates:two-step": [(19 - 4) / 3, "5"],
  };
  for (const [id, [expected, shown]] of Object.entries(recompute)) {
    const entry = answerFor(id);
    assert.ok(entry, id);
    assert.equal(entry.value, expected, id);
    assert.equal(entry.correct, shown, id);
    assert.ok(entry.choices.includes(entry.correct), id);
  }
  // The cheaper stall in unit-rate really is the second one.
  assert.ok(8 / 5 < 6 / 3);
  // Fraction product: the displayed choice is the fraction itself.
  const multiply = answerFor("math-number:fractions:multiply");
  assert.ok(multiply);
  assert.equal(multiply.value, (2 / 3) * (1 / 2));
  assert.equal(multiply.correct, "1/3");
  // Bearings: the displayed angle is the inverse tangent of east/north,
  // rounded to the nearest degree (pinned inputs, no clock involved).
  const bearings = answerFor("math-applied:trig:bearings");
  assert.ok(bearings);
  assert.equal(Math.round((Math.atan(6 / 8) * 180) / Math.PI), 37);
  assert.equal(bearings.correct, "37°");
});

it("every wave-2 item sits in its own row's band", () => {
  const rowsById = new Map(allMathRows().map((row) => [row.id, row]));
  const wave1 = new Set([
    "math-number:groups:skip-count",
    "math-number:groups:equal-groups",
    "math-number:tables:buses",
    "math-number:tables:multi-digit",
    "math-applied:measure:convert-metric",
    "math-number:fractions:percent",
    "math-number:tables:mental-strategies",
    "math-number:fractions:combine-shares",
    "math-applied:measure:survey-check",
  ]);
  let added = 0;
  for (const unit of mathUnits()) {
    if (wave1.has(unit.id)) continue;
    added += 1;
    const row = rowsById.get(unit.id);
    assert.ok(row, `no row for ${unit.id}`);
    assert.equal(unit.group, row.group, unit.id);
    assert.ok(answerFor(unit.id), `no answer for ${unit.id}`);
  }
  assert.equal(added, 20);
});

it("the scalePlay flag itself still defaults off (the card no longer reads it)", () => {
  assert.equal(scaleParamOn(""), false);
  assert.equal(scaleParamOn("?scale=0"), false);
  assert.equal(scaleParamOn("?scale=1"), true);
  // No remote overrides are loaded in this process, so the baked-in
  // default rules: off. (In the browser, scaleParamOn() reads the live
  // URL; here the empty-search default keeps it off.)
  assert.equal(isEnabled("scalePlay"), false);
});

it("the subject module matches contract I1 and is released", () => {
  assert.equal(mathModule.id, "math");
  // Owner rule, Nov 13: a playable slice exists for every band, so math
  // ships; educator review runs alongside, after release.
  assert.equal(mathModule.released, true);
  assert.deepEqual(mathModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(mathModule.units.length, 29);
  assert.equal(typeof mathModule.load, "function");
});
