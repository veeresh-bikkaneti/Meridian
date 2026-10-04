// build-pool.mjs — deterministic candidate-pool derivation for the
// GeoDetective Phase 2 production pass.
//
// Run: node scripts/clues/production/build-pool.mjs
// (cache path overridable via GEODETECTIVE_CRAWL_CACHE)
//
// Derivation (exact, reproducible):
//   1. Universe: every place in the live dataset
//      (src/game/data/geonames/chunks/*.json on origin/main).
//   2. Join the crawl cache (latest JSONL line per id wins). Keep only
//      places whose latest cache record is status "matched" with a
//      non-empty extract — generation inputs come from the cache
//      (prompt §5: extract-as-only-source); the ~378 places the crawl
//      excluded (94 curated notables + 285 pre-existing-history) have
//      no cache extract and cannot be generated honestly, so they are
//      out of the pool (documented gap, see pool-derivation.md).
//   3. Substance floor: extract word count >= 100. (The cache extracts
//      are hook-pipeline lead excerpts — median 47 words, max 280 — so
//      most matched places cannot source five tiers and would only
//      produce §6 rejections; the floor keeps the working pool honest.)
//   4. Fame ranking: dataset difficulty ascending (1 = most famous:
//      100k+ population or national capital, per the tier design),
//      then places carrying a merged Wikipedia history hook first,
//      then longer extracts first, then place id ascending (total
//      order — no ties survive).
//   5. Working pool = every candidate above the floor, in fame-rank
//      order (POOL_LIMIT is a safety cap above the candidate count).
//      Generation ATTEMPT order is a separate, documented sequencing
//      (build-attempt-queue.mjs); assembly order is always this
//      fame rank.
//
// Outputs (committed):
//   pool.jsonl           one §9 input object per line, rank order
//   pool-evidence.jsonl  {place_id, rank, datasetDifficulty, hasHook,
//                         extractWords} per line, same order
//   pool-derivation.md   the funnel counts + this algorithm, generated
//
// curated_aliases is [] for every pool place: no sourced alias list
// exists in the repo data (notable-notes.json carries notes, not
// aliases). Per prompt §8, aliases enter a set only when attested in
// the extract text itself, which the validator enforces.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CHUNKS_DIR = join(ROOT, "src/game/data/geonames/chunks");
const CACHE_PATH =
  process.env.GEODETECTIVE_CRAWL_CACHE ??
  join(homedir(), "workspace/meridian-worktrees/wikipedia-crawl/.scratch/wikipedia-enrichment/crawl-cache.jsonl");
const OUT_DIR = HERE;

export const MIN_EXTRACT_WORDS = 100;
export const POOL_LIMIT = 11000; // safety cap; actual candidate count is lower

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(iso2) {
  try {
    return COUNTRY_NAMES.of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function loadDataset() {
  const places = new Map();
  for (const file of readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const chunk = JSON.parse(readFileSync(join(CHUNKS_DIR, file), "utf8"));
    for (const place of chunk.places) places.set(place.id, place);
  }
  return places;
}

function loadCache() {
  const cache = new Map();
  for (const line of readFileSync(CACHE_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (record && record.id) cache.set(record.id, record); // latest wins
  }
  return cache;
}

export function derivePool({ places, cache, minWords = MIN_EXTRACT_WORDS, limit = POOL_LIMIT }) {
  const funnel = {
    datasetPlaces: places.size,
    cacheRecords: cache.size,
    cacheMatchedWithExtract: 0,
    joinedDatasetAndCache: 0,
    aboveSubstanceFloor: 0,
    poolSize: 0,
    byDifficulty: {},
  };
  const candidates = [];
  for (const record of cache.values()) {
    if (record.status !== "matched" || typeof record.extract !== "string" || !record.extract.trim()) continue;
    funnel.cacheMatchedWithExtract += 1;
    const place = places.get(record.id);
    if (!place) continue;
    funnel.joinedDatasetAndCache += 1;
    const words = wordCount(record.extract);
    if (words < minWords) continue;
    funnel.aboveSubstanceFloor += 1;
    candidates.push({ place, record, words });
  }
  candidates.sort((a, b) => {
    const da = a.place.difficulty ?? 9;
    const db = b.place.difficulty ?? 9;
    if (da !== db) return da - db;
    const ha = a.place.history ? 0 : 1;
    const hb = b.place.history ? 0 : 1;
    if (ha !== hb) return ha - hb;
    if (a.words !== b.words) return b.words - a.words;
    return a.place.id < b.place.id ? -1 : 1;
  });
  const pool = candidates.slice(0, limit);
  funnel.poolSize = pool.length;
  for (const { place } of pool) {
    const key = `difficulty${place.difficulty ?? "?"}`;
    funnel.byDifficulty[key] = (funnel.byDifficulty[key] ?? 0) + 1;
  }
  return { pool, funnel };
}

export function toInput({ place, record }) {
  const country = countryName(place.iso2);
  const url = `https://en.wikipedia.org/wiki/${(place.wiki ?? record.title ?? "").replace(/ /g, "_")}`;
  return {
    place: {
      place_id: place.id,
      name: place.name,
      country,
      subdivision: place.subdivision ?? country,
      lat: place.lat,
      lon: place.lon,
    },
    curated_aliases: [],
    extracts: [{ article: record.title ?? place.name, url, text: record.extract }],
  };
}

function main() {
  const places = loadDataset();
  const cache = loadCache();
  const { pool, funnel } = derivePool({ places, cache });

  const poolLines = [];
  const evidenceLines = [];
  pool.forEach((entry, idx) => {
    poolLines.push(JSON.stringify(toInput(entry)));
    evidenceLines.push(
      JSON.stringify({
        place_id: entry.place.id,
        rank: idx + 1,
        datasetDifficulty: entry.place.difficulty ?? null,
        hasHook: Boolean(entry.place.history),
        extractWords: entry.words,
      }),
    );
  });
  writeFileSync(join(OUT_DIR, "pool.jsonl"), poolLines.join("\n") + "\n");
  writeFileSync(join(OUT_DIR, "pool-evidence.jsonl"), evidenceLines.join("\n") + "\n");

  const byDiff = Object.entries(funnel.byDifficulty)
    .sort()
    .map(([k, v]) => `| ${k.replace("difficulty", "")} | ${v} |`)
    .join("\n");
  const md = `# Pool derivation — GeoDetective Phase 2 production pass

Generated by \`scripts/clues/production/build-pool.mjs\` (deterministic;
re-running on the same dataset + cache reproduces pool.jsonl exactly).

## Funnel

| Step | Count |
|---|---|
| Places in the live dataset (origin/main chunks) | ${funnel.datasetPlaces} |
| Records in the crawl cache (latest line per id) | ${funnel.cacheRecords} |
| Cache records matched with a non-empty extract | ${funnel.cacheMatchedWithExtract} |
| … joined to a dataset place | ${funnel.joinedDatasetAndCache} |
| … at or above the substance floor (${MIN_EXTRACT_WORDS} extract words) | ${funnel.aboveSubstanceFloor} |
| Working pool (all candidates above the floor, fame-ranked) | ${funnel.poolSize} |

## Fame ranking (total order, no ties)

1. Dataset difficulty ascending (1 = most famous: 100k+ population or
   national capital; 5 = smallest places).
2. Places carrying a merged Wikipedia history hook first.
3. Longer extract first (more sourceable material).
4. Place id ascending.

## Pool composition by dataset difficulty

| Dataset difficulty | Places in pool |
|---|---|
${byDiff}

## Known gaps

- The crawl excluded 378 places (94 curated notables + 285 places
  already carrying history), so several of the most famous places on
  Earth (e.g. Paris, Mumbai) have no cache extract and are NOT in this
  pool — they cannot be generated under extract-as-only-source until
  extracts are sourced for them. The pool still holds thousands of
  genuinely famous cache-covered places (national capitals included).
- The cache extracts are lead excerpts gathered for the one-sentence
  hook pipeline (median 47 words across all matched records; the pool
  floor of ${MIN_EXTRACT_WORDS} words selects the substantive tail).
  Many extracts state a climate classification only — or no climate
  material at all — so tier-2 (climate) rejections under prompt §6 are
  expected to be the dominant rejection class. That is the fail-closed
  rule working as locked, not a pipeline defect.
- curated_aliases is empty for every pool place: the repo holds no
  sourced alias list. Aliases enter a set only when attested in the
  extract text (validator-enforced, prompt §8).
`;
  writeFileSync(join(OUT_DIR, "pool-derivation.md"), md);
  console.log(JSON.stringify(funnel, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
