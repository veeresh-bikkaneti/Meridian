// build-tranche.mjs — slice the pool into worker job files.
//
// Run: node scripts/clues/production/build-tranche.mjs --start <rank> --count <n> --out <file.json>
//
// Each job entry: { rank, place_id, input (the exact §9 object from
// pool.jsonl), evidence {datasetDifficulty, hasHook, extractWords},
// banned_terms [{term, tokenOnly}] } — the banned terms are the
// validator's leak terms for the place name + curated aliases
// (buildLeakTerms), precomputed so workers can write around them.
// Aliases a worker records from the extract join the leak universe at
// validation time as well.
//
// --source <file.jsonl> slices any ordered file of §9 inputs instead
// of pool.jsonl (used with attempt-queue.jsonl); --start/--count then
// index into that file's order, and `rank` reports the pool fame rank.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLeakTerms } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function main(argv) {
  const start = Number(argValue(argv, "--start"));
  const count = Number(argValue(argv, "--count"));
  const out = argValue(argv, "--out");
  const source = argValue(argv, "--source");
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(count) || count < 1 || !out) {
    console.error("usage: node build-tranche.mjs --start <rank> --count <n> --out <file.json> [--source <inputs.jsonl>]");
    process.exitCode = 1;
    return;
  }
  const sourcePath = source ? join(HERE, source) : join(HERE, "pool.jsonl");
  const pool = readFileSync(sourcePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const poolRank = new Map(
    readFileSync(join(HERE, "pool.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line, idx) => [JSON.parse(line).place.place_id, idx + 1]),
  );
  const evidence = new Map(
    readFileSync(join(HERE, "pool-evidence.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const e = JSON.parse(line);
        return [e.place_id, e];
      }),
  );
  const slice = pool.slice(start - 1, start - 1 + count);
  const jobs = slice.map((input) => {
    const ev = evidence.get(input.place.place_id);
    return {
      rank: poolRank.get(input.place.place_id) ?? null,
      place_id: input.place.place_id,
      input,
      evidence: {
        datasetDifficulty: ev?.datasetDifficulty ?? null,
        hasHook: ev?.hasHook ?? null,
        extractWords: ev?.extractWords ?? null,
      },
      banned_terms: buildLeakTerms({ name: input.place.name, aliases: [] }, input.curated_aliases),
    };
  });
  writeFileSync(out, JSON.stringify(jobs, null, 2) + "\n");
  console.log(`wrote ${jobs.length} jobs (positions ${start}-${start + jobs.length - 1} of ${source ?? "pool.jsonl"}) to ${out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
