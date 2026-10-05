// Apply semi-mechanical quote repair to a wave's out files, in place:
// for every accepted record that fails validation ONLY on quote
// traceability (or also, when the cited label is unknown), replace each
// untraceable quote with the best verbatim span of the cited extract.
// Records are re-validated after the pass; a per-record before/after
// summary is printed. Clue text is never modified here.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRecord } from "../validate-clues.mjs";
import { bestVerbatimSpan, collapse } from "./quote-repair-lib.mjs";

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

let swapped = 0;
let recordsFixed = 0;
let recordsStillFailing = 0;
const stillFailing = [];
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
    const byLabel = new Map(input.extracts.map((e) => [e.article, e]));
    for (const clue of r.clues ?? []) {
      const cited = byLabel.get(clue.source.article);
      if (!cited) continue;
      if (collapse(cited.text).includes(collapse(clue.source.quote))) continue;
      const best = bestVerbatimSpan(clue.source.quote, cited.text);
      if (best) {
        clue.source.quote = best.span;
        swapped += 1;
        changed = true;
      }
    }
    const after = validateRecord(r, { input });
    if (after.ok) recordsFixed += 1;
    else {
      recordsStillFailing += 1;
      stillFailing.push({ place_id: r.place_id, codes: after.reasons.map((x) => `${x.code}@${x.tier ?? "-"}`) });
    }
    return r;
  });
  if (changed) writeFileSync(path, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
}
console.log(JSON.stringify({ quotesSwapped: swapped, recordsFixed, recordsStillFailing, stillFailing }, null, 1));
