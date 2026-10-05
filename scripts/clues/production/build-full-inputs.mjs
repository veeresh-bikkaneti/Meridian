// build-full-inputs.mjs — build the Option A §9 inputs: the pool
// inputs with each extract's text replaced by the FULL lead fetched
// by fetch-full-extracts.mjs.
//
// Run: node scripts/clues/production/build-full-inputs.mjs
//   [--pool <pool.jsonl>] [--full <.scratch full-extracts.jsonl>]
//   [--out <.scratch full-inputs.jsonl>]
//
// Output: one §9 input per line (same shape as pool.jsonl), in pool
// fame order, for every pool place whose full fetch status is "ok".
// The article and URL are carried over unchanged from the pool input
// (the fetch used exactly that recorded title); only the text span
// grows. Places without an ok full extract are absent — generation
// for them is impossible under extract-as-only-source and they are
// dispositioned in the validation report from the fetch tallies.
//
// The output lives in .scratch (gitignored): it is derived from the
// committed pool + the scratch fetch cache and can be rebuilt at any
// time by re-running the fetcher + this script.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const DEFAULT_POOL = join(HERE, "pool.jsonl");
const DEFAULT_FULL = join(ROOT, ".scratch", "geodetective", "full-extracts.jsonl");
const DEFAULT_OUT = join(ROOT, ".scratch", "geodetective", "full-inputs.jsonl");

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

/** Latest terminal full-extract record per place (error = not done). */
export function loadFullExtracts(path) {
  const done = new Map();
  for (const rec of readJsonLines(path)) {
    if (rec.status === "ok" || rec.status === "empty" || rec.status === "missing") {
      done.set(rec.place_id, rec);
    } else {
      done.delete(rec.place_id);
    }
  }
  return done;
}

/** Pure merge: pool inputs + full extracts -> full §9 inputs. */
export function buildFullInputs(poolInputs, fullByPlace) {
  const out = [];
  for (const input of poolInputs) {
    const rec = fullByPlace.get(input.place.place_id);
    if (!rec || rec.status !== "ok" || !rec.text) continue;
    const base = Array.isArray(input.extracts) ? input.extracts[0] : {};
    out.push({
      place: input.place,
      curated_aliases: input.curated_aliases ?? [],
      extracts: [{ article: base.article, url: base.url, text: rec.text }],
    });
  }
  return out;
}

function main(argv) {
  const poolPath = argValue(argv, "--pool") ?? DEFAULT_POOL;
  const fullPath = argValue(argv, "--full") ?? DEFAULT_FULL;
  const outPath = argValue(argv, "--out") ?? DEFAULT_OUT;
  const pool = readJsonLines(poolPath);
  const fullByPlace = loadFullExtracts(fullPath);
  const inputs = buildFullInputs(pool, fullByPlace);
  writeFileSync(outPath, inputs.map((i) => JSON.stringify(i)).join("\n") + (inputs.length ? "\n" : ""));
  const tally = {};
  for (const rec of fullByPlace.values()) tally[rec.status] = (tally[rec.status] ?? 0) + 1;
  console.log(
    `full inputs: ${inputs.length} (pool ${pool.length}; fetch terminal records ${JSON.stringify(tally)}) -> ${outPath}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
