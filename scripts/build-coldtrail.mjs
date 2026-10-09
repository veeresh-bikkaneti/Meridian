/**
 * Cold Trail case generator — the GeoDetective-style "smuggler triangulation"
 * loop's static case deck.
 *
 * Reads the 124,690 GeoNames places in src/game/data/geonames/chunks/*.json
 * and emits:
 *
 *   src/game/coldtrail/cases.generated.json   [{caseNo, hideout, sightings[3]}]
 *
 * One case = a difficulty-2/3 hideout city plus 3 sightings. Each sighting
 * names a DIFFERENT witness city, the true distance from that city to the
 * hideout (rounded/vague by hideout difficulty), and a timestamped witness
 * report like "Last seen refueling 400 km east of Denver." The runtime draws
 * one radius ring per sighting; the player triangulates and taps the
 * interception point. Score = km from the true hideout.
 *
 * Deterministic: mulberry32(SEED) — regenerating yields byte-identical
 * output, so the checked-in file doubles as the reviewable source of truth.
 * Offline-first: the JSON is statically imported by src/game/coldtrail/cases.ts
 * (bundled, never fetched at runtime).
 *
 * Run: node --experimental-strip-types scripts/build-coldtrail.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  distanceKm,
  initialBearing,
  octantOf,
} from "../src/game/geo.ts";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
const CHUNKS_DIR = join(ROOT, "src/game/data/geonames/chunks");
// Population comes from the loop guess index (public/loop/names.json, built
// by scripts/build-loop.mjs from the same GeoNames dump): chunk ids are
// "gn-<n>" and index ids "geonames:<n>", joined on the numeric part.
const NAMES_INDEX = join(ROOT, "public/loop/names.json");
const OUT_DIR = join(ROOT, "src/game/coldtrail");
const OUT_FILE = join(OUT_DIR, "cases.generated.json");

/** Witness cities must be well-known anchors; hideouts recognizable. */
const MIN_WITNESS_POP = 300_000;
/** Blurbs of city districts / neighborhoods — never a hideout or anchor. */
const NOT_A_CITY = /neighborhood|district|borough|arrondissement|suburb/i;

export const COLDTRAIL_SEED = 20261008;
export const COLDTRAIL_CASE_COUNT = 60;

/**
 * Hideout fame tier: difficulty 2 = recognizable mid-size cities. (Difficulty 3
 * in this dataset is overwhelmingly city districts and small towns — verified
 * against the chunks — so 2 matches the "recognizable but not trivial" intent.)
 */
const HIDEOUT_DIFFICULTY = 2;
const MIN_HIDEOUT_POP = 50_000;
const MAX_HIDEOUT_POP = 2_000_000;
/** Witness anchors: famous-enough cities to triangulate from (cf. "Denver"). */
const WITNESS_DIFFICULTIES = new Set([1, 2]);
/** Witness must be this far from the hideout (km): not a giveaway, not absurd. */
const MIN_WITNESS_KM = 250;
const MAX_WITNESS_KM = 4000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vague-by-difficulty: tier 2 rounds to 25 km, tier 3 to 50 km. */
export function vagueRadius(trueKm, difficulty) {
  const step = difficulty === 2 ? 25 : 50;
  // Player-fair: ceil so the advertised ring never understates the true
  // distance (round-to-nearest could undershoot by up to half a step).
  return Math.max(step, Math.ceil(trueKm / step) * step);
}

const OCTANT_WORDS = {
  north: "north",
  "north-east": "northeast",
  east: "east",
  "south-east": "southeast",
  south: "south",
  "south-west": "southwest",
  west: "west",
  "north-west": "northwest",
};

/** Kid-friendly witness-report verbs (game fiction, not place data). */
const SIGHTING_VERBS = [
  "refueling a dusty pickup",
  "buying supplies at a truck stop",
  "spotted at a roadside diner",
  "seen boarding a night bus",
  "withdrawing cash from an ATM",
  "asking a gas attendant for directions",
  "sleeping in a parked car",
  "buying a burner phone",
  "eating at a drive-through",
  "filling jerrycans",
  "hitching a ride from a trucker",
  "seen at a bus depot",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtKm(km) {
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

function fmtTimestamp(baseDay, offsetDays, hour, minute) {
  const day = WEEKDAYS[(baseDay + offsetDays) % 7];
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

/** Population by numeric GeoNames id, from the loop guess index. */
function loadPopulations() {
  const index = JSON.parse(readFileSync(NAMES_INDEX, "utf8"));
  const pops = new Map();
  for (const entry of index) {
    const num = String(entry.id).split(":")[1];
    if (num && typeof entry.p === "number") pops.set(num, entry.p);
  }
  return pops;
}

function loadPlaces() {
  const pops = loadPopulations();
  const places = [];
  for (const file of readdirSync(CHUNKS_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    const chunk = JSON.parse(readFileSync(join(CHUNKS_DIR, file), "utf8"));
    for (const p of chunk.places ?? []) {
      if (
        typeof p.lon !== "number" ||
        typeof p.lat !== "number" ||
        typeof p.name !== "string" ||
        typeof p.id !== "string"
      ) {
        continue;
      }
      const pop = pops.get(p.id.slice(3)) ?? 0;
      places.push({ ...p, pop, isCity: !NOT_A_CITY.test(p.blurb ?? "") });
    }
  }
  return places;
}

/**
 * Build one case: hideout + 3 witness sightings spread across different
 * octants so the rings triangulate instead of stacking.
 */
export function buildCase(caseNo, hideout, candidates, random) {
  const pool = candidates.filter((c) => c.id !== hideout.id);
  // Shuffle witness candidates deterministically per case.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = [];
  const usedOctants = new Set();
  for (const c of shuffled) {
    if (picked.length === 3) break;
    const trueKm = distanceKm([c.lon, c.lat], [hideout.lon, hideout.lat]);
    if (trueKm < MIN_WITNESS_KM || trueKm > MAX_WITNESS_KM) continue;
    if (picked.some((s) => s.cityId === c.id)) continue;
    const bearing = initialBearing([c.lon, c.lat], [hideout.lon, hideout.lat]);
    const octant = bearing === null ? "north" : octantOf(bearing);
    if (usedOctants.has(octant)) continue;
    usedOctants.add(octant);
    picked.push({ city: c, trueKm, octant });
  }
  if (picked.length < 3) return null; // fail closed: skip, don't deal a thin case

  const baseDay = Math.floor(random() * 7);
  const sightings = picked.map((s, i) => {
    const radiusKm = vagueRadius(s.trueKm, hideout.difficulty);
    const verb = SIGHTING_VERBS[Math.floor(random() * SIGHTING_VERBS.length)];
    // Some verbs already start with "seen"/"spotted" — don't double it.
    const lead = /^(seen|spotted)\b/.test(verb) ? "Last" : "Last seen";
    const offsetDays = i === 2 ? 1 : 0;
    const hour = 5 + Math.floor(random() * 18);
    const minute = Math.floor(random() * 60);
    return {
      id: `s${i + 1}`,
      timestamp: fmtTimestamp(baseDay, offsetDays, hour, minute),
      cityId: s.city.id,
      cityName: s.city.name,
      cityLon: s.city.lon,
      cityLat: s.city.lat,
      radiusKm,
      octant: s.octant,
      text: `${lead} ${verb} ${fmtKm(radiusKm)} ${OCTANT_WORDS[s.octant]} of ${s.city.name}.`,
    };
  });

  return {
    v: 1,
    caseNo,
    hideout: {
      placeId: hideout.id,
      name: hideout.name,
      lon: hideout.lon,
      lat: hideout.lat,
      difficulty: hideout.difficulty,
    },
    sightings,
  };
}

export function buildDeck() {
  const places = loadPlaces();
  const hideouts = places.filter(
    (p) =>
      p.isCity &&
      p.difficulty === HIDEOUT_DIFFICULTY &&
      p.pop >= MIN_HIDEOUT_POP &&
      p.pop <= MAX_HIDEOUT_POP,
  );
  const witnesses = places.filter(
    (p) => p.isCity && WITNESS_DIFFICULTIES.has(p.difficulty) && p.pop >= MIN_WITNESS_POP,
  );
  const random = mulberry32(COLDTRAIL_SEED);
  // Shuffle hideout candidates deterministically; no hideout repeats.
  const shuffled = [...hideouts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cases = [];
  const usedHideouts = new Set();
  for (const h of shuffled) {
    if (cases.length >= COLDTRAIL_CASE_COUNT) break;
    if (usedHideouts.has(h.id)) continue;
    const c = buildCase(cases.length + 1, h, witnesses, random);
    if (!c) continue;
    usedHideouts.add(h.id);
    cases.push(c);
  }
  return cases;
}

function main() {
  const cases = buildDeck();
  if (cases.length < COLDTRAIL_CASE_COUNT) {
    console.error(
      `build-coldtrail: only ${cases.length}/${COLDTRAIL_CASE_COUNT} cases built — refusing to emit a thin deck`,
    );
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify({ v: 1, cases }, null, 1)}\n`);
  console.log(`build-coldtrail: ${cases.length} cases -> ${OUT_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
