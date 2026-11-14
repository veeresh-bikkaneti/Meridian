/**
 * Journals subject (Stream D, PR D1) — adapter, answers, band placement,
 * year math with a pinned clock, caption parsing. Plain Node test
 * runner, relative imports only (the src suite runs under node
 * --experimental-strip-types). caption-files.ts (Vite ?raw) is not
 * imported here.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { JOURNAL_ITEM_IDS, captionRefFor, itemsForGroup, journalUnits } from "./items.ts";
import { answerFor, journalAnswers, currentYear, yearsSince } from "./answers.ts";
import { cueText } from "./captions.ts";
import journalsModule from "./index.ts";

it("every unit has an answer with three distinct choices, one correct", () => {
  const units = journalUnits();
  assert.equal(units.length, JOURNAL_ITEM_IDS.length);
  const answers = journalAnswers(2026);
  for (const unit of units) {
    const entry = answers[unit.id];
    assert.ok(entry, `missing answer for ${unit.id}`);
    assert.equal(entry.choices.length, 3, `${unit.id}: want 1 right + 2 wrong`);
    assert.equal(new Set(entry.choices).size, 3, `${unit.id}: choices repeat`);
    assert.ok(entry.choices.includes(entry.correct), `${unit.id}: correct not in choices`);
    assert.ok(entry.derivation.length > 0, `${unit.id}: derivation empty`);
  }
});

it("every answer belongs to a unit, so nothing is orphaned", () => {
  const ids = new Set(journalUnits().map((unit) => unit.id));
  for (const id of Object.keys(journalAnswers(2026))) {
    assert.ok(ids.has(id), `answer ${id} has no unit`);
  }
});

it("bands: each unit sits in its own band, and the bands are 7-10, 10-18, 18+", () => {
  const byGroup = (group: string) => itemsForGroup(group as "7-10").map((unit) => unit.id);
  assert.deepEqual(byGroup("7-10"), [
    "great-leaders:lincoln-memorial",
    "technology:first-phone",
    "technology:eniac",
    "modern-world:greenwich-zero",
    "modern-world:liverpool-manchester",
    "modern-world:hearts-content-cable",
    "people-places:pont-du-gard",
    "people-places:akashi-span",
  ]);
  assert.deepEqual(byGroup("10-18"), [
    "technology:mobile-phone",
    "great-leaders:lincoln-memorial:stretch",
    "modern-world:greenwich-zero:stretch",
    "modern-world:liverpool-manchester:stretch",
    "modern-world:hearts-content-cable:stretch",
    "people-places:eratosthenes-earth",
    "people-places:andean-roads",
  ]);
  assert.deepEqual(byGroup("18+"), ["people-places:aconcagua-height"]);
});

it("the module is released, discovered as journals, and has units for each band", () => {
  assert.equal(journalsModule.id, "journals");
  assert.equal(journalsModule.title, "Journals");
  assert.equal(journalsModule.released, true);
  assert.deepEqual(journalsModule.groups, ["7-10", "10-18", "18+"]);
  for (const group of journalsModule.groups) {
    assert.ok(journalsModule.units.some((unit) => unit.group === group), `no unit for ${group}`);
  }
});

it("base units carry their row's band; stretch units carry the stretch band", () => {
  const units = new Map(journalUnits().map((unit) => [unit.id, unit]));
  assert.equal(units.get("technology:eniac")?.group, "7-10");
  assert.equal(units.get("people-places:andean-roads")?.group, "10-18");
  assert.equal(units.get("people-places:aconcagua-height")?.group, "18+");
  assert.equal(units.get("great-leaders:lincoln-memorial:stretch")?.group, "10-18");
  assert.equal(units.get("great-leaders:lincoln-memorial")?.group, "7-10");
});

it("Lincoln: the opening question matches the row (1922 − 1914 = 8)", () => {
  const unit = journalUnits().find((u) => u.id === "great-leaders:lincoln-memorial");
  assert.ok(unit);
  assert.match(unit.why, /1914/);
  assert.match(unit.why, /1922/);
  const entry = journalAnswers(2026)["great-leaders:lincoln-memorial"];
  assert.equal(entry.correct, String(1922 - 1914));
  assert.equal(entry.value, 8);
});

it("Lincoln 10-18 stretch: 19 + x = 44 gives x = 25, as the row says", () => {
  const unit = journalUnits().find((u) => u.id === "great-leaders:lincoln-memorial:stretch");
  assert.ok(unit);
  assert.match(unit.why, /19 feet/);
  assert.match(unit.why, /44 feet/);
  assert.equal(44 - 19, 25);
  assert.equal(journalAnswers(2026)[unit.id].correct, "25");
});

it("years-ago answers are computed from the pinned clock, never typed", () => {
  const at2030 = journalAnswers(2030);
  assert.equal(at2030["technology:first-phone"].correct, String(2030 - 1876));
  assert.equal(at2030["technology:first-phone"].value, 154);
  assert.equal(at2030["modern-world:liverpool-manchester"].correct, String(2030 - 1830));
  const at2050 = journalAnswers(2050);
  assert.equal(at2050["technology:first-phone"].correct, "174");
  // Fixed-sum answers do not move with the clock.
  assert.equal(at2030["technology:mobile-phone"].correct, "97");
  assert.equal(at2050["technology:mobile-phone"].correct, "97");
});

it("yearsSince and currentYear read the year they are given", () => {
  assert.equal(yearsSince(1876, 2026), 150);
  assert.equal(typeof currentYear(new Date("2026-06-01T12:00:00")), "number");
  assert.equal(currentYear(new Date("2026-06-01T12:00:00")), 2026);
  assert.ok(answerFor("technology:first-phone")?.correct);
  assert.equal(answerFor("not:a-unit"), null);
});

it("caption parse: header, NOTE, cue numbers and timestamps are dropped", () => {
  const vtt = [
    "WEBVTT",
    "",
    "NOTE Cue times match the committed narration.",
    "",
    "1",
    "00:00:00.000 --> 00:00:02.069",
    "Hey kids, have you heard about this place?",
    "",
    "2",
    "00:00:02.249 --> 00:00:05.001",
    "<i>Washington, D.C., 1922.</i>",
    "",
  ].join("\n");
  assert.equal(cueText(vtt), "Hey kids, have you heard about this place? Washington, D.C., 1922.");
});

it("caption parse keeps cue payloads that look like headers or numbers", () => {
  const vtt = [
    "WEBVTT",
    "",
    "1",
    "00:00:00.000 --> 00:00:02.000",
    "1973",
    "",
    "2",
    "00:00:02.000 --> 00:00:04.000",
    "NOTE the bell rang",
    "next line",
    "",
  ].join("\n");
  assert.equal(cueText(vtt), "1973 NOTE the bell rang next line");
});

it("caption refs: base rows with a caption file resolve, stretch and caption-less rows do not", () => {
  assert.deepEqual(captionRefFor("technology:first-phone"), {
    journal: "technology",
    file: "first-phone.vtt",
  });
  assert.deepEqual(captionRefFor("modern-world:greenwich-zero"), {
    journal: "modern-world",
    file: "greenwich-zero.vtt",
  });
  assert.equal(captionRefFor("technology:mobile-phone:stretch"), null);
  assert.equal(captionRefFor("great-leaders:lincoln-memorial:stretch"), null);
});

it("'You just used this in…' is one short line for every unit, with no measurements", () => {
  for (const unit of journalUnits()) {
    assert.equal(unit.useElsewhere.length, 1);
    assert.doesNotMatch(unit.useElsewhere[0], /\d/, `${unit.id} line has a number`);
  }
});
