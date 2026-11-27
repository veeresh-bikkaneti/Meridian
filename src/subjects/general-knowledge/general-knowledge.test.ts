/**
 * General knowledge subject — adapter, answers, the year-gap clock
 * behaviour, and the module contract. Plain Node test runner,
 * relative imports only.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import {
  allGeneralKnowledgeRows,
  itemsForGroup,
  generalKnowledgeUnits,
  GENERAL_KNOWLEDGE_ITEM_IDS,
} from "./items.ts";
import {
  GENERAL_KNOWLEDGE_ANSWERS,
  OPERA_OPENED_YEAR,
  answerFor,
  operaYearsEntry,
} from "./answers.ts";
import { currentYear, yearsSince } from "../shared/years.ts";
import generalKnowledgeModule from "./index.ts";

it("adapter reads every curated general-knowledge row", () => {
  const rows = allGeneralKnowledgeRows();
  // docs/scaling/general-knowledge/items.json.
  assert.equal(rows.length, 17);
  for (const row of rows) {
    assert.ok(row.id.length > 0);
    assert.ok(["7-10", "10-18", "18+"].includes(row.group));
    assert.ok(row.why.length > 0);
    assert.ok(row.objective.length > 0);
  }
});

it("the live slice holds every multiple-choice-ready row, each in its own band", () => {
  const units = generalKnowledgeUnits();
  assert.equal(units.length, GENERAL_KNOWLEDGE_ITEM_IDS.length);
  // Original 10 (5 / 3 / 2) + Wave A (+3 / +6 / +2) + Wave B (+3 / +11 / +0) = 35 (11 / 20 / 4).
  assert.equal(units.length, 35);
  assert.equal(itemsForGroup("7-10").length, 11);
  assert.equal(itemsForGroup("10-18").length, 20);
  assert.equal(itemsForGroup("18+").length, 4);
  for (const group of ["7-10", "10-18", "18+"] as const) {
    for (const item of itemsForGroup(group)) assert.equal(item.group, group);
  }
});

it("every live item has an answer, and every answer belongs to an item", () => {
  const unitIds = new Set(generalKnowledgeUnits().map((u) => u.id));
  for (const id of unitIds) {
    const entry = answerFor(id);
    assert.ok(entry, `missing answer for ${id}`);
    assert.ok(entry.choices.includes(entry.correct), id);
    assert.ok(entry.choices.length >= 3, id);
    assert.ok(entry.derivation.length > 0, id);
    assert.ok(entry.prompt.length > 0, id);
  }
  for (const id of Object.keys(GENERAL_KNOWLEDGE_ANSWERS)) {
    assert.ok(unitIds.has(id), `answer without item: ${id}`);
  }
  assert.equal(answerFor("general-knowledge:nope"), null);
});

it("the year-gap answer is computed from the year it is given", () => {
  // Two faked years, two different right answers — the answer is never
  // typed into content.
  const in2030 = operaYearsEntry(2030);
  assert.equal(in2030.value, 2030 - OPERA_OPENED_YEAR);
  assert.equal(in2030.correct, "57");
  assert.ok(in2030.derivation.includes("2030"));
  const in2000 = operaYearsEntry(2000);
  assert.equal(in2000.value, 27);
  assert.equal(in2000.correct, "27");
  assert.notEqual(in2030.correct, in2000.correct);
  // The live lookup reads the device year at play time.
  const live = answerFor("general-knowledge:mixed:opera-years-ago");
  assert.ok(live);
  assert.equal(live.value, yearsSince(OPERA_OPENED_YEAR, currentYear()));
});

it("each numeric answer matches its derivation", () => {
  const recompute: Record<string, number> = {
    "general-knowledge:mixed:eiffel-antennas": 1083 - 1024,
    "general-knowledge:mixed:trip-buses": Math.ceil((30 + 4) / 8),
    "general-knowledge:mixed:paris-sydney-flight": 17000 / 850,
  };
  for (const [id, expected] of Object.entries(recompute)) {
    const entry = answerFor(id);
    assert.ok(entry, id);
    assert.equal(entry.value, expected, id);
  }
  // Everest against the falls drop: about 80, not 8 or 800.
  const ratio = 8848.86 / 108;
  assert.ok(ratio > 75 && ratio < 90, `ratio ${ratio}`);
  // Tower height from the tangent ratio, within the row's 5% band.
  const height = 1000 * Math.tan((47 * Math.PI) / 180);
  assert.ok(Math.abs(height - 1072) / 1072 < 0.05, `height ${height}`);
  // Falls flow for a day, in scientific notation.
  assert.equal(500_000_000 * 1440, 7.2e11);
});

it("the v2 items' answers follow from their rows' numbers", () => {
  // Older landmark: 1889 (Eiffel Tower) precedes 1973 (Opera House).
  assert.ok(1889 < 1973);
  const older = answerFor("general-knowledge:mixed:older-landmark");
  assert.ok(older);
  assert.equal(older.correct, "The Eiffel Tower");
  // Falls width: 1,708 m is less than 2 km written as metres.
  assert.ok(1708 < 2 * 1000);
  const falls = answerFor("general-knowledge:mixed:falls-in-km");
  assert.ok(falls);
  assert.equal(falls.correct, "Narrower than 2 km");
  // Held: noon-shadow compares three pictures of a shadow — it needs
  // a scene, so it stays out of the live slice.
  assert.ok(!GENERAL_KNOWLEDGE_ITEM_IDS.includes("general-knowledge:mixed:noon-shadow"));
  assert.equal(answerFor("general-knowledge:mixed:noon-shadow"), null);
});

it("Wave A items cover Pillars 3-5 across age bands with verified answers", () => {
  const safetyIds = GENERAL_KNOWLEDGE_ITEM_IDS.filter((id) => id.includes(":safety:"));
  const awarenessIds = GENERAL_KNOWLEDGE_ITEM_IDS.filter((id) => id.includes(":awareness:"));
  const riddleIds = GENERAL_KNOWLEDGE_ITEM_IDS.filter((id) => id.includes(":riddles:"));
  assert.equal(safetyIds.length, 4);
  assert.equal(awarenessIds.length, 3);
  assert.equal(riddleIds.length, 4);
  // Tournament knockout invariant: 127 players -> 126 matches.
  const knockout = answerFor("general-knowledge:riddles:tournament-knockout");
  assert.ok(knockout);
  assert.equal(knockout.value, 127 - 1);
  // Beetle climb: after 7 cycles (+7 ft), day 8 adds +3 ft to reach 10 ft.
  const climb = answerFor("general-knowledge:riddles:wall-climb-days");
  assert.ok(climb);
  assert.equal(climb.correct, "Day 8");
});

it("Wave B items cover NGSS ESS/LS2 (T1-T2) and 100% of the lane11 Envirothon matrix (T3)", () => {
  const envUnits = generalKnowledgeUnits().filter((u) => u.id.includes(":environment:"));
  const envirothonUnits = generalKnowledgeUnits().filter((u) => u.id.includes(":envirothon:"));
  assert.equal(envUnits.filter((u) => u.group === "7-10").length, 3);
  assert.equal(envUnits.filter((u) => u.group === "10-18").length, 3);
  assert.equal(envirothonUnits.length, 8);
  for (const u of envirothonUnits) {
    assert.equal(u.group, "10-18", `expected T3 ("10-18") for ${u.id}`);
  }
  const requiredEnvirothonIds = [
    "general-knowledge:envirothon:soils-horizons",
    "general-knowledge:envirothon:aquatic-macroinvertebrates",
    "general-knowledge:envirothon:forestry-succession",
    "general-knowledge:envirothon:wildlife-habitat-carrying-capacity",
    "general-knowledge:envirothon:current-issue-station",
    "general-knowledge:envirothon:oral-presentation",
    "general-knowledge:envirothon:kansas-rangeland-management",
  ];
  const liveIds = new Set(GENERAL_KNOWLEDGE_ITEM_IDS);
  for (const id of requiredEnvirothonIds) {
    assert.ok(liveIds.has(id), `missing lane11 station item ${id}`);
  }
});

it("the subject module matches contract I1 and is released", () => {
  assert.equal(generalKnowledgeModule.id, "general-knowledge");
  assert.equal(generalKnowledgeModule.released, true);
  assert.deepEqual(generalKnowledgeModule.groups, ["7-10", "10-18", "18+"]);
  assert.equal(generalKnowledgeModule.units.length, 35);
  assert.equal(typeof generalKnowledgeModule.load, "function");
});
