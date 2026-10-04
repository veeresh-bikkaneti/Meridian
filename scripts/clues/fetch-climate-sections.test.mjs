// fetch-climate-sections.test.mjs — unit tests for the tier-2
// source-expansion section fetch (pure functions only; no network).

import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSectionText,
  pickTargetSection,
  shapeRecords,
  splitSections,
  stripTables,
  stripTemplates,
  wikitextToText,
} from "./fetch-climate-sections.mjs";

const WIKITEXT = [
  "Leadville is a town in the mountains.",
  "",
  "== Geography ==",
  "It sits in a high valley by the Clear River.",
  "",
  "=== Climate ===",
  "Winters are long and bitter. Cold air pools in the valley at night, so frost can strike even in July.",
  "The town holds the record for the coldest July night in the state.",
  "",
  "== History ==",
  "It was founded in 1877 by miners.",
].join("\n");

test("splitSections finds headings, levels, and ancestor paths", () => {
  const sections = splitSections(WIKITEXT);
  const climate = sections.find((s) => s.title === "Climate");
  assert.equal(climate.level, 3);
  assert.deepEqual(climate.path, ["Geography"]);
  assert.match(climate.body, /Cold air pools/);
});

test("section body includes subsections but stops at the next same-level heading", () => {
  const sections = splitSections(WIKITEXT);
  const geography = sections.find((s) => s.title === "Geography");
  assert.match(geography.body, /Climate/);
  assert.match(geography.body, /Cold air pools/);
  assert.doesNotMatch(geography.body, /founded in 1877/);
});

test("pickTargetSection prefers a climate subsection over its geography parent", () => {
  const picked = pickTargetSection(splitSections(WIKITEXT));
  assert.equal(picked.source, "climate");
  assert.equal(picked.section.title, "Climate");
});

test("pickTargetSection falls back to geography when no climate heading exists", () => {
  const wt = "Lead.\n\n== Geography ==\nBy the sea.\n\n== History ==\nFounded 1900.\n";
  const picked = pickTargetSection(splitSections(wt));
  assert.equal(picked.source, "geography");
  assert.equal(picked.section.title, "Geography");
});

test("pickTargetSection prefers exact 'Climate' over 'Climate change' regardless of order", () => {
  const wt = [
    "Lead.",
    "",
    "== Climate change ==",
    "Emissions talk.",
    "",
    "== Climate ==",
    "Rain falls mostly in June.",
  ].join("\n");
  const picked = pickTargetSection(splitSections(wt));
  assert.equal(picked.section.title, "Climate");
});

test("stripTemplates removes nested templates; stripTables removes tables", () => {
  assert.equal(stripTemplates("a {{Infobox | x = {{convert|3|km}} }} b"), "a  b");
  assert.equal(stripTables("keep\n{|\n| cell\n|}\nkeep2"), "keep\nkeep2");
});

test("wikitextToText resolves links, drops refs and tables", () => {
  const wt = "The [[River Foo|river]] is cold.<ref name=\"x\">cite</ref> It is [[famous]].\n{| class=\"wikitable\"\n| 1\n|}";
  const text = wikitextToText(wt);
  assert.match(text, /The river is cold\. It is famous\./);
  assert.doesNotMatch(text, /cite|wikitable/);
});

test("extractSectionText returns converted climate prose", () => {
  const section = extractSectionText(WIKITEXT);
  assert.equal(section.source, "climate");
  assert.deepEqual(section.headingPath, ["Geography"]);
  assert.match(section.text, /frost can strike even in July/);
});

test("extractSectionText returns null when neither heading exists", () => {
  assert.equal(extractSectionText("Lead only.\n\n== History ==\nOld.\n"), null);
});

test("shapeRecords maps a page to an ok climate record", () => {
  const data = {
    query: {
      pages: [
        {
          title: "Leadville",
          revisions: [{ slots: { main: { content: WIKITEXT } } }],
        },
      ],
    },
  };
  const [rec] = shapeRecords([{ place_id: "gn-1", article: "Leadville", url: "https://en.wikipedia.org/wiki/Leadville" }], data, "2026-10-04T00:00:00.000Z");
  assert.equal(rec.status, "ok");
  assert.equal(rec.source, "climate");
  assert.ok(rec.words > 10);
});

test("shapeRecords maps a missing page", () => {
  const data = { query: { pages: [{ title: "Nowhere", missing: true }] } };
  const [rec] = shapeRecords([{ place_id: "gn-2", article: "Nowhere", url: "https://en.wikipedia.org/wiki/Nowhere" }], data);
  assert.equal(rec.status, "missing");
});
