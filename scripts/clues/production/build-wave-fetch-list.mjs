// build-wave-fetch-list.mjs — write the fetch list (scope-sample
// shape) for one tier-2 wave: the fame-ordered population slice the
// wave will attempt, minus places already folded by earlier waves.
// The climate-section fetcher consumes {sample: [{place_id, article,
// url}]} and skips places already done in its append-only cache, so
// re-running after a partial fetch is safe.
//
// Run: node scripts/clues/production/build-wave-fetch-list.mjs
//        --wave <n> [--size 200] [--out <.scratch file>]

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { wavePopulation } from "./build-tier2-jobs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const SCRATCH = join(ROOT, ".scratch", "geodetective");

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}
function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function main(argv = []) {
  const wave = Number(argValue(argv, "--wave"));
  if (!Number.isInteger(wave) || wave < 1) throw new Error("--wave <n> required");
  const size = Number(argValue(argv, "--size") ?? 200);
  const outPath = argValue(argv, "--out") ?? join(SCRATCH, `tier2-fetch-wave${wave}.json`);

  const rankOf = new Map(readJsonLines(join(HERE, "pool.jsonl")).map((input, idx) => [input.place.place_id, idx + 1]));
  const fullRecords = readJsonLines(join(HERE, "records-full.jsonl"));
  const sampledIds = new Set(JSON.parse(readFileSync(join(HERE, "scope-sample.json"), "utf8")).sample.map((s) => s.place_id));
  const doneIds = new Set();
  for (const f of readdirSync(HERE).filter((f) => /^records-tier2-wave\d+\.jsonl$/.test(f))) {
    for (const rec of readJsonLines(join(HERE, f))) doneIds.add(rec.place_id);
  }
  const population = wavePopulation({ fullRecords, sampledIds, doneIds, rankOf });
  const slice = population.slice(0, size);
  const leadById = new Map(readJsonLines(join(SCRATCH, "full-inputs.jsonl")).map((i) => [i.place.place_id, i]));
  const sample = slice.map((placeId) => {
    const lead = leadById.get(placeId);
    if (!lead) throw new Error(`no full-lead input for ${placeId}`);
    const ex = lead.extracts[0];
    return { place_id: placeId, rank: rankOf.get(placeId), article: ex.article, url: ex.url };
  });
  writeFileSync(outPath, JSON.stringify({ purpose: `tier-2 wave ${wave} section fetch list`, sample }, null, 2) + "\n");
  console.log(JSON.stringify({ wave, listed: sample.length, outPath }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
