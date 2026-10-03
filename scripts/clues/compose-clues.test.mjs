// compose-clues.test.mjs — tests for the GeoDetective clue composer.
//
// Run: node --test scripts/clues/compose-clues.test.mjs
//
// All fixtures are written to temp files under os.tmpdir(). The accept-path
// fixture uses an obviously FICTIONAL place ("Zorblaxia") with a fictional
// extract — no facts about any real place are fabricated or asserted here.

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_PROMPT_PATH,
  assembleClueSet,
  loadCacheExtract,
  loadGenerationPrompt,
  runComposer,
} from "./compose-clues.mjs";

function writeCache(records) {
  const dir = mkdtempSync(join(tmpdir(), "compose-clues-cache-"));
  const path = join(dir, "cache.jsonl");
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  return path;
}

// --- Fictional fixture -----------------------------------------------------
// Zorblaxia does not exist. Every snippet below is a verbatim span of this
// fictional extract; the clue texts are short, simple, name-free, and the
// climate clue shares no content words of consequence with the geography
// clue beyond generic terms.

const FICTIONAL_ID = 999000111;
const FICTIONAL_EXTRACT = [
  "Low green hills ring a calm blue bay on the west side of this island port.",
  "Rain falls mostly in spring, and summers stay dry and mild.",
  "Sailors founded the port long ago beside an old stone fort.",
  "Each June, boats race across the bay for a silver cup.",
  "A tall clock tower was built above the docks in 1901.",
  "The clock tower rings a bell that sailors can hear across the water.",
].join(" ");

const FICTIONAL_CLUES = [
  {
    text: "Low green hills ring a calm blue bay on the west side of this island port.",
    snippet: "Low green hills ring a calm blue bay",
  },
  {
    text: "Rain falls mostly in spring, and summers stay dry and mild.",
    snippet: "Rain falls mostly in spring",
  },
  {
    text: "Sailors founded the port long ago beside an old stone fort.",
    snippet: "Sailors founded the port long ago",
  },
  {
    text: "Each June, boats race across the bay for a silver cup.",
    snippet: "boats race across the bay for a silver cup",
  },
  {
    text: "The clock tower rings a bell that sailors can hear across the water.",
    snippet: "The clock tower rings a bell",
  },
];

function fictionalCache() {
  return writeCache([
    {
      id: `gn-${FICTIONAL_ID}`,
      status: "matched",
      title: "Zorblaxia",
      extract: FICTIONAL_EXTRACT,
      at: "fixture",
    },
  ]);
}

function fictionalInput(overrides = {}) {
  return {
    geonamesId: FICTIONAL_ID,
    placeName: "Zorblaxia",
    target: { lon: 10.5, lat: 20.25 },
    // Fictional test fixture only — never a production set.
    sourceHref: "https://en.wikipedia.org/wiki/Zorblaxia",
    clues: FICTIONAL_CLUES,
    difficulty: "easy",
    aliases: ["Zorb Town"],
    ...overrides,
  };
}

// --- loadCacheExtract --------------------------------------------------------

test("loadCacheExtract: matched record loads", () => {
  const path = writeCache([
    { id: "gn-42", status: "matched", title: "Somewhere", extract: "A short extract.", at: "t1" },
  ]);
  const result = loadCacheExtract(path, 42);
  assert.equal(result.ok, true);
  assert.equal(result.record.id, "gn-42");
  assert.equal(result.record.title, "Somewhere");
  assert.equal(result.record.extract, "A short extract.");
});

test("loadCacheExtract: latest line wins — error then matched loads", () => {
  const path = writeCache([
    { id: "gn-42", status: "no-article", at: "t1" },
    { id: "gn-42", status: "matched", title: "Somewhere", extract: "Later extract.", at: "t2" },
  ]);
  const result = loadCacheExtract(path, "42");
  assert.equal(result.ok, true);
  assert.equal(result.record.extract, "Later extract.");
});

test("loadCacheExtract: latest line wins — matched then title-mismatch is EXTRACT_STATUS", () => {
  const path = writeCache([
    { id: "gn-42", status: "matched", title: "Somewhere", extract: "Earlier extract.", at: "t1" },
    { id: "gn-42", status: "title-mismatch", at: "t2" },
  ]);
  const result = loadCacheExtract(path, 42);
  assert.equal(result.ok, false);
  assert.equal(result.code, "EXTRACT_STATUS");
  assert.equal(result.detail, "title-mismatch");
});

test("loadCacheExtract: missing id is EXTRACT_NOT_FOUND", () => {
  const path = writeCache([
    { id: "gn-7", status: "matched", title: "Elsewhere", extract: "Text.", at: "t1" },
  ]);
  const result = loadCacheExtract(path, 42);
  assert.equal(result.ok, false);
  assert.equal(result.code, "EXTRACT_NOT_FOUND");
});

test("loadCacheExtract: matched without extract is EXTRACT_EMPTY", () => {
  for (const record of [
    { id: "gn-42", status: "matched", title: "Somewhere", at: "t1" },
    { id: "gn-42", status: "matched", title: "Somewhere", extract: "   ", at: "t1" },
  ]) {
    const result = loadCacheExtract(writeCache([record]), 42);
    assert.equal(result.ok, false);
    assert.equal(result.code, "EXTRACT_EMPTY");
  }
});

test("loadCacheExtract: unreadable cache file is EXTRACT_NOT_FOUND", () => {
  const result = loadCacheExtract(join(tmpdir(), "compose-clues-no-such-file.jsonl"), 42);
  assert.equal(result.ok, false);
  assert.equal(result.code, "EXTRACT_NOT_FOUND");
});

// --- loadGenerationPrompt ----------------------------------------------------

test("loadGenerationPrompt: the shipped placeholder socket is not adopted", () => {
  const result = loadGenerationPrompt(DEFAULT_PROMPT_PATH);
  assert.equal(result.adopted, false);
  assert.match(result.text, /ADOPTION PENDING/);
});

test("loadGenerationPrompt: missing file is adopted:false with detail", () => {
  const result = loadGenerationPrompt(join(tmpdir(), "compose-clues-no-such-prompt.md"));
  assert.equal(result.adopted, false);
  assert.equal(result.text, "");
  assert.ok(result.detail);
});

test("loadGenerationPrompt: a file without the placeholder marker is adopted", () => {
  const dir = mkdtempSync(join(tmpdir(), "compose-clues-prompt-"));
  const path = join(dir, "prompt.md");
  writeFileSync(path, "# Adopted prompt (fixture)\n", "utf8");
  const result = loadGenerationPrompt(path);
  assert.equal(result.adopted, true);
});

// --- runComposer: generation gate ---------------------------------------------

test("runComposer: no clues + placeholder prompt is PROMPT_NOT_ADOPTED", () => {
  const result = runComposer(fictionalInput({ clues: null }), {
    cachePath: fictionalCache(),
    promptPath: DEFAULT_PROMPT_PATH,
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "generation");
  assert.equal(result.code, "PROMPT_NOT_ADOPTED");
});

test("runComposer: unusable extract fails at the extract stage", () => {
  const path = writeCache([{ id: `gn-${FICTIONAL_ID}`, status: "no-article", at: "t1" }]);
  const result = runComposer(fictionalInput(), { cachePath: path });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "extract");
  assert.equal(result.code, "EXTRACT_STATUS");
});

// --- assembleClueSet -----------------------------------------------------------

test("assembleClueSet: deterministic (deep-equal, stable key order) and well-shaped", () => {
  const input = {
    placeId: "geonames:999000111",
    target: { lon: 10.5, lat: 20.25 },
    sourceHref: "https://en.wikipedia.org/wiki/Zorblaxia",
    extractId: "gn-999000111",
    clues: FICTIONAL_CLUES,
    difficulty: "easy",
    aliases: ["Zorb Town"],
  };
  const a = assembleClueSet(input);
  const b = assembleClueSet(structuredClone(input));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(Object.keys(a), [
    "v",
    "placeId",
    "target",
    "clues",
    "source",
    "clueSources",
    "difficulty",
    "aliases",
  ]);
  assert.equal(a.v, 1);
  assert.deepEqual(a.target, { lon: 10.5, lat: 20.25 });
  assert.deepEqual(
    a.clues,
    FICTIONAL_CLUES.map((c) => c.text),
  );
  assert.deepEqual(a.source, { label: "Wikipedia", href: input.sourceHref });
  assert.deepEqual(
    a.clueSources,
    FICTIONAL_CLUES.map((c) => ({ snippet: c.snippet, extractId: "gn-999000111" })),
  );
  assert.equal(a.difficulty, "easy");
  assert.deepEqual(a.aliases, ["Zorb Town"]);
});

test("assembleClueSet: structurally invalid input throws TypeError", () => {
  const base = {
    placeId: "geonames:999000111",
    target: { lon: 10.5, lat: 20.25 },
    sourceHref: "https://en.wikipedia.org/wiki/Zorblaxia",
    extractId: "gn-999000111",
    clues: FICTIONAL_CLUES,
    difficulty: "easy",
    aliases: [],
  };
  assert.throws(() => assembleClueSet(null), TypeError);
  assert.throws(() => assembleClueSet({ ...base, placeId: "" }), TypeError);
  assert.throws(() => assembleClueSet({ ...base, target: { lon: "x", lat: 1 } }), TypeError);
  assert.throws(() => assembleClueSet({ ...base, clues: FICTIONAL_CLUES.slice(0, 4) }), TypeError);
  assert.throws(
    () =>
      assembleClueSet({ ...base, clues: [{ text: 1, snippet: "x" }, ...FICTIONAL_CLUES.slice(1)] }),
    TypeError,
  );
  assert.throws(() => assembleClueSet({ ...base, aliases: "Zorb Town" }), TypeError);
});

// --- runComposer: accept / reject paths ---------------------------------------

test("runComposer: fictional place with traceable snippets is accepted", () => {
  const result = runComposer(fictionalInput(), { cachePath: fictionalCache() });
  assert.equal(result.stage, "validate");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.ok, true);
  assert.equal(result.set.placeId, `geonames:${FICTIONAL_ID}`);
});

test("runComposer: snippet absent from the extract is rejected with SOURCE_UNTRACEABLE", () => {
  const clues = FICTIONAL_CLUES.map((c, i) =>
    i === 3 ? { ...c, snippet: "a purple dragon sleeps under the pier" } : c,
  );
  const result = runComposer(fictionalInput({ clues }), { cachePath: fictionalCache() });
  assert.equal(result.stage, "validate");
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((r) => r.code === "SOURCE_UNTRACEABLE"),
    `expected SOURCE_UNTRACEABLE among ${JSON.stringify(result.reasons)}`,
  );
});
