// fetch-full-extracts.test.mjs — tests for the Option A fuller-extract
// fetcher's pure helpers (request shaping, title resolution, record
// shaping, resume semantics, text cap).
//
// Run: node --test scripts/clues/fetch-full-extracts.test.mjs
//
// All fixtures are synthetic API payloads for fictional titles — no
// network access and no facts about any real place.

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TEXT_CHARS,
  buildParams,
  isDoneRecord,
  resolveFinalTitle,
  shapeRecords,
  wordCount,
} from "./fetch-full-extracts.mjs";

test("buildParams requests the full lead: exintro + explaintext, no sentence limit", () => {
  const params = buildParams(["Alpha", "Beta Town"]);
  assert.equal(params.get("action"), "query");
  assert.equal(params.get("prop"), "extracts");
  assert.equal(params.get("exintro"), "1");
  assert.equal(params.get("explaintext"), "1");
  assert.equal(params.get("exsentences"), null);
  assert.equal(params.get("redirects"), "1");
  assert.equal(params.get("titles"), "Alpha|Beta Town");
  assert.equal(params.get("formatversion"), "2");
});

test("resolveFinalTitle follows normalization then redirect chains", () => {
  const normalized = [{ from: "alpha town", to: "Alpha Town" }];
  const redirects = [
    { from: "Alpha Town", to: "Alpha Town, Zorblaxia" },
    { from: "Alpha Town, Zorblaxia", to: "Alpha (town)" },
  ];
  assert.equal(resolveFinalTitle("alpha town", normalized, redirects), "Alpha (town)");
  assert.equal(resolveFinalTitle("Unchanged", normalized, redirects), "Unchanged");
  // a redirect cycle terminates instead of looping forever
  const cyclic = [
    { from: "A", to: "B" },
    { from: "B", to: "A" },
  ];
  assert.ok(["A", "B"].includes(resolveFinalTitle("A", [], cyclic)));
});

test("shapeRecords: ok / empty / missing outcomes", () => {
  const requested = [
    { place_id: "gn-1", article: "Alpha", url: "https://en.wikipedia.org/wiki/Alpha" },
    { place_id: "gn-2", article: "Beta", url: "https://en.wikipedia.org/wiki/Beta" },
    { place_id: "gn-3", article: "Gamma", url: "https://en.wikipedia.org/wiki/Gamma" },
  ];
  const data = {
    query: {
      normalized: [],
      redirects: [],
      pages: [
        { title: "Alpha", extract: "  Alpha is a fictional town. It has a long lead.  " },
        { title: "Beta", extract: "   " },
        { title: "Gamma", missing: true },
      ],
    },
  };
  const [alpha, beta, gamma] = shapeRecords(requested, data, "2026-10-04T00:00:00.000Z");
  assert.equal(alpha.status, "ok");
  assert.equal(alpha.text, "Alpha is a fictional town. It has a long lead.");
  assert.equal(alpha.words, 10);
  assert.equal(alpha.chars, alpha.text.length);
  assert.equal(beta.status, "empty");
  assert.equal(beta.text, null);
  assert.equal(gamma.status, "missing");
  assert.equal(gamma.text, null);
});

test("shapeRecords maps redirected pages back to the requesting place", () => {
  const requested = [{ place_id: "gn-9", article: "Old Name", url: "https://en.wikipedia.org/wiki/Old_Name" }];
  const data = {
    query: {
      normalized: [],
      redirects: [{ from: "Old Name", to: "New Name" }],
      pages: [{ title: "New Name", extract: "New Name is a fictional place." }],
    },
  };
  const [rec] = shapeRecords(requested, data);
  assert.equal(rec.status, "ok");
  assert.equal(rec.article, "Old Name");
  assert.equal(rec.resolvedTitle, "New Name");
});

test("shapeRecords caps stored text at MAX_TEXT_CHARS and flags truncation", () => {
  const long = "word ".repeat(MAX_TEXT_CHARS); // well over the cap
  const requested = [{ place_id: "gn-5", article: "Long", url: "https://en.wikipedia.org/wiki/Long" }];
  const [rec] = shapeRecords(requested, { query: { pages: [{ title: "Long", extract: long }] } });
  assert.equal(rec.status, "ok");
  assert.equal(rec.text.length, MAX_TEXT_CHARS);
  assert.equal(rec.truncated, true);
});

test("isDoneRecord: ok/empty/missing are terminal, error is retried", () => {
  assert.equal(isDoneRecord({ status: "ok" }), true);
  assert.equal(isDoneRecord({ status: "empty" }), true);
  assert.equal(isDoneRecord({ status: "missing" }), true);
  assert.equal(isDoneRecord({ status: "error" }), false);
  assert.equal(isDoneRecord(null), false);
  assert.equal(isDoneRecord({}), false);
});

test("wordCount counts whitespace-separated tokens", () => {
  assert.equal(wordCount("one two  three\nfour"), 4);
  assert.equal(wordCount(""), 0);
});
