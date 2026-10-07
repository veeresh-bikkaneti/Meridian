// build-scope-sample.mjs — deterministic sample draw for the tier-2
// source-expansion scoping run (Liz, 2026-10-04).
//
// Run: node scripts/clues/production/build-scope-sample.mjs
//        [--records <records-full.jsonl>] [--pool <pool.jsonl>]
//        [--out <scope-sample.json>] [--per-band <n>] [--seed <n>]
//
// Population: every place in records-full.jsonl whose final record is
// a WORKER rejection at the climate tier (status "rejected",
// rejection.tier_name == "climate"). The single validator-converted
// climate rejection (Cockermouth gn-2652676, CLIMATE_NO_SIGNAL) is
// excluded by id — the scope question is about places a worker tried
// and failed at tier 2, not about a validator/worker disagreement.
//
// Draw: the population is sorted by pool fame rank (pool.jsonl line
// order) and split into BANDS contiguous quintile bands by rank.
// Within each band, PER_BAND places are drawn with a seeded PRNG
// (mulberry32, seed 20261004) — the same PRNG family as the tone
// sample (seed 20261003), a new seed for a new draw. Stratifying by
// fame band keeps the estimate from being fame-top-skewed: the
// climate-rejected population spans the whole attempted ranking.
//
// Outputs (committed): scope-sample.json — the draw recipe (seed,
// band edges, population count) + one entry per sampled place
// {place_id, rank, band, name, article, url} in rank order. The draw
// is exactly reproducible from records-full.jsonl + pool.jsonl.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const SCOPE_SEED = 20261004;
export const BANDS = 5;
export const PER_BAND = 40;
export const VALIDATOR_CLIMATE_IDS = new Set(["gn-2652676"]); // Cockermouth

/** mulberry32 — small seeded PRNG (same family as the tone sample). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Climate-rejected worker population, in pool fame-rank order. */
export function climateRejectedPopulation(records, poolRank) {
  return records
    .filter(
      (r) =>
        r.status === "rejected" &&
        r.rejection?.tier_name === "climate" &&
        !VALIDATOR_CLIMATE_IDS.has(r.place_id),
    )
    .map((r) => ({ place_id: r.place_id, rank: poolRank.get(r.place_id) ?? null }))
    .filter((e) => e.rank !== null)
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Stratified draw: split the rank-ordered population into `bands`
 * contiguous bands as equal in size as possible (earlier bands take
 * the remainder), then draw `perBand` per band with the seeded PRNG
 * (partial Fisher-Yates on band indices). Returns entries in rank
 * order plus the band edges used.
 */
export function drawSample(population, { bands = BANDS, perBand = PER_BAND, seed = SCOPE_SEED } = {}) {
  const rand = mulberry32(seed);
  const n = population.length;
  const base = Math.floor(n / bands);
  const remainder = n % bands;
  const edges = [];
  let start = 0;
  for (let b = 0; b < bands; b += 1) {
    const size = base + (b < remainder ? 1 : 0);
    edges.push({ band: b + 1, fromRank: population[start]?.rank ?? null, size, start });
    start += size;
  }
  const picked = [];
  for (const edge of edges) {
    const members = population.slice(edge.start, edge.start + edge.size);
    const idx = members.map((_, i) => i);
    const take = Math.min(perBand, members.length);
    for (let i = 0; i < take; i += 1) {
      const j = i + Math.floor(rand() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (let i = 0; i < take; i += 1) picked.push({ ...members[idx[i]], band: edge.band });
  }
  picked.sort((a, b) => a.rank - b.rank);
  return { picked, edges: edges.map(({ band, fromRank, size }) => ({ band, fromRank, size })) };
}

function readJsonLines(path) {
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
  const recordsPath = argValue(argv, "--records") ?? join(HERE, "records-full.jsonl");
  const poolPath = argValue(argv, "--pool") ?? join(HERE, "pool.jsonl");
  const outPath = argValue(argv, "--out") ?? join(HERE, "scope-sample.json");
  const perBand = Number(argValue(argv, "--per-band") ?? PER_BAND);
  const seed = Number(argValue(argv, "--seed") ?? SCOPE_SEED);

  const poolInputs = readJsonLines(poolPath);
  const poolRank = new Map(poolInputs.map((input, idx) => [input.place.place_id, idx + 1]));
  const inputById = new Map(poolInputs.map((input) => [input.place.place_id, input]));
  const records = readJsonLines(recordsPath);

  const population = climateRejectedPopulation(records, poolRank);
  const { picked, edges } = drawSample(population, { perBand, seed });
  const sample = picked.map((entry) => {
    const input = inputById.get(entry.place_id);
    const extract = Array.isArray(input?.extracts) ? input.extracts[0] : {};
    return {
      place_id: entry.place_id,
      rank: entry.rank,
      band: entry.band,
      name: input?.place?.name ?? null,
      country: input?.place?.country ?? null,
      subdivision: input?.place?.subdivision ?? null,
      article: extract.article ?? null,
      url: extract.url ?? null,
    };
  });
  const doc = {
    purpose: "Tier-2 source-expansion scoping sample (Liz, 2026-10-04): ~200 places drawn from the climate-rejected worker population of records-full.jsonl.",
    seed,
    prng: "mulberry32",
    bands: BANDS,
    perBand,
    population: {
      definition:
        "records-full.jsonl status=rejected AND rejection.tier_name=climate, excluding the one validator-converted rejection (gn-2652676 Cockermouth)",
      count: population.length,
      rankRange: population.length ? [population[0].rank, population[population.length - 1].rank] : null,
    },
    bandEdges: edges,
    sampleSize: sample.length,
    sample,
  };
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
  console.log(
    `population ${population.length} climate-rejected worker places; drew ${sample.length} (${perBand}/band x ${BANDS}, seed ${seed}) -> ${outPath}`,
  );
  for (const e of edges) console.log(`  band ${e.band}: size ${e.size}, from rank ${e.fromRank}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
