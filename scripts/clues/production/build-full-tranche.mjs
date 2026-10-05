// build-full-tranche.mjs — slice the Option A attempt sequence into
// worker job files, in the same job format as build-tranche.mjs.
//
// Run: node scripts/clues/production/build-full-tranche.mjs
//        --start <n> --count <n> --out <file.json>
//        [--inputs <.scratch full-inputs.jsonl>]
//
// The Option A attempt sequence is the full-inputs order (pool fame
// order restricted to places with a fetched full lead; the fetcher
// already skipped the 63 Phase 2 accepted places). --start/--count
// index into that sequence (1-based). Each job entry:
// { rank (pool fame rank), attempt (position in the Option A
//   sequence), place_id, input (the §9 object with the FULL lead
//   text), evidence {datasetDifficulty, hasHook, extractWords (the
//   old 6-sentence excerpt), fullExtractWords}, banned_terms } —
// banned terms are the validator's leak terms for the place name
// (buildLeakTerms), precomputed so workers can write around them.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLeakTerms } from "../validate-clues.mjs";
import { loadFullExtracts } from "./build-full-inputs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const DEFAULT_INPUTS = join(ROOT, ".scratch", "geodetective", "full-inputs.jsonl");
const DEFAULT_FULL = join(ROOT, ".scratch", "geodetective", "full-extracts.jsonl");

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function main(argv) {
  const start = Number(argValue(argv, "--start"));
  const count = Number(argValue(argv, "--count"));
  const out = argValue(argv, "--out");
  const inputsPath = argValue(argv, "--inputs") ?? DEFAULT_INPUTS;
  const fullPath = argValue(argv, "--full") ?? DEFAULT_FULL;
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(count) || count < 1 || !out) {
    console.error("usage: node build-full-tranche.mjs --start <n> --count <n> --out <file.json> [--inputs <file>] [--full <file>]");
    process.exitCode = 1;
    return;
  }
  const inputs = readJsonLines(inputsPath);
  const poolRank = new Map(
    readJsonLines(join(HERE, "pool.jsonl")).map((input, idx) => [input.place.place_id, idx + 1]),
  );
  const evidence = new Map(readJsonLines(join(HERE, "pool-evidence.jsonl")).map((e) => [e.place_id, e]));
  const fullByPlace = loadFullExtracts(fullPath);

  const slice = inputs.slice(start - 1, start - 1 + count);
  const jobs = slice.map((input, k) => {
    const ev = evidence.get(input.place.place_id);
    const full = fullByPlace.get(input.place.place_id);
    return {
      rank: poolRank.get(input.place.place_id) ?? null,
      attempt: start + k,
      place_id: input.place.place_id,
      input,
      evidence: {
        datasetDifficulty: ev?.datasetDifficulty ?? null,
        hasHook: ev?.hasHook ?? null,
        extractWords: ev?.extractWords ?? null,
        fullExtractWords: full?.words ?? null,
      },
      banned_terms: buildLeakTerms({ name: input.place.name, aliases: [] }, input.curated_aliases),
    };
  });
  writeFileSync(out, JSON.stringify(jobs, null, 2) + "\n");
  console.log(
    `wrote ${jobs.length} jobs (attempt positions ${start}-${start + jobs.length - 1} of ${inputs.length} full inputs) to ${out}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
