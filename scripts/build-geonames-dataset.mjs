#!/usr/bin/env node
/**
 * build-geonames-dataset.mjs — Meridian 100k+ place dataset pipeline (GeoNames).
 *
 * Streams the GeoNames allCountries dump, keeps populated places (feature
 * class P) at or above a population threshold, maps every place to the game's
 * edition+regionId, runs the Hyderabad gate (coordinates must match the
 * claimed location), deduplicates, writes factual templated blurbs, and emits
 * per-region JSON chunks plus a manifest.
 *
 * Reproducible: same scratch inputs → same checked-in outputs, byte-for-byte
 * (chunk JSON is compact; place order follows the dump's geonameid order).
 * Node standard library only. No network. The dump is TSV data — parsed, never
 * executed.
 *
 * Inputs (scratch only, never committed):
 *   $MERIDIAN_GEONAMES_SCRATCH (default ~/workspace/meridian-data/geonames)/
 *     allCountries.txt        — GeoNames dump (CC-BY 4.0), ~1.8 GB extracted
 *     countryInfo.txt         — ISO2 → country name
 *     admin1CodesASCII.txt    — "CC.ADM1" → admin1 name
 *   $MERIDIAN_GATE_GEOJSON    — optional Natural Earth 50m admin-1 GeoJSON;
 *                               when present the gate upgrades from bbox checks
 *                               to true point-in-polygon checks (see GATE below)
 * Scratch outputs (regenerated every run, never committed):
 *   $MERIDIAN_GEONAMES_SCRATCH/geonames-country-boxes.json — per-country
 *     gate boxes derived from ALL GeoNames P rows (see GATE)
 * Repo inputs (checked in):
 *   src/game/regions.ts — STATES bounds are the authority for US state boxes
 *
 * Outputs (checked in):
 *   src/game/data/geonames/chunks/<regionId>.json
 *   src/game/data/geonames/manifest.json
 *   src/game/data/geonames/country-boxes.json — the per-country gate boxes
 *     (same content as the scratch copy, plus provenance meta); the
 *     build-time gate reads this file, so it must stay in sync with the dump
 *     the chunks were built from. Regenerate via this script, never hand-edit.
 *
 * Exit codes: 0 = shipped dataset written, gate clean. Non-zero = fail loudly
 * (unmappable row, gate violation shipped, threshold not met, …). Nothing is
 * ever dropped silently: every excluded row is quarantined with a reason and
 * reported.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const SCRATCH =
  process.env.MERIDIAN_GEONAMES_SCRATCH ?? join(homedir(), "workspace", "meridian-data", "geonames");
const GATE_GEOJSON = process.env.MERIDIAN_GATE_GEOJSON ?? null;
const OUT_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Population threshold rationale (measured 2026-09-30 on the live dump):
 *   ≥1000 → 148,276 raw    ≥1200 → 137,113    ≥1500 → 124,690
 *   ≥2000 → 110,545        ≥5000 →  69,238
 * The mandate is ≥100,000 SHIPPED places with a preference for
 * higher-population (more quiz-worthy) places. ≥2000 would clear 100k only on
 * a ~10% quarantine/dedup margin; ≥1500 keeps a ~25% margin while still
 * lifting the bar well above 1000. Small-state depth (Nebraska!) also argues
 * against pushing the threshold higher than needed.
 */
const POP_THRESHOLD = 1500;
const MIN_SHIPPED = 100_000;

/** US postal code → game state slug. Must match src/game/regions.ts STATES ids. */
const US_POSTAL_TO_SLUG = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire",
  NJ: "new-jersey", NM: "new-mexico", NY: "new-york", NC: "north-carolina",
  ND: "north-dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode-island", SC: "south-carolina", SD: "south-dakota", TN: "tennessee",
  TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

/** ISO-2 → country-edition regionId. Must match src/game/regions.ts COUNTRIES ids. */
const COUNTRY_ISO2 = {
  CA: "canada", MX: "mexico", BR: "brazil", GB: "united-kingdom", FR: "france",
  DE: "germany", IT: "italy", EG: "egypt", IN: "india", CN: "china",
  JP: "japan", AU: "australia",
};

/**
 * US state bounding boxes for the Hyderabad gate, derived from the game's own
 * region authority: the STATES bounds in src/game/regions.ts, expanded by a
 * small margin. Parsed at build time (fail loudly if the parse doesn't yield
 * exactly the 50 game states) so the gate can never drift from regions.ts.
 *
 * Why not the audited STARTER_STATE_BOXES (validate-places.ts)? A trial run
 * with those boxes rejected 20 genuinely-correct places at state edges the
 * boxes clip: WV's northern panhandle (Weirton 40.42°N vs box maxLat 39.9),
 * MS's eastern edge (Iuka -88.19 vs box maxLon -88.3), ND's Red River valley
 * (Fargo -96.79 vs box maxLon -96.8), TX's western tip (Anthony -106.61 vs
 * box minLon -106.5). regions.ts bounds contain all of them; the margin keeps
 * the gate generous. validate-places.ts itself is untouched (out of scope).
 */
const STATE_BOX_MARGIN_DEG = 0.15;

function loadStateBoxes() {
  const src = readFileSync(join(REPO, "src", "game", "regions.ts"), "utf8");
  const boxes = {};
  const re = /region\("([^"]+)", \[([^\]]+)\]\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const slug = name.toLowerCase().replaceAll(" ", "-");
    const [w, s, e, n] = m[2].split(",").map(Number);
    // Only the 50 STATES use region("Name", …) with simple names here;
    // COUNTRIES entries are filtered by the postal-table cross-check below.
    if (Object.values(US_POSTAL_TO_SLUG).includes(slug)) {
      boxes[slug] = {
        minLon: w - STATE_BOX_MARGIN_DEG,
        minLat: s - STATE_BOX_MARGIN_DEG,
        maxLon: e + STATE_BOX_MARGIN_DEG,
        maxLat: n + STATE_BOX_MARGIN_DEG,
      };
    }
  }
  return boxes;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

function loadCountryNames() {
  const map = new Map();
  for (const line of readFileSync(join(SCRATCH, "countryInfo.txt"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const c = line.split("\t");
    if (c[0] && c[4]) map.set(c[0], c[4]);
  }
  return map;
}

function loadAdmin1Names() {
  const map = new Map();
  for (const line of readFileSync(join(SCRATCH, "admin1CodesASCII.txt"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const c = line.split("\t");
    if (c[0] && c[1]) map.set(c[0], c[1]);
  }
  return map;
}

/**
 * Derives per-country gate boxes from ALL GeoNames populated-place rows
 * (5.2M), keyed by GeoNames country code. Box = min/max of the country's
 * places, padded 0.5°, minimum 2°×2°. Antimeridian-spanning countries (lon
 * span > 180°) are computed in the 0–360 frame and flagged `wrapped`
 * (same convention as F6b's country-boxes.json); candidates are normalized
 * into that frame before the containment check.
 *
 * Why not the old F6b checked-in country-boxes.json? Those boxes were derived from
 * the NE 10m populated-places dataset (a few thousand sparse points) and are
 * systematically too tight at geographic extremes: a trial run rejected 74
 * genuinely-correct places — Easter Island (CL), Bornholm (DK), Okinawa's
 * western islands (JP), Mohe county (CN), Fernando de Noronha (BR), the
 * Ogaden (ET), Far North Cameroon, southern Algeria, Kiritimati (KI), the
 * Marquesas (PF), Batanes (PH), Flores/Azores (PT), Rodrigues (MU),
 * Annobón (GQ), and more. GeoNames' own 5.2M places are two orders of
 * magnitude denser, so the derived boxes cover the real extremes.
 * (F6b's country-boxes.json was removed with the F6b dataset; the build-time
 * gate now reads the checked-in copy these boxes write into the repo.)
 *
 * The boxes are written to scratch (regenerated every run) and recorded in
 * the manifest. They are independent of this script's mapping decisions —
 * keyed by GeoNames' own country code — so a mapping bug still fails the gate.
 */
const COUNTRY_BOX_PAD_DEG = 0.5;
const COUNTRY_BOX_MIN_DEG = 2;

async function deriveCountryBoxes(dumpPath) {
  // Per-cc accumulators. Positive/negative lon extents are tracked separately
  // so antimeridian-spanning countries get a correct wrapped interval.
  const acc = new Map(); // cc → {minPos,maxPos,minNeg,maxNeg,minLat,maxLat,n}
  const rl = createInterface({ input: createReadStream(dumpPath) });
  for await (const line of rl) {
    if (!line) continue;
    const c = line.split("\t");
    if (c[6] !== "P") continue;
    const cc = c[8];
    if (!cc) continue;
    const lat = Number(c[4]);
    const lon = Number(c[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let e = acc.get(cc);
    if (!e) {
      e = { minPos: Infinity, maxPos: -Infinity, minNeg: Infinity, maxNeg: -Infinity,
            minLat: lat, maxLat: lat, n: 0 };
      acc.set(cc, e);
    }
    if (lon >= 0) { if (lon < e.minPos) e.minPos = lon; if (lon > e.maxPos) e.maxPos = lon; }
    else { if (lon < e.minNeg) e.minNeg = lon; if (lon > e.maxNeg) e.maxNeg = lon; }
    if (lat < e.minLat) e.minLat = lat;
    if (lat > e.maxLat) e.maxLat = lat;
    e.n++;
  }
  const boxes = {};
  for (const [cc, e] of acc) {
    const hasPos = e.maxPos > -Infinity;
    const hasNeg = e.minNeg < Infinity;
    const naiveMin = hasNeg ? e.minNeg : e.minPos;
    const naiveMax = hasPos ? e.maxPos : e.maxNeg;
    const wrapped = hasPos && hasNeg && naiveMax - naiveMin > 180;
    // Wrapped interval in the 0–360 frame: [minPos, maxNeg+360].
    let minLon = wrapped ? e.minPos : naiveMin;
    let maxLon = wrapped ? e.maxNeg + 360 : naiveMax;
    let minLat = e.minLat - COUNTRY_BOX_PAD_DEG;
    let maxLat = e.maxLat + COUNTRY_BOX_PAD_DEG;
    minLon -= COUNTRY_BOX_PAD_DEG; maxLon += COUNTRY_BOX_PAD_DEG;
    if (maxLon - minLon < COUNTRY_BOX_MIN_DEG) {
      const mid = (minLon + maxLon) / 2;
      minLon = mid - COUNTRY_BOX_MIN_DEG / 2; maxLon = mid + COUNTRY_BOX_MIN_DEG / 2;
    }
    if (maxLat - minLat < COUNTRY_BOX_MIN_DEG) {
      const mid = (minLat + maxLat) / 2;
      minLat = mid - COUNTRY_BOX_MIN_DEG / 2; maxLat = mid + COUNTRY_BOX_MIN_DEG / 2;
    }
    boxes[cc] = { box: { minLon, minLat, maxLon, maxLat }, wrapped, places: e.n };
  }
  const outPath = join(SCRATCH, "geonames-country-boxes.json");
  const payload = { generated: new Date().toISOString().slice(0, 10), boxes };
  writeFileSync(outPath, JSON.stringify(payload) + "\n");
  // The build-time gate (scripts/check-generated-places.mjs) re-validates the
  // checked-in chunks against THESE boxes on every build, so they are checked
  // in alongside the dataset (same content + provenance meta). Regenerating
  // the dataset refreshes this file; never hand-edit it.
  writeFileSync(
    join(REPO, "src", "game", "data", "geonames", "country-boxes.json"),
    JSON.stringify({
      meta: {
        source: "GeoNames allCountries dump (CC-BY 4.0) — same dump the dataset was built from",
        derivedFrom: "all GeoNames feature-class-P rows (this dump)",
        padDeg: COUNTRY_BOX_PAD_DEG,
        minDeg: COUNTRY_BOX_MIN_DEG,
        generated: payload.generated,
        note: "Reference geometry for the Hyderabad gate. Boxes are intentionally generous (padded).",
      },
      boxes,
    }) + "\n",
  );
  return boxes;
}

/** Into the box's frame for antimeridian-wrapped countries (cf. F6b normalizeLon). */
function normalizeLon(lon, entry) {
  return entry.wrapped && lon < 0 ? lon + 360 : lon;
}

function inBox(lon, lat, box) {
  return lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat;
}

// ---------------------------------------------------------------------------
// Hyderabad gate
//
// Veeresh's permanent hard rule: coordinates must match the claimed location.
// Two geometry levels:
//
//   "admin1-polygons" (preferred): $MERIDIAN_GATE_GEOJSON points at a Natural
//     Earth 50m admin-1 GeoJSON. State-edition places are checked with
//     point-in-polygon against their STATE's polygons; country/globe places
//     against ANY admin-1 polygon of their claimed country (grouped by iso_a2).
//     Bbox prefilters keep 100k+ checks fast.
//
//   "country-boxes-from-geonames": per-country boxes derived from ALL GeoNames
//     P rows (scratch, regenerated each run; see deriveCountryBoxes) for
//     country/globe places, and US state boxes parsed from src/game/regions.ts
//     STATES bounds (+0.15°) for state places. Every check is real; the level
//     used is recorded in the manifest and the report.
//
// The vendored src/map/data/ne-50m-admin-1.json covers only AU/BR/CA/CN/IN
// (not worldwide), so it cannot serve as gate geometry — hence the scratch
// file / derived-box design. To upgrade to true polygons, approve the
// Natural Earth 50m admin-1 download (audit in the build report) and set
// $MERIDIAN_GATE_GEOJSON to the extracted GeoJSON.
// ---------------------------------------------------------------------------

function pointInRing(lon, lat, ring) {
  // Even-odd ray casting. Handles holes correctly across all rings.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolys(lon, lat, polys) {
  for (const p of polys) {
    const b = p.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    for (const ring of p.rings) {
      if (pointInRing(lon, lat, ring)) return true;
    }
  }
  return false;
}

function ringsOf(geometry) {
  const rings = [];
  const pushPoly = (poly) => { for (const ring of poly) rings.push(ring); };
  if (geometry.type === "Polygon") pushPoly(geometry.coordinates);
  else if (geometry.type === "MultiPolygon") for (const poly of geometry.coordinates) pushPoly(poly);
  return rings;
}

function bboxOfRings(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

/**
 * Loads optional admin-1 polygon geometry. Returns null when
 * $MERIDIAN_GATE_GEOJSON is unset or the file is absent (bbox fallback).
 */
function loadGatePolygons() {
  if (!GATE_GEOJSON || !existsSync(GATE_GEOJSON)) return null;
  const gj = JSON.parse(readFileSync(GATE_GEOJSON, "utf8"));
  const byState = new Map();   // slug → [{bbox, rings}]
  const byCountry = new Map(); // iso_a2 → [{bbox, rings}]
  for (const f of gj.features ?? []) {
    const props = f.properties ?? {};
    if (!f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) continue;
    const rings = ringsOf(f.geometry);
    if (rings.length === 0) continue;
    const entry = { bbox: bboxOfRings(rings), rings };
    const iso2 = props.iso_a2;
    if (iso2) {
      if (!byCountry.has(iso2)) byCountry.set(iso2, []);
      byCountry.get(iso2).push(entry);
    }
    const code3166 = props.iso_3166_2; // e.g. "US-NE"
    if (iso2 === "US" && typeof code3166 === "string" && code3166.startsWith("US-")) {
      const slug = US_POSTAL_TO_SLUG[code3166.slice(3)];
      if (slug) {
        if (!byState.has(slug)) byState.set(slug, []);
        byState.get(slug).push(entry);
      }
    }
  }
  return { byState, byCountry };
}

// ---------------------------------------------------------------------------
// Mapping: GeoNames row → edition + regionId
// (US postal → 50 state slugs; DC → country/united-states; 12 ISO2 → country
// ids; everything else → globe/globe; unmappable rows are quarantined.)
// ---------------------------------------------------------------------------

function assignRegion(cc, admin1, geonameid) {
  if (cc === "US") {
    if (admin1 === "DC") return { edition: "country", regionId: "united-states" };
    const slug = US_POSTAL_TO_SLUG[admin1];
    if (slug) return { edition: "state", regionId: slug };
    return { quarantine: `unmappable-us-admin1 "${admin1}"` };
  }
  const countryId = COUNTRY_ISO2[cc];
  if (countryId) return { edition: "country", regionId: countryId };
  if (!cc) return { quarantine: "missing-country-code" };
  return { edition: "globe", regionId: "globe" };
}

/**
 * Cardinal position of a point inside a bounding box: "northern",
 * "southeastern", "central", … — the geographic anchoring the old
 * "populated place" blurb never gave.
 */
function cardinalInBox(lon, lat, box) {
  const lonF = (lon - box.minLon) / Math.max(1e-9, box.maxLon - box.minLon);
  const latF = (lat - box.minLat) / Math.max(1e-9, box.maxLat - box.minLat);
  const ns = latF > 0.67 ? "north" : latF < 0.33 ? "south" : "";
  const ew = lonF > 0.67 ? "east" : lonF < 0.33 ? "west" : "";
  if (ns && ew) return `${ns}${ew}ern`; // northeastern, southwestern…
  if (ns) return `${ns}ern`;
  if (ew) return `${ew}ern`;
  return "central";
}

/** Civic-status lead from the GeoNames feature code — capital and county
 *  seats are memorable facts the generic "populated place" buried. */
function leadFor(fcode, pop) {
  if (fcode === "PPLC") return { kind: "capital-country" };
  if (fcode === "PPLA") return { kind: "capital-admin1" };
  if (fcode === "PPLA2") return { kind: "county-seat" };
  return { kind: pop >= 50000 ? "city" : "town" };
}

function blurbFor({ name, admin1Name, countryName, pop, elev, fcode, lon, lat, box, notable }) {
  const popStr = Number(pop).toLocaleString("en-US");
  const where = admin1Name ? `${admin1Name}, ${countryName}` : countryName;
  const lead = leadFor(fcode, pop);
  let b;
  if (lead.kind === "capital-country") {
    b = `${name} is the capital of ${countryName} (population ~${popStr}).`;
  } else if (lead.kind === "capital-admin1") {
    b = `${name} is the capital of ${where} (population ~${popStr}).`;
  } else if (lead.kind === "county-seat") {
    const card = box ? ` in ${cardinalInBox(lon, lat, box)}` : "";
    b = `${name} is a county seat${card} ${where} (population ~${popStr}).`;
  } else {
    const card = box ? `${cardinalInBox(lon, lat, box)} ` : "";
    b = `${name} is a ${lead.kind} in ${card}${where} (population ~${popStr}).`;
  }
  if (elev !== "" && elev !== undefined && Number.isFinite(Number(elev))) {
    b += ` It sits at ~${Number(elev).toLocaleString("en-US")} m elevation.`;
  }
  if (notable) b += ` ${notable}`;
  return b;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const dumpPath = join(SCRATCH, "allCountries.txt");
  if (!existsSync(dumpPath)) {
    console.error(`missing dump: ${dumpPath} — extract allCountries.zip into $MERIDIAN_GEONAMES_SCRATCH first`);
    process.exit(1);
  }

  const countryNames = loadCountryNames();
  const admin1Names = loadAdmin1Names();
  const stateBoxes = loadStateBoxes();
  // Curated memorable facts for notable places (keyed by geonameid), merged
  // into blurbs below. Keys starting with "_" are file comments, not places.
  const notableNotes = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "notable-notes.json"), "utf8"),
  );
  const notableCount = Object.keys(notableNotes).filter((k) => !k.startsWith("_")).length;
  console.log(`loaded ${notableCount} notable-place notes`);
  console.log("deriving per-country gate boxes from all GeoNames P rows…");
  const tBox = Date.now();
  const boxes = await deriveCountryBoxes(dumpPath);
  console.log(`  …${Object.keys(boxes).length} country boxes in ${((Date.now() - tBox) / 1000).toFixed(0)}s`);
  const gatePolys = loadGatePolygons();
  const gateLevel = gatePolys ? "admin1-polygons" : "country-boxes-from-geonames";

  // Sanity: the postal→slug table must cover exactly the 50 game states and
  // every state must have gate geometry.
  const slugs = new Set(Object.values(US_POSTAL_TO_SLUG));
  if (slugs.size !== 50) throw new Error(`postal table covers ${slugs.size} states, expected 50`);
  const boxSlugs = new Set(Object.keys(stateBoxes));
  if (boxSlugs.size !== 50 || ![...slugs].every((s) => boxSlugs.has(s))) {
    throw new Error(`regions.ts parse yielded ${boxSlugs.size} states; postal table mismatch`);
  }
  if (gatePolys) {
    const missing = [...slugs].filter((s) => !gatePolys.byState.has(s));
    if (missing.length > 0) throw new Error(`gate GeoJSON lacks US state polygons: ${missing.join(", ")}`);
  }

  const quarantine = new Map(); // reason → {count, samples: [id,...]}
  const q = (reason, id) => {
    let e = quarantine.get(reason);
    if (!e) { e = { count: 0, samples: [] }; quarantine.set(reason, e); }
    e.count++;
    if (e.samples.length < 10) e.samples.push(id);
  };

  const byDedupKey = new Map(); // dedupKey → place (keeps highest pop, tie → lowest geonameid)
  const perRegion = new Map();  // regionId → {edition, count}
  let rawRows = 0, keptRows = 0, dupeDrops = 0;

  const rl = createInterface({ input: createReadStream(dumpPath) });
  for await (const line of rl) {
    if (!line) continue;
    rawRows++;
    const c = line.split("\t");
    if (c[6] !== "P") continue; // feature class: populated places only
    const pop = Number(c[14]);
    if (!Number.isFinite(pop) || pop < POP_THRESHOLD) continue;

    const geonameid = c[0];
    const name = c[1];
    const lat = Number(c[4]);
    const lon = Number(c[5]);
    const cc = c[8];
    const admin1 = c[10];
    const id = `gn-${geonameid}`;

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      q("bad-coordinates-or-name", id);
      continue;
    }

    // --- mapping (fail loudly: unmappable rows are quarantined, never dropped)
    const a = assignRegion(cc, admin1, geonameid);
    if (a.quarantine) { q(a.quarantine, id); continue; }
    const { edition, regionId } = a;

    // --- reference names for the blurb (GeoNames fields only). City-states
    // and small territories often have no admin1 detail in GeoNames — fall
    // back to a country-only blurb rather than dropping real places.
    const countryName = countryNames.get(cc);
    if (!countryName) { q(`unknown-country-name "${cc}"`, id); continue; }
    const admin1Name = admin1Names.get(`${cc}.${admin1}`) ?? null;

    // --- Hyderabad gate: coordinates must match the claimed location
    let gateOk;
    if (gatePolys) {
      if (edition === "state") {
        gateOk = pointInPolys(lon, lat, gatePolys.byState.get(regionId) ?? []);
      } else {
        const polys = gatePolys.byCountry.get(cc);
        if (!polys) { q(`no-gate-polygons-for "${cc}"`, id); continue; }
        gateOk = pointInPolys(lon, lat, polys);
      }
    } else if (edition === "state") {
      gateOk = inBox(lon, lat, stateBoxes[regionId]);
    } else {
      const entry = boxes[cc];
      if (!entry) { q(`no-reference-box-for "${cc}"`, id); continue; }
      gateOk = inBox(normalizeLon(lon, entry), lat, entry.box);
    }
    if (!gateOk) { q(`hyderabad-gate-reject (${edition}/${regionId})`, id); continue; }

    keptRows++;
    // Cardinal box for the blurb: the state's box for state-edition rows,
    // the country's box otherwise (lon normalized for antimeridian wrap).
    const cardBox =
      edition === "state" && stateBoxes[regionId]
        ? stateBoxes[regionId]
        : boxes[cc]?.box ?? null;
    const cardLon = edition === "state" ? lon : normalizeLon(lon, boxes[cc]);
    const notable = notableNotes[geonameid];
    const place = {
      id, name, lon, lat,
      blurb: blurbFor({
        name, admin1Name, countryName, pop,
        elev: c[15], fcode: c[7], lon: cardLon, lat,
        box: cardBox, notable: notable?.note,
      }),
      // wiki slug travels so the app can attribute the notable note to
      // Wikipedia (GeoNames stays credited app-wide in the map footer).
      ...(notable ? { wiki: notable.wiki } : {}),
      // iso2 is the gate key: the build-time gate (scripts/check-generated-places.mjs)
      // re-validates every shipped place against the derived country box for
      // its own country code, so the code must travel with the record.
      iso2: cc,
      edition, regionId, _pop: pop, _gid: Number(geonameid),
    };

    // --- dedup: geonameid is unique; also drop exact name+rounded-coord dupes
    const dk = `${name.toLowerCase()}|${lon.toFixed(4)}|${lat.toFixed(4)}`;
    const prev = byDedupKey.get(dk);
    if (!prev) {
      byDedupKey.set(dk, place);
    } else {
      dupeDrops++;
      if (place._pop > prev._pop || (place._pop === prev._pop && place._gid < prev._gid)) {
        byDedupKey.set(dk, place);
      }
      q("duplicate-name-coords", place._pop >= prev._pop ? prev.id : place.id);
    }
  }

  const places = [...byDedupKey.values()].sort((x, y) => x._gid - y._gid);
  for (const p of places) {
    let e = perRegion.get(p.regionId);
    if (!e) { e = { edition: p.edition, count: 0 }; perRegion.set(p.regionId, e); }
    e.count++;
    delete p._pop; delete p._gid;
  }

  if (places.length < MIN_SHIPPED) {
    console.error(
      `THRESHOLD FAILURE: shipped ${places.length.toLocaleString("en-US")} < ${MIN_SHIPPED.toLocaleString("en-US")} minimum ` +
      `(threshold ≥${POP_THRESHOLD}). Lower the threshold and re-run — nothing was written.`,
    );
    process.exit(1);
  }

  // --- emit chunks + manifest
  mkdirSync(OUT_DIR, { recursive: true });
  const generated = new Date().toISOString().slice(0, 10);
  let totalBytes = 0;
  const manifestRegions = {};
  for (const [regionId, { edition, count }] of [...perRegion.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const chunkPlaces = places.filter((p) => p.regionId === regionId);
    const chunk = {
      meta: {
        source: "GeoNames (CC-BY 4.0)",
        regionId, edition, count,
        generated,
        gate: "hyderabad",
        gateGeometry: gateLevel,
        populationThreshold: POP_THRESHOLD,
      },
      places: chunkPlaces,
    };
    const json = JSON.stringify(chunk) + "\n";
    const path = join(OUT_DIR, `${regionId}.json`);
    writeFileSync(path, json);
    const bytes = statSync(path).size;
    totalBytes += bytes;
    manifestRegions[regionId] = { edition, count, bytes };
  }
  const manifest = {
    meta: {
      source: "GeoNames (CC-BY 4.0) — attribution required (see integration step)",
      generated,
      script: "scripts/build-geonames-dataset.mjs",
      populationThreshold: POP_THRESHOLD,
      gate: "hyderabad",
      gateGeometry: gateLevel,
      gateGeojson: GATE_GEOJSON,
      countryBoxes: {
        derivedFrom: "all GeoNames feature-class-P rows (this dump)",
        padDeg: COUNTRY_BOX_PAD_DEG,
        minDeg: COUNTRY_BOX_MIN_DEG,
        scratchFile: "geonames-country-boxes.json",
      },
      stateBoxes: {
        derivedFrom: "src/game/regions.ts STATES bounds",
        marginDeg: STATE_BOX_MARGIN_DEG,
      },
      total: places.length,
      chunkBytes: totalBytes,
      quarantine: Object.fromEntries(
        [...quarantine.entries()].map(([r, e]) => [r, { count: e.count, samples: e.samples }]),
      ),
      duplicatesDropped: dupeDrops,
      rawRows,
      keptRows,
    },
    regions: manifestRegions,
  };
  writeFileSync(join(dirname(OUT_DIR), "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // --- report
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\nGeoNames dataset build complete in ${mins} min (gate: ${gateLevel})`);
  console.log(`  raw rows:        ${rawRows.toLocaleString("en-US")}`);
  console.log(`  kept (P, pop ≥${POP_THRESHOLD}): ${keptRows.toLocaleString("en-US")}`);
  console.log(`  shipped:         ${places.length.toLocaleString("en-US")} (minimum ${MIN_SHIPPED.toLocaleString("en-US")})`);
  console.log(`  name+coord dupes dropped: ${dupeDrops.toLocaleString("en-US")}`);
  const qTotal = [...quarantine.values()].reduce((n, e) => n + e.count, 0);
  console.log(`  quarantined:     ${qTotal.toLocaleString("en-US")} across ${quarantine.size} reason(s)`);
  for (const [r, e] of [...quarantine.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`    - ${r}: ${e.count.toLocaleString("en-US")}  samples: ${e.samples.slice(0, 5).join(", ")}`);
  }
  console.log(`  regions:         ${perRegion.size} chunks, ${(totalBytes / 1048576).toFixed(1)} MB total`);
  const top = [...perRegion.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  console.log(`  top regions:     ${top.map(([r, e]) => `${r}=${e.count.toLocaleString("en-US")}`).join(", ")}`);
  console.log(`wrote ${perRegion.size} chunks + manifest.json`);
}

main().catch((err) => {
  console.error(`FATAL: ${err.stack ?? err}`);
  process.exit(1);
});
