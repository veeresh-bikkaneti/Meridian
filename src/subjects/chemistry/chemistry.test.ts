/**
 * Chemistry subject — adapter, answers, band filtering, the fact-note
 * wording limits, and the module contract. Plain Node test runner,
 * relative imports only.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { allChemistryRows, itemsForGroup, chemistryUnits, CHEMISTRY_ITEM_IDS } from "./items.ts";
import { CHEMISTRY_ANSWERS, answerFor } from "./answers.ts";
import chemistryModule from "./index.ts";

it("adapter reads every curated chemistry row", () => {
  const rows = allChemistryRows();
  // docs/scaling/chemistry/items.json.
  assert.equal(rows.length, 18);
  for (const row of rows) {
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
  }
});

it("the live slice holds every playable row, each in its own band", () => {
  const units = chemistryUnits();
  assert.equal(units.length, CHEMISTRY_ITEM_IDS.length);
  assert.equal(units.length, 16);
  const perBand = { "7-10": 5, "10-18": 8, "18+": 3 } as const;
  for (const group of ["7-10", "10-18", "18+"] as const) {
    const items = itemsForGroup(group);
    assert.equal(items.length, perBand[group], group);
    for (const item of items) assert.equal(item.group, group);
  }
});

it("every curated row is listed except the held one, and the held one stays out", () => {
  // Stream A sort (2026-11-13): all 9 unplayed rows fit multiple choice
  // except two held ones — chemistry:water:where (its skill is
  // pointing at water bodies on the globe, and as text its question is
  // ambiguous: the vanished puddle's water vs the lake's) and
  // chemistry:elements:detective (held on reviewer BLOCKED verdict,
  // 2026-11-14: its answer needs the down-column reactivity trend,
  // which its row never states, and the 18+ explain item teaches
  // same-column → "similar way").
  const held = new Set(["chemistry:water:where", "chemistry:elements:detective"]);
  const listed = new Set(CHEMISTRY_ITEM_IDS);
  const rows = allChemistryRows();
  assert.equal(rows.length, 18);
  for (const row of rows) {
    if (held.has(row.id)) {
      assert.ok(!listed.has(row.id), `held row must stay out: ${row.id}`);
    } else {
      assert.ok(listed.has(row.id), `row not listed: ${row.id}`);
    }
  }
});

it("no chemistry answer is numeric or year-based, so the value/clock clauses are vacuous here", () => {
  // No chemistry row has a numeric answer (nothing needs the typed-number
  // kind) and none is year-based, so no entry carries value and no test
  // needs a pinned clock. If a future row adds either, this test must go.
  for (const [id, entry] of Object.entries(CHEMISTRY_ANSWERS)) {
    assert.equal(entry.value, undefined, id);
    assert.ok(!/\b(19|20)\d\d\b/.test(`${entry.prompt} ${entry.derivation}`), id);
  }
});

it("every live item has an answer, and every answer belongs to an item", () => {
  const unitIds = new Set(chemistryUnits().map((u) => u.id));
  for (const id of unitIds) {
    const entry = answerFor(id);
    assert.ok(entry, `missing answer for ${id}`);
    assert.ok(entry.choices.includes(entry.correct), id);
    assert.ok(entry.choices.length >= 3, id);
    assert.ok(entry.derivation.length > 0, id);
    assert.ok(entry.prompt.length > 0, id);
  }
  for (const id of Object.keys(CHEMISTRY_ANSWERS)) {
    assert.ok(unitIds.has(id), `answer without item: ${id}`);
  }
  assert.equal(answerFor("chemistry:nope"), null);
});

it("road-salt wording stays inside the fact-notes limit", () => {
  // fact-notes.md: salt is supported only as "deicers lower water's
  // freezing point" — never a melt speed, never a stated temperature.
  const entry = answerFor("chemistry:states:road-salt");
  assert.ok(entry);
  const text = `${entry.prompt} ${entry.correct} ${entry.derivation}`.toLowerCase();
  assert.ok(text.includes("lowers") && text.includes("freezing point"));
  assert.ok(!/faster|faster|speed/.test(text), "no melt-speed claim");
  assert.ok(!/\d+\s*°|degrees/.test(text), "no stated temperature");
});

it("no shipped question or answer carries biology", () => {
  const banned = /\b(plant|animal|body|blood|cell|seed|leaf|tree|flower|insect|bird|fish)\b/i;
  for (const entry of Object.values(CHEMISTRY_ANSWERS)) {
    const text = `${entry.prompt} ${entry.choices.join(" ")} ${entry.derivation}`;
    assert.ok(!banned.test(text), text);
  }
});

it("the subject module matches contract I1 and is released", () => {
  assert.equal(chemistryModule.id, "chemistry");
  assert.equal(chemistryModule.released, true);
  assert.deepEqual(chemistryModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(chemistryModule.units.length, 16);
  assert.equal(typeof chemistryModule.load, "function");
});
