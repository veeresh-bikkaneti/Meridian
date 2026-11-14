/**
 * Social studies subject — adapter, answers, numeric recomputation,
 * and the module contract. Plain Node test runner, relative imports
 * only.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import {
  allSocialStudiesRows,
  itemsForGroup,
  socialStudiesUnits,
  SOCIAL_STUDIES_ITEM_IDS,
} from "./items.ts";
import { SOCIAL_STUDIES_ANSWERS, answerFor } from "./answers.ts";
import socialStudiesModule from "./index.ts";

it("adapter reads every curated social-studies row", () => {
  const rows = allSocialStudiesRows();
  // docs/scaling/social-studies/items.json.
  assert.equal(rows.length, 17);
  for (const row of rows) {
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
  }
});

it("the live slice holds the v1 items plus the v2 wave, each in its own band", () => {
  const units = socialStudiesUnits();
  assert.equal(units.length, SOCIAL_STUDIES_ITEM_IDS.length);
  assert.equal(units.length, 12);
  assert.equal(itemsForGroup("7-10").length, 4);
  assert.equal(itemsForGroup("10-18").length, 5);
  assert.equal(itemsForGroup("18+").length, 3);
  for (const group of ["7-10", "10-18", "18+"] as const) {
    for (const item of itemsForGroup(group)) assert.equal(item.group, group);
  }
});

it("every live item has an answer, and every answer belongs to an item", () => {
  const unitIds = new Set(socialStudiesUnits().map((u) => u.id));
  for (const id of unitIds) {
    const entry = answerFor(id);
    assert.ok(entry, `missing answer for ${id}`);
    assert.ok(entry.choices.includes(entry.correct), id);
    assert.ok(entry.choices.length >= 3, id);
    assert.ok(entry.derivation.length > 0, id);
    assert.ok(entry.prompt.length > 0, id);
  }
  for (const id of Object.keys(SOCIAL_STUDIES_ANSWERS)) {
    assert.ok(unitIds.has(id), `answer without item: ${id}`);
  }
  assert.equal(answerFor("social-studies:nope"), null);
});

it("each numeric answer matches its derivation", () => {
  const recompute: Record<string, number> = {
    "social-studies:region:area-by-squares": 3 * 4 - 2 * 4,
    "social-studies:route:count-the-steps": 4 * 10,
    "social-studies:route:trip-clock": 120 / 40,
    "social-studies:route:scale-ratio": (7 * 50_000) / 100_000,
    "social-studies:route:travel-time": 90 / 15,
    "social-studies:compare:trip-cost": 10 + 6 - 13,
  };
  for (const [id, expected] of Object.entries(recompute)) {
    const entry = answerFor(id);
    assert.ok(entry, id);
    assert.equal(entry.value, expected, id);
  }
  // Density: Town A's rate beats Town B's.
  assert.ok(1000 / 2 > 1000 / 8);
  const density = answerFor("social-studies:region:density");
  assert.ok(density);
  assert.equal(density.correct, "Town A");
  // Fastest-or-shortest (v2): the longer valley road takes less time.
  assert.ok(90 / 60 < 60 / 20);
  const fastest = answerFor("social-studies:route:fastest-or-shortest");
  assert.ok(fastest);
  assert.equal(fastest.correct, "The valley road");
  // Time-zones (v2): 8 pm plus 6 hours east lands at 2 am the next day.
  assert.equal((20 + 6) % 24, 2);
  const zones = answerFor("social-studies:compare:time-zones");
  assert.ok(zones);
  assert.equal(zones.correct, "2 am the next day");
  // Compass-clue (v2): east then north lands north-east of the start.
  const compass = answerFor("social-studies:place:compass-clue");
  assert.ok(compass);
  assert.equal(compass.correct, "North-east of the fountain");
});

it("shipped questions stay inside the screened topics", () => {
  // Screened-topics list (humanities/screened-topics.md): the shipped
  // slice is map/route geography only — no religion, no contested
  // politics, no biology in any question, answer or derivation.
  const banned = /\b(religion|religious|god|church|temple|mosque|myth|election|party|politic|biology|animal|plant|body)\b/i;
  for (const entry of Object.values(SOCIAL_STUDIES_ANSWERS)) {
    assert.ok(!banned.test(entry.prompt), entry.prompt);
    assert.ok(!banned.test(entry.derivation), entry.derivation);
    for (const choice of entry.choices) assert.ok(!banned.test(choice), choice);
  }
});

it("the subject module matches contract I1 and is released", () => {
  assert.equal(socialStudiesModule.id, "social-studies");
  assert.equal(socialStudiesModule.released, true);
  assert.deepEqual(socialStudiesModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(socialStudiesModule.units.length, 12);
  assert.equal(typeof socialStudiesModule.load, "function");
});
