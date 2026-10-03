import { strict as assert } from "node:assert";
import { test } from "node:test";

import { fleschKincaidGrade, validateClueSet } from "./validate-clues.mjs";

// ---------------------------------------------------------------------------
// Fixtures — an obviously FICTIONAL place. No facts about real places.
// ---------------------------------------------------------------------------

const EXTRACT = [
  "Zorblaxia is a wide flat land by a big river in the north.",
  "The land has hot dry summers and cold wet winters with much rain.",
  "Long ago traders built stone forts along the river and left old carvings there.",
  "A giant stone bell rings each spring and draws crowds from far towns.",
  "Most folks call it the bell town and the river port is known for blue boats.",
].join(" ");

function validSet() {
  return {
    v: 1,
    placeId: "geonames:9999999",
    target: { lon: 12.5, lat: 45.25 },
    clues: [
      "A wide flat land sits by a big river in the north part of the world.",
      "Hot dry summers and cold wet winters bring much rain and wind each year.",
      "Long ago traders built stone forts by the river and left old carvings there.",
      "A giant stone bell rings each spring and draws crowds from far towns.",
      "Most folks call it the bell town and its blue boats fill the port.",
    ],
    source: { label: "Fictional extract", href: "https://example.invalid/zorblaxia" },
    clueSources: [
      { snippet: "wide flat land by a big river in the north", extractId: "extract:zorblaxia" },
      {
        snippet: "hot dry summers and cold wet winters with much rain",
        extractId: "extract:zorblaxia",
      },
      { snippet: "traders built stone forts along the river", extractId: "extract:zorblaxia" },
      { snippet: "giant stone bell rings each spring", extractId: "extract:zorblaxia" },
      { snippet: "the river port is known for blue boats", extractId: "extract:zorblaxia" },
    ],
    difficulty: "easy",
    aliases: ["Zorblax", "Zorb City"],
  };
}

function validCtx() {
  return { placeName: "Zorblaxia", extractText: EXTRACT };
}

function codes(result) {
  return result.reasons.map((r) => r.code);
}

function assertHasCode(result, code) {
  assert.ok(
    codes(result).includes(code),
    `expected reason ${code}, got ${JSON.stringify(result.reasons)}`,
  );
  assert.equal(result.ok, false);
}

// ---------------------------------------------------------------------------
// Valid set
// ---------------------------------------------------------------------------

test("a fully valid synthetic set passes", () => {
  const result = validateClueSet(validSet(), validCtx());
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test("snippet traceable to the extract passes", () => {
  // The valid set's snippets are all verbatim spans of EXTRACT; a
  // dedicated check that traceability alone does not reject it.
  const result = validateClueSet(validSet(), validCtx());
  assert.ok(!codes(result).includes("SOURCE_UNTRACEABLE"));
  assert.ok(!codes(result).includes("SOURCE_MISSING"));
});

// ---------------------------------------------------------------------------
// Name leaks
// ---------------------------------------------------------------------------

test("name leak: direct word", () => {
  const set = validSet();
  set.clues[2] = "Traders once came from Zorblaxia to build stone forts by the river.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "NAME_LEAK");
  const leak = result.reasons.find((r) => r.code === "NAME_LEAK");
  assert.equal(leak.tier, 2);
});

test("name leak: fragment embedded in another token", () => {
  const set = validSet();
  set.clues[3] = "A giant stone bell draws crowds with zorblaxian songs each spring.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "NAME_LEAK");
});

test("name leak: via alias", () => {
  const set = validSet();
  set.clues[4] = "Most folks call the port town Zorblax in short songs and tales.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "NAME_LEAK");
  const leak = result.reasons.find((r) => r.code === "NAME_LEAK");
  assert.equal(leak.tier, 4);
});

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

test("missing clueSources -> SOURCE_MISSING", () => {
  const set = validSet();
  delete set.clueSources;
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "SOURCE_MISSING");
});

test("untraceable snippet -> SOURCE_UNTRACEABLE", () => {
  const set = validSet();
  set.clueSources[1] = {
    snippet: "purple mountains glow above silent crystal lakes",
    extractId: "extract:zorblaxia",
  };
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "SOURCE_UNTRACEABLE");
  const reason = result.reasons.find((r) => r.code === "SOURCE_UNTRACEABLE");
  assert.equal(reason.tier, 1);
});

test("clueSources with no extract supplied fail closed -> SOURCE_UNTRACEABLE", () => {
  const result = validateClueSet(validSet(), { placeName: "Zorblaxia" });
  assertHasCode(result, "SOURCE_UNTRACEABLE");
  const reason = result.reasons.find((r) => r.code === "SOURCE_UNTRACEABLE");
  assert.equal(reason.detail, "no extract supplied; cannot verify");
});

// ---------------------------------------------------------------------------
// Climate
// ---------------------------------------------------------------------------

test("redundant climate (near-duplicate of geography) -> CLIMATE_REDUNDANT", () => {
  const set = validSet();
  set.clues[1] = set.clues[0];
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "CLIMATE_REDUNDANT");
});

test("climate with no weather signal -> CLIMATE_NO_SIGNAL", () => {
  const set = validSet();
  set.clues[1] = "A quiet town has old stone walls and narrow lanes for carts.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "CLIMATE_NO_SIGNAL");
});

// ---------------------------------------------------------------------------
// Reading level / FK helper
// ---------------------------------------------------------------------------

test("over-level reading -> READING_LEVEL", () => {
  const set = validSet();
  set.clues[2] =
    "The institutionalization of extraordinarily complicated bureaucratic mechanisms fundamentally necessitates comprehensive reconsideration of multifaceted organizational interdependencies.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "READING_LEVEL");
});

test("fleschKincaidGrade: simple sentence grades low, complex grades high", () => {
  const simple = fleschKincaidGrade("The cat sat on the mat.");
  const complex = fleschKincaidGrade(
    "The institutionalization of extraordinarily complicated bureaucratic mechanisms fundamentally necessitates comprehensive reconsideration of multifaceted organizational interdependencies.",
  );
  assert.ok(simple < 3, `simple grade ${simple} should be low`);
  assert.ok(complex > 8, `complex grade ${complex} should be high`);
  assert.ok(complex > simple);
});

// ---------------------------------------------------------------------------
// Tier count
// ---------------------------------------------------------------------------

test("4 clues -> TIER_COUNT", () => {
  const set = validSet();
  set.clues = set.clues.slice(0, 4);
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "TIER_COUNT");
});

test("6 clues -> TIER_COUNT", () => {
  const set = validSet();
  set.clues = [...set.clues, "Extra simple clue about blue boats and stone walls."];
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "TIER_COUNT");
});

// ---------------------------------------------------------------------------
// Tier-1 coordinate / elevation patterns
// ---------------------------------------------------------------------------

test('tier-1 with "above sea level" -> TIER1_COORDS', () => {
  const set = validSet();
  set.clues[0] = "This wide flat land sits 1200 meters above sea level near a big river.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "TIER1_COORDS");
  const reason = result.reasons.find((r) => r.code === "TIER1_COORDS");
  assert.equal(reason.tier, 0);
});

test("tier-1 with decimal degrees -> TIER1_COORDS", () => {
  const set = validSet();
  set.clues[0] = "It lies at 12.34 degrees north of a wide flat river plain.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "TIER1_COORDS");
});

// ---------------------------------------------------------------------------
// Difficulty / aliases / version
// ---------------------------------------------------------------------------

test("missing difficulty -> DIFFICULTY_MISSING", () => {
  const set = validSet();
  delete set.difficulty;
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "DIFFICULTY_MISSING");
});

test("invalid difficulty -> DIFFICULTY_INVALID", () => {
  const set = validSet();
  set.difficulty = "extreme";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "DIFFICULTY_INVALID");
});

test("missing aliases -> ALIASES_MISSING", () => {
  const set = validSet();
  delete set.aliases;
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "ALIASES_MISSING");
});

test("wrong v -> SCHEMA_VERSION", () => {
  const set = validSet();
  set.v = 2;
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "SCHEMA_VERSION");
});

// ---------------------------------------------------------------------------
// Length limits
// ---------------------------------------------------------------------------

test("clue over 40 words -> CLUE_TOO_LONG", () => {
  const set = validSet();
  set.clues[2] =
    "Old traders built stone forts by the river long ago and left carvings in the walls for all to see. " +
    "They came each year with carts and boats and songs and tales from far towns near the wide flat land again.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "CLUE_TOO_LONG");
});

test("sentence over 30 words -> SENTENCE_TOO_LONG", () => {
  const set = validSet();
  set.clues[2] =
    "Old traders built stone forts by the wide river long ago and left plain carvings in the stone walls for all the folks in far towns to see and read each year.";
  const result = validateClueSet(set, validCtx());
  assertHasCode(result, "SENTENCE_TOO_LONG");
});

// ---------------------------------------------------------------------------
// Malformed inputs — reasons, never a throw
// ---------------------------------------------------------------------------

test("malformed inputs -> ok:false, no throw", () => {
  for (const bad of [null, undefined, "nope", 42, []]) {
    const result = validateClueSet(bad, validCtx());
    assert.equal(result.ok, false);
    assert.ok(result.reasons.length > 0);
  }
  const notArray = validateClueSet({ clues: "nope" }, validCtx());
  assert.equal(notArray.ok, false);
  assertHasCode(notArray, "TIER_COUNT");
});
