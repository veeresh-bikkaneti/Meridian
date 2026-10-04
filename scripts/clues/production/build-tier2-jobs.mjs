// build-tier2-jobs.mjs — build one fame-ordered generation wave for
// the tier-2 source-expansion run (Liz-approved full-scale shape).
//
// Run: node scripts/clues/production/build-tier2-jobs.mjs --wave <n>
//        [--size 200] [--per-job 20]
//        [--records records-full.jsonl] [--sample scope-sample.json]
//        [--pool pool.jsonl]
//        [--inputs <.scratch full-inputs.jsonl>]
//        [--sections <.scratch climate-sections.jsonl>]
//        [--out-inputs <.scratch tier2-inputs-wave<n>.jsonl>]
//        [--jobs-dir tranches/tier2-jobs]
//
// Population (directive): the 7,997 worker climate-rejections in
// records-full.jsonl, EXCLUDING the 200 scoping-sample places
// (scope-sample.json) — 7,797 places, in pool fame order. The one
// validator-converted climate rejection (Cockermouth gn-2652676,
// whose reason carries validator codes rather than a worker climate
// judgment) is not a worker rejection and is excluded by the same
// rule the scoping draw used. Places already folded by earlier
// tier-2 waves (records-tier2-wave*.jsonl in this directory) are
// skipped, so waves are consecutive fame-ordered slices.
//
// Each place's §9 input is the union input (buildScopeInput): fuller
// lead + the fetched Climate/Geography section as extracts[1] when
// the section fetch produced one. Job files mirror the scope job
// shape: {rank, place_id, input, evidence, banned_terms}.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLeakTerms } from "../validate-clues.mjs";
import { buildScopeInput, loadSections } from "./build-scope-inputs.mjs";

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

/** Worker climate rejections: tier-2 rejection WITHOUT validator codes. */
export function isWorkerClimateRejection(rec) {
  return (
    rec.status === "rejected" &&
    rec.rejection?.tier_name === "climate" &&
    !/^[A-Z_]+:/.test(String(rec.rejection?.reason ?? ""))
  );
}

export function wavePopulation({ fullRecords, sampledIds, doneIds, rankOf }) {
  return fullRecords
    .filter(isWorkerClimateRejection)
    .map((r) => r.place_id)
    .filter((id) => !sampledIds.has(id) && !doneIds.has(id))
    .sort((a, b) => (rankOf.get(a) ?? 0) - (rankOf.get(b) ?? 0));
}

function main(argv = []) {
  const wave = Number(argValue(argv, "--wave"));
  if (!Number.isInteger(wave) || wave < 1) throw new Error("--wave <n> required");
  const size = Number(argValue(argv, "--size") ?? 200);
  const perJob = Number(argValue(argv, "--per-job") ?? 20);
  const recordsPath = join(HERE, argValue(argv, "--records") ?? "records-full.jsonl");
  const samplePath = join(HERE, argValue(argv, "--sample") ?? "scope-sample.json");
  const poolPath = join(HERE, argValue(argv, "--pool") ?? "pool.jsonl");
  const inputsPath = argValue(argv, "--inputs") ?? join(SCRATCH, "full-inputs.jsonl");
  const sectionsPath = argValue(argv, "--sections") ?? join(SCRATCH, "climate-sections.jsonl");
  const outInputsPath = argValue(argv, "--out-inputs") ?? join(SCRATCH, `tier2-inputs-wave${wave}.jsonl`);
  const jobsDir = join(HERE, argValue(argv, "--jobs-dir") ?? join("tranches", "tier2-jobs"));

  const rankOf = new Map(readJsonLines(poolPath).map((input, idx) => [input.place.place_id, idx + 1]));
  const fullRecords = readJsonLines(recordsPath);
  const sampledIds = new Set(JSON.parse(readFileSync(samplePath, "utf8")).sample.map((s) => s.place_id));
  const doneIds = new Set();
  for (const f of readdirSync(HERE).filter((f) => /^records-tier2-wave\d+\.jsonl$/.test(f))) {
    for (const rec of readJsonLines(join(HERE, f))) doneIds.add(rec.place_id);
  }
  const population = wavePopulation({ fullRecords, sampledIds, doneIds, rankOf });
  const slice = population.slice(0, size);

  const leadById = new Map(readJsonLines(inputsPath).map((i) => [i.place.place_id, i]));
  const sectionsById = loadSections(sectionsPath);
  const priorById = new Map(fullRecords.map((r) => [r.place_id, r]));

  const inputs = [];
  const jobs = [];
  let withSection = 0;
  for (const placeId of slice) {
    const leadInput = leadById.get(placeId);
    if (!leadInput) throw new Error(`no full-lead input for ${placeId}`);
    const { input, evidence } = buildScopeInput(leadInput, sectionsById.get(placeId));
    if (evidence.sectionSource) withSection += 1;
    inputs.push(input);
    const prior = priorById.get(placeId);
    jobs.push({
      rank: rankOf.get(placeId),
      place_id: placeId,
      input,
      evidence: {
        ...evidence,
        priorRejectionTier: prior?.rejection?.tier_name ?? null,
        priorReason: prior?.rejection?.reason ?? null,
        priorMissing: prior?.rejection?.missing ?? null,
      },
      banned_terms: buildLeakTerms({ name: input.place.name, aliases: [] }, input.curated_aliases),
    });
  }

  writeFileSync(outInputsPath, inputs.map((i) => JSON.stringify(i)).join("\n") + (inputs.length ? "\n" : ""));
  mkdirSync(jobsDir, { recursive: true });
  const jobFiles = [];
  for (let i = 0; i < jobs.length; i += perJob) {
    const file = join(jobsDir, `wave${wave}-job${i / perJob + 1}.json`);
    writeFileSync(file, JSON.stringify(jobs.slice(i, i + perJob), null, 2) + "\n");
    jobFiles.push(file);
  }
  console.log(
    JSON.stringify(
      {
        wave,
        populationRemaining: population.length,
        slice: slice.length,
        withSection,
        firstRank: jobs[0]?.rank,
        lastRank: jobs[jobs.length - 1]?.rank,
        jobFiles: jobFiles.length,
        outInputsPath,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
