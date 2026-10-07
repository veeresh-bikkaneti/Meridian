/**
 * GeoDetective data pipeline — guess-index builder.
 *
 * Reads the 124,690 GeoNames places in src/game/data/geonames/chunks/*.json
 * and emits the lazy-loaded typeahead guess index:
 *
 *   public/loop/names.json       [{n,id,lon,lat,r,p}]  (~119k entries)
 *
 * The runtime day-index contract (mirrored in scripts/build-loop.test.mjs):
 *   index = Math.floor(Date.now() / 86400000) % manifest.size
 *
 * This script no longer emits clue files or the manifest: the placeholder
 * clue-file/manifest emission from feat/meridian-loop (scripts/loop-seed.json
 * -> public/loop/clues/{i}.json + manifest size:12) was deliberately removed
 * in the feat/geodetective-edition port. public/loop/clues/** and
 * public/loop/manifest.json are production content (387 validated sets,
 * PR #59) and must NEVER be overwritten by this script.
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
// Single shared normalizer with the runtime typeahead (src/game/loop/evaluate.ts).
// The build and the query path must never drift again.
import { normalizeLoopName } from "../src/game/loop/normalize.ts";
// The REAL runtime ranker — the findability gate below must use the same
// matching logic the typeahead uses, never a reimplementation.
import { rankLoopSuggestions } from "../src/game/loop/evaluate.ts";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
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

/**
 * Lowercase, transliterate, NFD diacritics stripped, punctuation → space,
 * spaces collapsed. Single source of truth: ../src/game/loop/normalize.ts
 * (shared with the runtime typeahead). Kept as a named export for the
 * pipeline tests.
 */
export const normalizeName = normalizeLoopName;

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
 * Day-index contract shared with the Loop runtime:
 * index = Math.floor(Date.now() / 86400000) % manifest.size
 */
export function dayIndexFor(dateMs, size) {
  return Math.floor(dateMs / MS_PER_DAY) % size;
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
 *
 * Pin-through (option (a), reversible): `pinnedIds` are the 387 production
 * clue target ids (see loadLoopTargetIds). A pinned entry is never deduped
 * away — neither by a higher-population shadow nor by another pinned
 * target: two production days can share a name+region (the La Ceiba twins,
 * clues 130/132 — duplicate GeoNames records for the same city), and
 * collapsing them would leave one of the two days unwinnable. A
 * non-pinned entry whose (name, region) collides with a pinned target is
 * dropped — the production target owns that name+region lane.
 * Reversible: dropping the pin set restores pure highest-population dedupe.
 */
export function dedupeEntries(entries, pinnedIds = new Set()) {
  const pinned = [];
  const pinnedSeenIds = new Set();
  const rest = [];
  for (const e of entries) {
    if (!e.n) continue;
    if (pinnedIds.has(e.id)) {
      if (!pinnedSeenIds.has(e.id)) {
        pinnedSeenIds.add(e.id);
        pinned.push(e);
      }
    } else {
      rest.push(e);
    }
  }
  const pinnedKeys = new Set(pinned.map((e) => `${e.n}||${e.r}`));
  const byKey = new Map();
  for (const e of rest) {
    const key = `${e.n}||${e.r}`;
    if (pinnedKeys.has(key)) continue;
    const prev = byKey.get(key);
    if (!prev || e.p > prev.p) byKey.set(key, e);
  }
  return [...pinned, ...byKey.values()];
}

/**
 * Load the production clue target ids from public/loop/clues/*.json.
 * These are production content (PR #59) — read-only input, never written.
 */
export function loadLoopTargetIds(cluesDir = CLUES_DIR) {
  const ids = new Set();
  for (const file of readdirSync(cluesDir).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(cluesDir, file), "utf8"));
    if (typeof data.placeId === "string" && data.placeId.length > 0) {
      ids.add(data.placeId);
    }
  }
  return ids;
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

export function buildNamesIndex(places, pops, aliases, pinnedIds = new Set()) {
  const entries = places.map((p) => entryFor(p, pops));
  for (const alias of aliases) {
    entries.push(resolveAliasTarget(alias, places, pops));
  }
  const deduped = dedupeEntries(entries, pinnedIds);
  deduped.sort((a, b) => b.p - a.p || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0) || (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
  return deduped;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value));
}

/**
 * Build-time findability gate (fail-closed data gate, same spirit as
 * lint-cards.mjs): every production clue target must be reachable by typing
 * its NATURAL name — the name a player actually types — through the REAL
 * runtime ranker. Presence in the index is not enough: a target whose
 * indexed form can't be produced by typing its natural name is an
 * unwinnable day (2026-10-05: Białystok/Hınıs were present but unfindable
 * due to a build/runtime normalizer drift).
 */
function assertTargetsFindable(index, places, targetIds) {
  const naturalById = new Map(places.map((p) => [`geonames:${p.numericId}`, p.name]));
  const failures = [];
  for (const id of targetIds) {
    const natural = naturalById.get(id);
    if (!natural) {
      failures.push(`${id}: no natural name in chunk places`);
      continue;
    }
    const { suggestions } = rankLoopSuggestions(index, natural, 8);
    if (!suggestions.some((s) => s.id === id)) {
      failures.push(`${id} (${natural}): not in top-8 for natural-name query`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `findability gate: ${failures.length} targets unreachable by natural name:\n${failures.join("\n")}`,
    );
  }
  console.log(`findability gate: ${targetIds.size}/${targetIds.size} targets reachable by natural name`);
}

async function main() {
  const places = loadChunkPlaces();
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

  mkdirSync(OUT_DIR, { recursive: true });

  // Guess index only. This script never writes clue files or the manifest —
  // public/loop/clues/** and public/loop/manifest.json are production
  // content (PR #59) and are out of bounds for the data pipeline.
  // Pin-through-dedupe (option (a)): the 387 production clue targets win
  // (name, region) collisions so no production day is unwinnable.
  const targetIds = loadLoopTargetIds();
  console.log(`loopTargets=${targetIds.size}`);
  const index = buildNamesIndex(places, pops, [], targetIds);
  assertTargetsFindable(index, places, targetIds);
  writeJson(join(OUT_DIR, "names.json"), index);
  console.log(`names.json entries=${index.length}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
