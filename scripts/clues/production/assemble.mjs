// assemble.mjs — assemble the published GeoDetective files from the
// validated audit records, and prove the published files leak nothing.
//
// Run: node scripts/clues/production/assemble.mjs [--records <file>]
//
// Reads:  records.jsonl (audit trail; --records overrides, e.g. the
//         Option A union records-final.jsonl), pool.jsonl (rank
//         order + curated aliases for the leak scan)
// Writes: public/loop/clues/{index}.json for every accepted record, in
//         pool fame-rank order (index 0 = highest fame), and
//         public/loop/manifest.json {v:1, size, generatedAt};
//         assembly-report.json alongside the production scripts.
//
// Leak proof: every published clue text is folded and substring-scanned
// against the place's full leak-term list (name + answer aliases +
// curated aliases, validator buildLeakTerms). The published JSON is
// additionally scanned as a whole with the source href removed (the
// href legitimately carries the article title — the game contract's
// source link, exactly as in the seed files). Any hit aborts assembly
// with a non-zero exit and no manifest is written.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assemblePublishedFile, buildManifest } from "../compose-clues.mjs";
import { foldText } from "../schema.mjs";
import { buildLeakTerms, findLeaks } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LOOP_DIR = join(ROOT, "public/loop");
const CLUES_DIR = join(LOOP_DIR, "clues");

function readJsonLines(path) {
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function main(argv = []) {
  const recordsArg = argValue(argv, "--records");
  const recordsPath = recordsArg ? (isAbsolute(recordsArg) ? recordsArg : join(HERE, recordsArg)) : join(HERE, "records.jsonl");
  const reportArg = argValue(argv, "--report");
  const reportPath = reportArg ? (isAbsolute(reportArg) ? reportArg : join(HERE, reportArg)) : join(HERE, "assembly-report.json");
  const records = readJsonLines(recordsPath);
  const pool = readJsonLines(join(HERE, "pool.jsonl"));
  const rankOf = new Map(pool.map((input, idx) => [input.place.place_id, idx + 1]));
  const inputOf = new Map(pool.map((input) => [input.place.place_id, input]));

  const accepted = records
    .filter((r) => r.status === "accepted")
    .sort((a, b) => rankOf.get(a.place_id) - rankOf.get(b.place_id));

  // Leak scan first — nothing is written unless every file is clean.
  const hits = [];
  let clueTextsScanned = 0;
  const files = accepted.map((record) => {
    const file = assemblePublishedFile(record);
    const input = inputOf.get(record.place_id);
    const terms = buildLeakTerms(record.answer, input?.curated_aliases ?? []);
    file.clues.forEach((text, idx) => {
      clueTextsScanned += 1;
      for (const hit of findLeaks(text, terms)) {
        hits.push({ place_id: record.place_id, clue: idx + 1, term: hit.term, via: hit.via });
      }
    });
    // Whole-file scan with the href removed: no name/alias string may
    // survive anywhere else in the published JSON.
    const scrubbed = { ...file, source: { label: file.source.label, href: "" } };
    const foldedJson = foldText(JSON.stringify(scrubbed));
    for (const { term, tokenOnly } of terms) {
      if (!tokenOnly && foldedJson.includes(term)) {
        hits.push({ place_id: record.place_id, clue: null, term, via: "whole-file" });
      }
    }
    return file;
  });

  if (hits.length > 0) {
    console.error(`LEAK SCAN FAILED: ${hits.length} hit(s)`);
    console.error(JSON.stringify(hits.slice(0, 20), null, 2));
    process.exitCode = 1;
    return;
  }

  rmSync(CLUES_DIR, { recursive: true, force: true });
  mkdirSync(CLUES_DIR, { recursive: true });
  files.forEach((file, idx) => {
    writeFileSync(join(CLUES_DIR, `${idx}.json`), JSON.stringify(file) + "\n");
  });
  const manifest = buildManifest(files.length);
  writeFileSync(join(LOOP_DIR, "manifest.json"), JSON.stringify(manifest) + "\n");

  const difficultyDistribution = {};
  for (const record of accepted) {
    const d = record.answer.difficulty;
    difficultyDistribution[d] = (difficultyDistribution[d] ?? 0) + 1;
  }
  const report = {
    published: files.length,
    indexOrder: "pool fame rank (index 0 = highest fame)",
    manifest,
    difficultyDistribution,
    leakScan: {
      filesScanned: files.length,
      clueTextsScanned,
      hits: 0,
      method:
        "folded substring scan of every published clue text against the place's leak terms (name + aliases + curated aliases), plus a whole-file scan with the source href scrubbed",
    },
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
