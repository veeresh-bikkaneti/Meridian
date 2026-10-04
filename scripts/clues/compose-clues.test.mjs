// compose-clues.test.mjs — tests for the GeoDetective clue composer
// support module (Phase 2: prompt socket, cache extracts, §10 assembly).
//
// Run: node --test scripts/clues/compose-clues.test.mjs
//
// All fixtures are written to temp files under os.tmpdir() and use an
// obviously FICTIONAL place ("Zorblaxia") — no facts about any real
// place are fabricated or asserted here.

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assemblePublishedFile,
  buildManifest,
  loadCacheExtract,
  loadGenerationPrompt,
} from "./compose-clues.mjs";

function tmpFile(name, content) {
  const dir = mkdtempSync(join(tmpdir(), "clues-compose-"));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

// ---------------------------------------------------------------------------
// loadGenerationPrompt
// ---------------------------------------------------------------------------

test("loadGenerationPrompt: placeholder fixture is not adopted", () => {
  const path = tmpFile("prompt.md", "# Generation Prompt — PLACEHOLDER — ADOPTION PENDING\n");
  const result = loadGenerationPrompt(path);
  assert.equal(result.adopted, false);
});

test("loadGenerationPrompt: real prompt text is adopted", () => {
  const path = tmpFile("prompt.md", "# GeoDetective — 5-Tier Clue Generation Prompt, v1 (FINAL)\n");
  const result = loadGenerationPrompt(path);
  assert.equal(result.adopted, true);
  assert.match(result.text, /Generation Prompt/);
});

test("loadGenerationPrompt: missing file is not adopted and explains itself", () => {
  const result = loadGenerationPrompt(join(tmpdir(), "definitely-missing-prompt.md"));
  assert.equal(result.adopted, false);
  assert.ok(result.detail && result.detail.length > 0);
});

test("loadGenerationPrompt: the shipped socket now holds the adopted prompt", () => {
  // Phase 2 state: scripts/clues/generation-prompt.md is the verbatim
  // adopted prompt v1, so the default socket reads as adopted.
  const result = loadGenerationPrompt();
  assert.equal(result.adopted, true);
  assert.match(result.text, /GeoDetective — 5-Tier Clue Generation Prompt, v1 \(FINAL\)/);
});

// ---------------------------------------------------------------------------
// loadCacheExtract
// ---------------------------------------------------------------------------

const CACHE_LINES = [
  JSON.stringify({ id: "gn-42", status: "error", at: "2026-10-02T00:00:00Z" }),
  JSON.stringify({ id: "gn-42", status: "matched", title: "Zorblaxia, Velmara", extract: "First version of the extract.", at: "2026-10-02T01:00:00Z" }),
  JSON.stringify({ id: "gn-42", status: "matched", title: "Zorblaxia, Velmara", extract: "Latest version of the extract.", at: "2026-10-02T02:00:00Z" }),
  JSON.stringify({ id: "gn-77", status: "title-mismatch", at: "2026-10-02T03:00:00Z" }),
  JSON.stringify({ id: "gn-88", status: "matched", title: "Emptyton", extract: "   ", at: "2026-10-02T04:00:00Z" }),
  "this line is not json",
].join("\n");

test("loadCacheExtract: latest matched line wins", () => {
  const path = tmpFile("cache.jsonl", CACHE_LINES);
  const result = loadCacheExtract(path, 42);
  assert.equal(result.ok, true);
  assert.equal(result.record.extract, "Latest version of the extract.");
  assert.equal(result.record.title, "Zorblaxia, Velmara");
});

test("loadCacheExtract: non-matched status reported", () => {
  const path = tmpFile("cache.jsonl", CACHE_LINES);
  const result = loadCacheExtract(path, "gn-77");
  assert.equal(result.ok, false);
  assert.equal(result.code, "EXTRACT_STATUS");
});

test("loadCacheExtract: blank extract is EXTRACT_EMPTY; unknown id is EXTRACT_NOT_FOUND", () => {
  const path = tmpFile("cache.jsonl", CACHE_LINES);
  assert.equal(loadCacheExtract(path, 88).code, "EXTRACT_EMPTY");
  assert.equal(loadCacheExtract(path, 123456).code, "EXTRACT_NOT_FOUND");
});

test("loadCacheExtract: tolerates the reversed (id, path) call shape", () => {
  const path = tmpFile("cache.jsonl", CACHE_LINES);
  const result = loadCacheExtract(42, path);
  assert.equal(result.ok, true);
  assert.equal(result.record.id, "gn-42");
});

// ---------------------------------------------------------------------------
// assemblePublishedFile + buildManifest (prompt §10 assembly)
// ---------------------------------------------------------------------------

function acceptedRecord() {
  const clue = (tier, tier_name, text) => ({
    tier,
    tier_name,
    text,
    narrowing: "…",
    source: { article: "Zorblaxia", url: "https://en.wikipedia.org/wiki/Zorblaxia", quote: "…" },
  });
  return {
    schema: "meridian.loop.clues.v1",
    status: "accepted",
    place_id: "gn-9999999",
    answer: {
      name: "Zorblaxia",
      aliases: ["Zorblaxian"],
      country: "Velmara",
      subdivision: "Sarn Coast",
      lat: 12.34,
      lon: -45.67,
      difficulty: 3,
    },
    clues: [
      clue(1, "geography", "geo text"),
      clue(2, "climate", "climate text"),
      clue(3, "history", "history text"),
      clue(4, "hook", "hook text"),
      clue(5, "giveaway", "giveaway text"),
    ],
  };
}

test("assemblePublishedFile strips identity and maps to the game shape", () => {
  const file = assemblePublishedFile(acceptedRecord());
  assert.deepEqual(Object.keys(file), ["v", "placeId", "target", "clues", "source"]);
  assert.equal(file.v, 1);
  assert.equal(file.placeId, "geonames:9999999");
  assert.deepEqual(file.target, { lon: -45.67, lat: 12.34 });
  assert.deepEqual(file.clues, ["geo text", "climate text", "history text", "hook text", "giveaway text"]);
  assert.deepEqual(file.source, { label: "Wikipedia", href: "https://en.wikipedia.org/wiki/Zorblaxia" });
  const serialized = JSON.stringify(file);
  assert.ok(!serialized.includes("Zorblaxia\")") || serialized.includes("wikipedia"));
  assert.ok(!serialized.includes("Sarn Coast"), "region tags must be stripped");
  assert.ok(!serialized.includes("aliases"), "aliases must be stripped");
});

test("assemblePublishedFile throws on non-accepted records and bad shapes", () => {
  const rejected = acceptedRecord();
  rejected.status = "rejected";
  assert.throws(() => assemblePublishedFile(rejected), TypeError);
  const short = acceptedRecord();
  short.clues = short.clues.slice(0, 4);
  assert.throws(() => assemblePublishedFile(short), TypeError);
  const badId = acceptedRecord();
  badId.place_id = "place-xyz";
  assert.throws(() => assemblePublishedFile(badId), TypeError);
});

test("buildManifest emits {v, size, generatedAt}", () => {
  const manifest = buildManifest(365, new Date("2026-10-04T00:00:00.000Z"));
  assert.deepEqual(manifest, { v: 1, size: 365, generatedAt: "2026-10-04T00:00:00.000Z" });
  assert.throws(() => buildManifest(-1), TypeError);
  assert.throws(() => buildManifest(3.5), TypeError);
});
