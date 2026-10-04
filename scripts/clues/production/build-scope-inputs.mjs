// build-scope-inputs.mjs — build the tier-2 source-expansion sample
// inputs + worker jobs.
//
// Run: node scripts/clues/production/build-scope-inputs.mjs
//        [--sample <scope-sample.json>] [--inputs <full-inputs.jsonl>]
//        [--sections <.scratch climate-sections.jsonl>]
//        [--records <records-full.jsonl>]
//        [--out-inputs <.scratch scope-inputs.jsonl>]
//        [--jobs-dir <tranches/scope-jobs>] [--per-job <n>]
//
// Each sampled place's §9 input becomes the union input:
//   extracts[0] = the fuller lead (unchanged from full-inputs.jsonl)
//   extracts[1] = the fetched section, when the fetch status is "ok":
//     article = "<Article> (Climate section)" / "(Geography section)"
//     url     = "<article url>#<Heading anchor>"
//     text    = the section plaintext
// The distinct article label matters mechanically: the production
// validator traces each clue's verbatim quote against the extract
// whose article the clue cites, so tier-2 clues quote the section by
// citing the section extract, and every other tier keeps citing the
// lead exactly as in the Option A run.
//
// Outputs: scope-inputs.jsonl (in .scratch — derived, rebuildable)
// and committed worker job files in the established tranche format
// ({rank, band, place_id, input, evidence, banned_terms}).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLeakTerms } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const DEFAULT_SAMPLE = join(HERE, "scope-sample.json");
const DEFAULT_INPUTS = join(ROOT, ".scratch", "geodetective", "full-inputs.jsonl");
const DEFAULT_SECTIONS = join(ROOT, ".scratch", "geodetective", "climate-sections.jsonl");
const DEFAULT_RECORDS = join(HERE, "records-full.jsonl");
const DEFAULT_OUT_INPUTS = join(ROOT, ".scratch", "geodetective", "scope-inputs.jsonl");
const DEFAULT_JOBS_DIR = join(HERE, "tranches", "scope-jobs");
export const PER_JOB = 20;

/** Latest terminal section record per place (error = not done). */
export function loadSections(path) {
  const done = new Map();
  if (!existsSync(path)) return done;
  for (const line of readFileSync(path, "utf8").split("\n").filter((l) => l.trim())) {
    const rec = JSON.parse(line);
    if (rec.status === "ok" || rec.status === "no-section" || rec.status === "missing") done.set(rec.place_id, rec);
    else done.delete(rec.place_id);
  }
  return done;
}

export function sectionAnchor(heading) {
  return String(heading ?? "").replace(/ /g, "_");
}

export function sectionLabel(article, source) {
  return `${article} (${source === "climate" ? "Climate" : "Geography"} section)`;
}

/** Pure: lead input + section record -> union §9 input + evidence. */
export function buildScopeInput(leadInput, sectionRec) {
  const lead = Array.isArray(leadInput.extracts) ? leadInput.extracts[0] : {};
  const extracts = [{ article: lead.article, url: lead.url, text: lead.text }];
  const evidence = {
    sectionStatus: sectionRec?.status ?? "absent",
    sectionSource: null,
    sectionHeading: null,
    sectionWords: 0,
    leadWords: typeof lead.text === "string" ? lead.text.split(/\s+/).filter(Boolean).length : 0,
  };
  if (sectionRec?.status === "ok" && sectionRec.text) {
    extracts.push({
      article: sectionLabel(lead.article, sectionRec.source),
      url: `${lead.url}#${sectionAnchor(sectionRec.heading)}`,
      text: sectionRec.text,
    });
    evidence.sectionSource = sectionRec.source;
    evidence.sectionHeading = sectionRec.heading;
    evidence.sectionWords = sectionRec.words ?? 0;
  }
  return {
    input: { place: leadInput.place, curated_aliases: leadInput.curated_aliases ?? [], extracts },
    evidence,
  };
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function main(argv = []) {
  const samplePath = argValue(argv, "--sample") ?? DEFAULT_SAMPLE;
  const inputsPath = argValue(argv, "--inputs") ?? DEFAULT_INPUTS;
  const sectionsPath = argValue(argv, "--sections") ?? DEFAULT_SECTIONS;
  const recordsPath = argValue(argv, "--records") ?? DEFAULT_RECORDS;
  const outInputsPath = argValue(argv, "--out-inputs") ?? DEFAULT_OUT_INPUTS;
  const jobsDir = argValue(argv, "--jobs-dir") ?? DEFAULT_JOBS_DIR;
  const perJob = Number(argValue(argv, "--per-job") ?? PER_JOB);

  const sampleDoc = JSON.parse(readFileSync(samplePath, "utf8"));
  const leadById = new Map(readJsonLines(inputsPath).map((i) => [i.place.place_id, i]));
  const sectionsById = loadSections(sectionsPath);
  const priorById = new Map(readJsonLines(recordsPath).map((r) => [r.place_id, r]));

  const inputs = [];
  const jobs = [];
  let withSection = 0;
  for (const entry of sampleDoc.sample) {
    const leadInput = leadById.get(entry.place_id);
    if (!leadInput) throw new Error(`no full-lead input for sampled place ${entry.place_id}`);
    const { input, evidence } = buildScopeInput(leadInput, sectionsById.get(entry.place_id));
    if (evidence.sectionSource) withSection += 1;
    inputs.push(input);
    const prior = priorById.get(entry.place_id);
    jobs.push({
      rank: entry.rank,
      band: entry.band,
      place_id: entry.place_id,
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

  writeFileSync(outInputsPath, inputs.map((i) => JSON.stringify(i)).join("\n") + "\n");
  mkdirSync(jobsDir, { recursive: true });
  const jobFiles = [];
  for (let i = 0; i < jobs.length; i += perJob) {
    const file = join(jobsDir, `scope-job${i / perJob + 1}.json`);
    writeFileSync(file, JSON.stringify(jobs.slice(i, i + perJob), null, 2) + "\n");
    jobFiles.push(file);
  }
  console.log(
    `scope inputs: ${inputs.length} places (${withSection} with a section extract) -> ${outInputsPath}; ${jobFiles.length} job files -> ${jobsDir}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
