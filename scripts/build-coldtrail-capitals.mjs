/**
 * Cold Trail capitals pack generator. This is an isolated second pass
 * next to scripts/build-coldtrail.mjs, and it emits:
 *
 *   src/game/coldtrail/cases.capitals.generated.json
 *
 * One pack case is an ordinary Cold Trail case (a difficulty-2 hideout
 * plus 3 witness sightings) whose witnesses are famous capitals. The
 * design of record (docs/story-packs.md section 2.2) puts capitals in the witness
 * seats, never in the hideout seat: a famous capital as the hideout
 * would turn triangulation into recall, because a player who already
 * knows where Paris is does not need three rings. The hideout pool is
 * the same mid-difficulty pool the core generator uses.
 *
 * Case building itself is not re-implemented here. Every case comes
 * from buildCase() in build-coldtrail.mjs, so the witness distance
 * band (250 to 4000 km), the distinct-octant spread, and the
 * player-fair radius rounding are the core generator's own rules.
 * This pass only chooses the pools and the seed.
 *
 * Isolation, on purpose:
 * - Its own mulberry32 stream (COLDTRAIL_CAPITALS_SEED). The core
 *   deck is built from one shared stream, so feeding pack cases from
 *   that stream would re-roll core cases 1 to 60. Nothing here calls
 *   buildDeck() or the core main().
 * - Its own output file and, at runtime, its own progress store key.
 *   The core 60 cases, cases.generated.json, and the
 *   meridian.coldtrail.v2 store are never touched.
 *
 * Witness eligibility is the design's measured rule: a curated
 * capital anchors a case only when its population is at least
 * 300,000 (MIN_WITNESS_POP in build-coldtrail.mjs) and its dataset
 * difficulty is 1 or 2 (WITNESS_DIFFICULTIES there). All 72 curated
 * capitals are difficulty 1 or 2, so population is the binding test:
 * 55 of the 72 clear it, and 17 (16 state capitals plus Reykjavik)
 * never anchor. Small capitals still reach the player as
 * GeoDetective cases and as pack stamps; the pack does not lower the
 * anchor rule to force them in.
 *
 * One core filter is deliberately not applied to the curated list:
 * the blurb isCity test in build-coldtrail.mjs. That test keeps city
 * districts and neighborhoods out of the general witness pool.
 * Curation already guarantees every entry here is a real capital
 * city, and the test false-positives on Washington, whose blurb names
 * the District of Columbia. Applying it would drop Washington
 * (population 689,545) for a wording accident. A test in
 * build-coldtrail-capitals.test.mjs pins Washington as eligible so
 * this decision stays visible.
 *
 * Where the capital ids come from: the pack records Slice 2 authors
 * at scripts/packs/capitals/cases/*.json (one
 * meridian.pack.case.v1 record per case, target.placeId is the
 * capital). When that directory exists and is non-empty, this pass
 * reads the ids from the records and nothing else. The records have
 * landed (72 files ship in that directory), so on the shipped tree
 * the records always win and the fallback below never triggers. The
 * fallback — CURATED_CAPITAL_IDS, the same 72 ids — is retained for
 * a tree whose records directory is missing or empty (for example a
 * fresh content branch before its records are authored); it can
 * trigger only then.
 *
 * The place and population loaders below repeat the ones in
 * build-coldtrail.mjs because those are module-private there.
 * Population comes from the loop guess index
 * (public/loop/names.v2.json), the same source the core generator
 * uses, joined on the numeric part of the place id.
 *
 * Run: node --experimental-strip-types scripts/build-coldtrail-capitals.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unpackNameIndex } from "../src/game/loop/names-codec.ts";
import { buildCase } from "./build-coldtrail.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS_DIR);
const CHUNKS_DIR = join(ROOT, "src/game/data/geonames/chunks");
const NAMES_INDEX = join(ROOT, "public/loop/names.v2.json");
const RECORDS_DIR = join(ROOT, "scripts/packs/capitals/cases");
const OUT_DIR = join(ROOT, "src/game/coldtrail");
const OUT_FILE = join(OUT_DIR, "cases.capitals.generated.json");

export const CAPITALS_PACK_ID = "capitals";
/** Own stream. Never the core COLDTRAIL_SEED. */
export const COLDTRAIL_CAPITALS_SEED = 20261103;
export const PACK_CASE_TARGET = 60;
/** A thinner pack than this is a broken pack. Fail closed. */
export const MIN_PACK_CASES = 40;

/** Same values as in build-coldtrail.mjs; kept in step by the tests. */
const MIN_WITNESS_POP = 300_000;
const WITNESS_DIFFICULTIES = new Set([1, 2]);
const HIDEOUT_DIFFICULTY = 2;
const MIN_HIDEOUT_POP = 50_000;
const MAX_HIDEOUT_POP = 2_000_000;
const NOT_A_CITY = /neighborhood|district|borough|arrondissement|suburb/i;

/**
 * The 72 curated capitals from CAPITALS-PACK.md sections B (44
 * countries) and C (28 US states), as gn-prefixed place ids. Used
 * only while scripts/packs/capitals/cases/ has no records yet.
 */
export const CURATED_CAPITAL_IDS = [
  // Countries (CAPITALS-PACK.md section B)
  "gn-2988507", "gn-2643743", "gn-3169070", "gn-2950159", "gn-3117735",
  "gn-1850147", "gn-1816670", "gn-1261481", "gn-4140963", "gn-3530597",
  "gn-3469058", "gn-360630", "gn-524901", "gn-2172517", "gn-264371",
  "gn-2761369", "gn-2759794", "gn-2673730", "gn-1835848", "gn-1609350",
  "gn-6094817", "gn-3435910", "gn-2964574", "gn-2267057", "gn-2618425",
  "gn-658225", "gn-3067696", "gn-2179537", "gn-3553478", "gn-3871336",
  "gn-756135", "gn-3054643", "gn-2306104", "gn-344979", "gn-1283240",
  "gn-1581130", "gn-1701668", "gn-1880252", "gn-292968", "gn-703448",
  "gn-1642911", "gn-964137", "gn-3936456", "gn-3413829",
  // US states (CAPITALS-PACK.md section C)
  "gn-5389489", "gn-4671654", "gn-4930956", "gn-5419384", "gn-4180439",
  "gn-5308655", "gn-4644585", "gn-5856195", "gn-5106834", "gn-5490263",
  "gn-5554072", "gn-4250542", "gn-4259418", "gn-4509177", "gn-4487042",
  "gn-4781708", "gn-4347242", "gn-5261457", "gn-5045360", "gn-5780993",
  "gn-5750162", "gn-5805687", "gn-5586437", "gn-5656882", "gn-5821086",
  "gn-5072006", "gn-4853828", "gn-4119403",
];

/**
 * Capital ids from the pack records, or null when the records
 * directory does not exist yet or holds no records. A record that
 * exists but is malformed throws: a half-read pack must never
 * generate silently.
 */
export function loadPackCapitalIds(recordsDir = RECORDS_DIR) {
  if (!existsSync(recordsDir)) return null;
  const files = readdirSync(recordsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  const ids = [];
  const seen = new Set();
  for (const file of files) {
    const record = JSON.parse(readFileSync(join(recordsDir, file), "utf8"));
    const placeId = record?.target?.placeId;
    if (typeof placeId !== "string" || !/^gn-\d+$/.test(placeId)) {
      throw new Error(
        `build-coldtrail-capitals: pack record ${file} has no valid target.placeId — refusing to generate from a half-read pack`,
      );
    }
    if (seen.has(placeId)) {
      throw new Error(
        `build-coldtrail-capitals: pack record ${file} repeats target ${placeId} — refusing to generate from a duplicated pack`,
      );
    }
    seen.add(placeId);
    ids.push(placeId);
  }
  return ids;
}

/** Records win when present; the curated list is the fallback. */
export function resolvePackCapitalIds(recordsDir = RECORDS_DIR) {
  return loadPackCapitalIds(recordsDir) ?? [...CURATED_CAPITAL_IDS];
}

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

/** Population by numeric GeoNames id, from the loop guess index. */
function loadPopulations() {
  const index = unpackNameIndex(JSON.parse(readFileSync(NAMES_INDEX, "utf8")));
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
 * Split the pack capitals into anchors and non-anchors under the
 * design's witness rule (population and difficulty; see the header
 * for why the blurb isCity test is not applied to the curated list).
 * Every curated id must resolve to a chunk place. An id that does
 * not resolve throws, because a pack record pointing at nothing is a
 * build error, not a case to skip quietly.
 */
export function splitWitnessPool(places, capitalIds) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const anchors = [];
  const nonAnchors = [];
  for (const id of capitalIds) {
    const place = byId.get(id);
    if (!place) {
      throw new Error(
        `build-coldtrail-capitals: curated capital ${id} is not in the GeoNames chunks — refusing to generate`,
      );
    }
    if (WITNESS_DIFFICULTIES.has(place.difficulty) && place.pop >= MIN_WITNESS_POP) {
      anchors.push(place);
    } else {
      nonAnchors.push({
        id: place.id,
        name: place.name,
        pop: place.pop,
        difficulty: place.difficulty,
      });
    }
  }
  return { anchors, nonAnchors };
}

/**
 * The witness split for the resolved capital set, measured from the
 * real chunks and the real names index. Exported so the tests assert
 * against the production path instead of a second implementation.
 */
export function measureWitnessPool() {
  const places = loadPlaces();
  const capitalIds = resolvePackCapitalIds();
  const { anchors, nonAnchors } = splitWitnessPool(places, capitalIds);
  return { capitalIds, anchors, nonAnchors };
}

/** The hideout pool, filtered exactly as the core generator filters it. */
export function hideoutPool(places) {
  return places.filter(
    (p) =>
      p.isCity &&
      p.difficulty === HIDEOUT_DIFFICULTY &&
      p.pop >= MIN_HIDEOUT_POP &&
      p.pop <= MAX_HIDEOUT_POP,
  );
}

export function buildPackDeck() {
  const places = loadPlaces();
  const capitalIds = resolvePackCapitalIds();
  const { anchors } = splitWitnessPool(places, capitalIds);
  if (anchors.length < 3) {
    throw new Error(
      `build-coldtrail-capitals: only ${anchors.length} capitals can anchor — refusing to generate a pack that cannot triangulate`,
    );
  }
  const hideouts = hideoutPool(places);
  const random = mulberry32(COLDTRAIL_CAPITALS_SEED);
  // Shuffle hideout candidates on the pack stream; no hideout repeats.
  const shuffled = [...hideouts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cases = [];
  const usedHideouts = new Set();
  for (const h of shuffled) {
    if (cases.length >= PACK_CASE_TARGET) break;
    if (usedHideouts.has(h.id)) continue;
    const built = buildCase(cases.length + 1, h, anchors, random);
    if (!built) continue; // fewer than 3 capitals in range: skip, never deal a thin case
    usedHideouts.add(h.id);
    cases.push({ ...built, packId: CAPITALS_PACK_ID });
  }
  return cases;
}

function main() {
  const cases = buildPackDeck();
  if (cases.length < MIN_PACK_CASES) {
    console.error(
      `build-coldtrail-capitals: only ${cases.length} pack cases built, below the ${MIN_PACK_CASES} floor — refusing to emit a thin pack deck`,
    );
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify({ v: 1, cases }, null, 1)}\n`);
  console.log(`build-coldtrail-capitals: ${cases.length} cases -> ${OUT_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
