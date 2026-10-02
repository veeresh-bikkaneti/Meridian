/**
 * GeoDetective data pipeline.
 *
 * Reads the hand-authored seed clue sets in scripts/loop-seed.json and the
 * 124,690 GeoNames places in src/game/data/geonames/chunks/*.json, and emits:
 *
 *   public/loop/manifest.json   {v, size, generatedAt}
 *   public/loop/names.json       lazy-loaded guess index [{n,id,lon,lat,r,p}]
 *   public/loop/clues/{i}.json   one per seed place, {v,placeId,target,clues,source}
 *
 * The runtime day-index contract (mirrored in scripts/build-loop.test.mjs):
 *   index = Math.floor(Date.now() / 86400000) % manifest.size
 * so seeds are assigned to indices 0..11 in loop-seed.json order.
 *
 * Run: node scripts/build-loop.mjs
 * Populations come from the GeoNames allCountries dump
 * (~/workspace/meridian-data/geonames/allCountries.txt, CC-BY 4.0 — the same
 * dump the chunk dataset was built from); override with MERIDIAN_GEONAMES_DUMP.
 */
import {
  createReadStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
const SEED_PATH = join(SCRIPTS_DIR, "loop-seed.json");
const CHUNKS_DIR = join(ROOT, "src/game/data/geonames/chunks");
const OUT_DIR = join(ROOT, "public/loop");
const CLUES_DIR = join(OUT_DIR, "clues");

const DUMP_PATH =
  process.env.MERIDIAN_GEONAMES_DUMP ??
  join(
    process.env.HOME ?? "~",
    "workspace/meridian-data/geonames/allCountries.txt",
  );

const MS_PER_DAY = 86_400_000;
const MAX_CLUE_WORDS = 40;

/** Lowercase, NFD diacritics stripped, punctuation removed, spaces collapsed. */
export function normalizeName(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(iso2) {
  try {
    return COUNTRY_NAMES.of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

/** "State, Country" for US state chunks, "Country" for country/globe chunks. */
export function regionLabel(place) {
  const country = countryName(place.iso2);
  if (place.edition === "state") {
    const state = place.regionId
      .split("-")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    return `${state}, ${country}`;
  }
  return country;
}

/**
 * Day-index contract shared with the Loop runtime (Worker 2):
 * index = Math.floor(Date.now() / 86400000) % manifest.size
 */
export function dayIndexFor(dateMs, size) {
  return Math.floor(dateMs / MS_PER_DAY) % size;
}

function wordCount(clue) {
  return clue.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Guardrail verification for one seed's 5 clues. Throws on the first
 * violation: wrong clue count, clue > 40 words, or a banned term appearing.
 * Banned terms match on word boundaries; single banned words of length >= 4
 * are additionally rejected when embedded inside another token
 * (e.g. "parisian" must not slip past a "paris" ban).
 */
export function verifySeedClues(seed) {
  if (!Array.isArray(seed.clues) || seed.clues.length !== 5) {
    throw new Error(
      `seed "${seed.place}": expected 5 clues, got ${seed.clues?.length}`,
    );
  }
  seed.clues.forEach((clue, tier) => {
    if (typeof clue !== "string" || clue.trim().length === 0) {
      throw new Error(`seed "${seed.place}" clue ${tier + 1}: empty clue`);
    }
    const words = wordCount(clue);
    if (words > MAX_CLUE_WORDS) {
      throw new Error(
        `seed "${seed.place}" clue ${tier + 1}: ${words} words (max ${MAX_CLUE_WORDS})`,
      );
    }
    const norm = ` ${normalizeName(clue)} `;
    const banned = [...(seed.banned ?? [])];
    if (tier < 3) banned.push(...(seed.eponyms ?? []));
    for (const term of banned) {
      const t = normalizeName(term);
      if (!t) continue;
      if (norm.includes(` ${t} `)) {
        throw new Error(
          `seed "${seed.place}" clue ${tier + 1}: banned phrase "${term}"`,
        );
      }
      if (!t.includes(" ") && t.length >= 4) {
        const embedded = norm
          .trim()
          .split(" ")
          .some((tok) => tok !== t && tok.includes(t));
        if (embedded) {
          throw new Error(
            `seed "${seed.place}" clue ${tier + 1}: banned term "${term}" embedded in another word`,
          );
        }
      }
    }
  });
}

export function loadSeed(path = SEED_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadChunkPlaces(dir = CHUNKS_DIR) {
  const places = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const p of data.places) {
      places.push({
        numericId: String(p.id).replace(/^gn-/, ""),
        name: p.name,
        lon: p.lon,
        lat: p.lat,
        iso2: p.iso2,
        edition: p.edition,
        regionId: p.regionId,
      });
    }
  }
  return places;
}

/**
 * Streams the GeoNames allCountries dump and returns population per geonameid,
 * but only for the ids in `wanted` (so memory stays small).
 */
export async function loadPopulations(dumpPath, wanted) {
  const pops = new Map();
  const stream = createReadStream(dumpPath, { encoding: "utf8" });
  let buf = "";
  for await (const chunk of stream) {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (!line || line.startsWith("#")) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const id = line.slice(0, tab);
      if (!wanted.has(id) || pops.has(id)) continue;
      const cols = line.split("\t");
      const pop = Number(cols[14]);
      pops.set(id, Number.isFinite(pop) ? pop : 0);
    }
  }
  return pops;
}

function entryFor(place, pops) {
  return {
    n: normalizeName(place.name),
    id: `geonames:${place.numericId}`,
    lon: Math.round(place.lon * 1e4) / 1e4,
    lat: Math.round(place.lat * 1e4) / 1e4,
    r: regionLabel(place),
    p: pops.get(place.numericId) ?? 0,
  };
}

/**
 * Dedupe identical (normalized name, region) combos, keeping the
 * highest-population entry; distinct (name, region) combos are all kept, so
 * "springfield" still yields Springfield IL, MO, ... as separate entries.
 */
export function dedupeEntries(entries) {
  const byKey = new Map();
  for (const e of entries) {
    if (!e.n) continue;
    const key = `${e.n}||${e.r}`;
    const prev = byKey.get(key);
    if (!prev || e.p > prev.p) byKey.set(key, e);
  }
  return [...byKey.values()];
}

function resolveAliasTarget(alias, places, pops) {
  const targetNorm = normalizeName(alias.target);
  let best = null;
  for (const place of places) {
    if (place.iso2 !== alias.iso2) continue;
    if (normalizeName(place.name) !== targetNorm) continue;
    const pop = pops.get(place.numericId) ?? 0;
    if (!best || pop > best.pop) best = { place, pop };
  }
  if (!best) {
    throw new Error(
      `alias "${alias.alias}" target "${alias.target}" (${alias.iso2}) not found in chunks`,
    );
  }
  return {
    n: normalizeName(alias.alias),
    id: `geonames:${best.place.numericId}`,
    lon: Math.round(best.place.lon * 1e4) / 1e4,
    lat: Math.round(best.place.lat * 1e4) / 1e4,
    r: regionLabel(best.place),
    p: best.pop,
  };
}

export function buildNamesIndex(places, pops, aliases) {
  const entries = places.map((p) => entryFor(p, pops));
  for (const alias of aliases) {
    entries.push(resolveAliasTarget(alias, places, pops));
  }
  const deduped = dedupeEntries(entries);
  deduped.sort((a, b) => b.p - a.p || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0) || (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
  return deduped;
}

function resolveSeedPlace(seed, byId) {
  const place = byId.get(String(seed.geonamesId));
  if (!place) {
    throw new Error(
      `seed "${seed.place}": geonames:${seed.geonamesId} not found in chunks`,
    );
  }
  if (place.iso2 !== seed.iso2) {
    throw new Error(
      `seed "${seed.place}": chunk iso2 ${place.iso2} != seed iso2 ${seed.iso2}`,
    );
  }
  return place;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value));
}

async function main() {
  const { seeds, aliases } = loadSeed();
  if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error("loop-seed.json: no seeds");
  }
  for (const seed of seeds) verifySeedClues(seed);

  const places = loadChunkPlaces();
  const byId = new Map(places.map((p) => [p.numericId, p]));
  const wanted = new Set(places.map((p) => p.numericId));

  let pops;
  try {
    pops = await loadPopulations(DUMP_PATH, wanted);
  } catch (err) {
    throw new Error(
      `population dump unreadable at ${DUMP_PATH} (override with MERIDIAN_GEONAMES_DUMP): ${err.message}`,
    );
  }
  const missing = [...wanted].filter((id) => !pops.has(id));
  console.log(
    `places=${places.length} populations=${pops.size} missingPop=${missing.length}`,
  );

  mkdirSync(CLUES_DIR, { recursive: true });

  // (c) one clue file per seed, indices 0..N-1 in seed order
  seeds.forEach((seed, index) => {
    const place = resolveSeedPlace(seed, byId);
    writeJson(join(CLUES_DIR, `${index}.json`), {
      v: 1,
      placeId: `geonames:${place.numericId}`,
      target: { lon: place.lon, lat: place.lat },
      clues: seed.clues,
      source: { label: "Wikipedia", href: seed.wikipedia },
    });
    console.log(
      `clues/${index}.json <- ${seed.place} (geonames:${place.numericId})`,
    );
  });

  // (a) manifest
  const manifest = {
    v: 1,
    size: seeds.length,
    generatedAt: new Date().toISOString(),
  };
  writeJson(join(OUT_DIR, "manifest.json"), manifest);

  // (b) guess index
  const index = buildNamesIndex(places, pops, aliases ?? []);
  writeJson(join(OUT_DIR, "names.json"), index);
  console.log(
    `names.json entries=${index.length} aliases=${(aliases ?? []).length}`,
  );
  console.log(`manifest size=${manifest.size}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
