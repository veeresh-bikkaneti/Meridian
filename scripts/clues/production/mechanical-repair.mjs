// Mechanical repair pass (tier-2 run): fixes the DETERMINISTIC validator
// failures in worker records without touching clue content semantics:
//  - ANSWER_MISMATCH: answer fields are copied from the §9 input place
//    (the validator requires exact equality with the input record).
//  - SOURCE_ARTICLE_UNKNOWN on tier 2 only: when the cited article label
//    is not an input label but the quote IS traceable to the section
//    extract, re-cite the input's actual section label (the quote and
//    the extract it came from are unchanged; only the label string is
//    corrected to the one the input carries).
// Everything else is left for the LLM repair loop. Re-validates each
// record after the pass and reports the residual reason histogram.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRecord } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const wave = arg("wave", "1");
const inputsPath = arg("inputs", null);
if (!inputsPath) throw new Error("--inputs required");
const outDir = join(HERE, "tranches", "tier2-out", `wave${wave}`);

const inputByPlace = new Map();
for (const line of readFileSync(inputsPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const o = JSON.parse(line);
  inputByPlace.set(o.place.place_id, o);
}

function norm(s) {
  return (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

let filesTouched = 0;
let answersFixed = 0;
let labelsFixed = 0;
const residual = {};
for (const f of readdirSync(outDir).filter((x) => x.endsWith(".jsonl")).sort()) {
  const path = join(outDir, f);
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
  let changed = false;
  const out = lines.map((line) => {
    const r = JSON.parse(line);
    if (r.status !== "accepted") return r;
    const input = inputByPlace.get(r.place_id);
    if (!input) return r;
    const before = validateRecord(r, { input });
    if (before.ok) return r;
    const codes = new Set(before.reasons.map((x) => x.code));
    // 1) answer fields from input place
    if (codes.has("ANSWER_MISMATCH")) {
      const p = input.place;
      r.answer = { ...r.answer, name: p.name, country: p.country, subdivision: p.subdivision, lat: p.lat, lon: p.lon };
      answersFixed += 1;
      changed = true;
    }
    // 2) tier-2 article label correction when quote traceable to section
    if (codes.has("SOURCE_ARTICLE_UNKNOWN")) {
      const labels = new Set(input.extracts.map((e) => e.article));
      const section = input.extracts[1];
      for (const clue of r.clues ?? []) {
        if (clue.tier === 2 && !labels.has(clue.source.article) && section) {
          if (norm(section.text).includes(norm(clue.source.quote))) {
            clue.source.article = section.article;
            clue.source.url = section.url;
            labelsFixed += 1;
            changed = true;
          }
        }
      }
    }
    const after = validateRecord(r, { input });
    if (!after.ok) for (const x of after.reasons) residual[x.code] = (residual[x.code] ?? 0) + 1;
    return r;
  });
  if (changed) {
    writeFileSync(path, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
    filesTouched += 1;
  }
}
console.log(JSON.stringify({ filesTouched, answersFixed, labelsFixed, residualHistogram: residual }, null, 1));
