// clue-giveaway.test.mjs — tests for the published-clue giveaway audit.
//
// Run: node --test scripts/clues/clue-giveaway.test.mjs
//
// Matcher fixtures use an obviously FICTIONAL place (Velmoor, capital of
// Kestrel Province in Velmara) — no facts about any real place are
// asserted. The corpus test scans the real published clue files and
// compares against clue-giveaway-baseline.json (the KNOWN/STALE pattern
// from lint-subject-leads): a new violation fails, and a baselined case
// that stops violating fails as stale, so the baseline only shrinks.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  capitalGiveaway,
  compareBaseline,
  scanPublishedCases,
} from "./clue-giveaway.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const IDENTITY = {
  name: "Velmoor",
  aliases: [],
  subdivision: "Kestrel Province",
  country: "Velmara",
  pack: false,
};

test("capitalGiveaway fires when clue 1 names what the answer is capital of", () => {
  const sentences = [
    "It is the capital of Kestrel province.",
    "This is the capital and largest city of Velmara.",
    "It is the chief city of Kestrel.",
    "It leads the Kestrel region as its capital, with farms all round it.",
    "This capital city sits in Kestrel, in the north of Velmara.",
  ];
  for (const s of sentences) {
    assert.ok(capitalGiveaway(s, IDENTITY), `expected a hit: ${s}`);
  }
});

test("capitalGiveaway ignores capital history, other places, and narrowing style", () => {
  const sentences = [
    // Past tense: the answer used to be a capital.
    "It became the capital of Kestrel in 1810.",
    "It was the capital of Kestrel for a century, then the seat moved on.",
    // A different named place is the capital; the answer is not.
    "It lies south of Drenno, the capital of Velmara.",
    // Region unnamed: the corpus's standard narrowing style.
    "It is the capital of a province in Velmara.",
    // Capital status plus a coarse location, region still unnamed.
    "This is a capital city in the northwest of Velmara.",
    // Metaphor, not a seat of government.
    "Many call it the health capital of Velmara.",
    // No capital content at all.
    "This town sits by a wide river, west of the hills.",
  ];
  for (const s of sentences) {
    assert.equal(capitalGiveaway(s, IDENTITY), null, `expected no hit: ${s}`);
  }
});

test("capitalGiveaway treats the Capitals pack's given country as premise, not a leak", () => {
  const packIdentity = { ...IDENTITY, pack: true };
  assert.equal(capitalGiveaway("This is the capital of Velmara.", packIdentity), null);
  assert.ok(capitalGiveaway("It is the capital of Kestrel province.", packIdentity));
});

test("compareBaseline splits known, fresh, and stale", () => {
  const baseline = [{ case: 1, slot: 1, rule: "CAPITAL_GIVEAWAY" }];
  const scan = [
    { case: 1, slot: 1, rule: "CAPITAL_GIVEAWAY" },
    { case: 2, slot: 1, rule: "NAME_LEAK" },
  ];
  const { known, fresh, stale } = compareBaseline(scan, baseline);
  assert.equal(known.length, 1);
  assert.deepEqual(
    fresh.map((v) => v.case),
    [2],
  );
  assert.equal(stale.length, 0);
  const shrunk = compareBaseline([], baseline);
  assert.equal(shrunk.stale.length, 1, "a fixed baselined case must read as stale");
});

test("published corpus: no giveaway beyond the baselined known set", () => {
  const { violations, caseCount } = scanPublishedCases(ROOT);
  const coreSize = JSON.parse(readFileSync(join(ROOT, "public", "loop", "manifest.json"), "utf8")).size;
  const packSize = JSON.parse(
    readFileSync(join(ROOT, "public", "packs", "capitals", "manifest.json"), "utf8"),
  ).size;
  assert.equal(caseCount, coreSize + packSize, "the audit must scan every published case");
  const baseline = JSON.parse(readFileSync(join(HERE, "clue-giveaway-baseline.json"), "utf8")).entries;
  const { fresh, stale } = compareBaseline(violations, baseline);
  assert.deepEqual(
    fresh,
    [],
    `new giveaway violations:\n${fresh.map((v) => `case ${v.case} slot ${v.slot} ${v.rule} (${v.answer}) — ${v.detail}`).join("\n")}`,
  );
  assert.deepEqual(
    stale,
    [],
    `baselined cases no longer violate — remove their entries from clue-giveaway-baseline.json: ${stale
      .map((e) => `case ${e.case} slot ${e.slot} ${e.rule}`)
      .join(", ")}`,
  );
});
