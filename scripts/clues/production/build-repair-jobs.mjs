// Wave repair-job builder (tier-2 run): for each validator-rejected record
// in a folded wave records file, emit a repair job carrying the ORIGINAL
// worker record, the validator's reasons for that place, and the input.
// Deterministic; no network.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toRejectionRecord } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROD = HERE;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const wave = arg("wave", "1");
const outDir = join(PROD, "tranches", "tier2-out", `wave${wave}`);
const recordsPath = join(PROD, `records-tier2-wave${wave}.jsonl`);
const inputsPath = arg("inputs", null);
if (!inputsPath) throw new Error("--inputs <wave inputs jsonl> required");

const inputs = new Map();
for (const line of readFileSync(inputsPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const o = JSON.parse(line);
  inputs.set(o.place_id ?? o.placeId ?? o.input?.place_id, o);
}
// Inputs file shape from build-tier2-jobs: lines are {place_id, input}? check both.
function inputOf(lineObj) {
  return lineObj.input ?? lineObj;
}
const inputByPlace = new Map();
for (const line of readFileSync(inputsPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const o = JSON.parse(line);
  const inp = inputOf(o);
  const pid = o.place_id ?? inp.place?.place_id ?? inp.place_id;
  inputByPlace.set(pid, inp);
}

// Original worker records from the wave out files.
const workerByPlace = new Map();
import { readdirSync } from "node:fs";
for (const f of readdirSync(outDir).filter((x) => x.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(outDir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    workerByPlace.set(r.place_id, r);
  }
}

// Validator-rejected: worker said accepted, folded record is a rejection
// produced by toRejectionRecord (nested reasons). Recover reasons by
// re-running the conversion is not possible from the folded record alone
// (it stores a summary), so re-validate here directly.
const { validateRecord } = await import("../validate-clues.mjs");
const jobs = [];
const folded = readFileSync(recordsPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
for (const rec of folded) {
  const worker = workerByPlace.get(rec.place_id);
  if (!worker || worker.status !== "accepted") continue;
  if (rec.status === "accepted") continue;
  const input = inputByPlace.get(rec.place_id);
  if (!input) throw new Error(`no input for ${rec.place_id}`);
  const result = validateRecord(worker, { input });
  if (result.ok) throw new Error(`folded rejection but revalidation passes for ${rec.place_id}`);
  jobs.push({
    place_id: rec.place_id,
    name: input.place?.name ?? worker.answer?.name,
    reasons: result.reasons,
    record: worker,
    input,
  });
}
const outPath = join(PROD, "tranches", "tier2-repairs", `wave${wave}-repair-jobs.json`);
writeFileSync(outPath, JSON.stringify(jobs, null, 1) + "\n");
const codeCount = {};
for (const j of jobs) for (const r of j.reasons) codeCount[r.code] = (codeCount[r.code] ?? 0) + 1;
console.log(JSON.stringify({ repairJobs: jobs.length, codeCount, outPath }, null, 1));
