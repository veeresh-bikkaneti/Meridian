/**
 * GeoNames place -> Wikidata QID join (the ID spine for the future fact pipeline).
 *
 * Reads every place in `src/game/data/geonames/chunks/*.json` and maps it to
 * its Wikidata QID, writing incremental, resumable results to
 * `.scratch/facts/qid-join.jsonl` (one JSON per line):
 *   { geonamesId, qid|null, method: "slug"|"search"|"unmatched", at }
 *
 * Two resolution paths, in order:
 *
 *   1. Slug path — places that already carry a Wikipedia `wiki` slug in the
 *      chunk, or a `title` in the wikipedia-enrichment crawl cache (matched
 *      status), resolve in batches of 50 via the Wikipedia Action API:
 *      `action=query&prop=pageprops&ppprop=wikibase_item&titles=...`.
 *
 *   2. Search fallback — places with no slug/title use
 *      `action=wbsearchentities` on Wikidata, then each candidate is VERIFIED
 *      before acceptance:
 *        - coordinate check: the entity's P625 must be within 25 km of the
 *          place's gate-verified lon/lat (haversine). Missing coords reject.
 *        - country sanity check: when the entity has P17, it must match the
 *          place's `iso2` (resolved lazily to a country QID via P298 SPARQL;
 *          skipped if that lookup fails).
 *
 * The crawler cache file is read-only here: never written, never deleted.
 *
 * Politeness: a polite User-Agent, ~1 request/second pacing, maxlag=5 on the
 * Wikipedia API, 30 s per-request timeouts with a few retries.
 *
 * Usage:
 *   node scripts/facts-qid-join.mjs --limit 200   # pilot run (first 200
 *                                                 # places, country-interleaved
 *                                                 # so a pilot mixes US + non-US)
 *   node scripts/facts-qid-join.mjs               # full run over all places
 *   node scripts/facts-qid-join.mjs report        # join rate from output file
 *
 * Resumable: IDs already in the output file are skipped on startup.
 *
 * node stdlib only — no dependencies.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");
const CRAWL_CACHE_PATH = join(REPO, ".scratch", "wikipedia-enrichment", "crawl-cache.jsonl");
export const OUT_DIR = join(REPO, ".scratch", "facts");
export const OUT_PATH = join(OUT_DIR, "qid-join.jsonl");

const USER_AGENT =
  "MeridianFacts/1.0 (research; https://github.com/veeresh-bikkaneti/Meridian)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WD_API = "https://www.wikidata.org/w/api.php";
const WD_SPARQL = "https://query.wikidata.org/sparql";
const entityDataUrl = (qid) => `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;

export const BATCH_TITLES = 50;
export const PACING_MS = 1000; // ~1 request/second, polite to the APIs
export const VERIFY_RADIUS_KM = 25;
const EARTH_RADIUS_KM = 6371.0088;
const SEARCH_CANDIDATES = 5; // top-N wbsearchentities candidates verified per place
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;

// ---------------------------------------------------------------------------
// Pure functions (importable for unit tests)
// ---------------------------------------------------------------------------

/** Great-circle distance in km (haversine). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Wikipedia slug ("Juneau,_Alaska", "Clio,_Alabama") -> canonical title
 * ("Juneau, Alaska", "Clio, Alabama"). Wikipedia titles use spaces.
 */
export function slugToTitle(slug) {
  return String(slug).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** {lat, lon} from a Wikidata entity's P625 claim, or null when absent. */
export function entityCoords(entity) {
  const v = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!v || typeof v.latitude !== "number" || typeof v.longitude !== "number") return null;
  return { lat: v.latitude, lon: v.longitude };
}

/** Country QIDs from a Wikidata entity's P17 claims ([] when none). */
export function entityCountries(entity) {
  const claims = entity?.claims?.P17 ?? [];
  const out = [];
  for (const c of claims) {
    const qid = c?.mainsnak?.datavalue?.value?.id;
    if (typeof qid === "string") out.push(qid);
  }
  return out;
}

/**
 * Verify one search candidate against a place before acceptance.
 * Returns { ok: true, km } or { ok: false, reason, km|null } where reason is
 * one of "missing-coords" | "too-far" | "country-mismatch".
 * `countryQid` null => country check skipped (lookup unavailable).
 */
export function verifyCandidate(place, entity, countryQid) {
  const coords = entityCoords(entity);
  if (!coords) return { ok: false, reason: "missing-coords", km: null };
  const km = haversineKm(place.lat, place.lon, coords.lat, coords.lon);
  if (km > VERIFY_RADIUS_KM) return { ok: false, reason: "too-far", km };
  const countries = entityCountries(entity);
  if (countries.length > 0 && countryQid && !countries.includes(countryQid)) {
    return { ok: false, reason: "country-mismatch", km };
  }
  return { ok: true, km };
}

/**
 * Parse resume JSONL lines -> { done: Set<geonamesId>, malformed: count }.
 * Malformed lines are counted and skipped, never fatal.
 */
export function parseResume(lines) {
  const done = new Set();
  let malformed = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const rec = JSON.parse(t);
      if (rec && typeof rec.geonamesId === "string") done.add(rec.geonamesId);
      else malformed++;
    } catch {
      malformed++;
    }
  }
  return { done, malformed };
}

/**
 * Parse crawl-cache lines -> { titles: Map<geonamesId, title>, matched, errors,
 * malformed }. Only "matched" records WITH a title are usable. Read-only:
 * the running crawler may have this file open for append.
 */
export function parseCrawlCache(lines) {
  const titles = new Map();
  let matched = 0;
  let errors = 0;
  let malformed = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let rec;
    try {
      rec = JSON.parse(t);
    } catch {
      malformed++;
      continue;
    }
    if (rec?.status === "matched" && typeof rec.title === "string" && rec.title.trim()) {
      matched++;
      // Last write wins: the crawler never rewrites, but stay deterministic.
      if (!titles.has(rec.id)) titles.set(rec.id, rec.title);
    } else if (rec?.status === "error") {
      errors++;
    }
  }
  return { titles, matched, errors, malformed };
}

/**
 * Round-robin interleave: [[a1,a2],[b1],[c1,c2,c3]] -> [a1,b1,c1,a2,c2,c3].
 * Used so a --limit pilot walks across chunk files (countries) instead of
 * taking 200 places from the first file alphabetically.
 */
export function interleaveRoundRobin(arrays) {
  const out = [];
  const queues = arrays.map((a) => [...a]);
  for (;;) {
    let took = false;
    for (const q of queues) {
      if (q.length > 0) {
        out.push(q.shift());
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

/** CLI args -> { command: "run"|"report", limit: number|null }. */
export function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("report")) return { command: "report", limit: null };
  let limit = null;
  const li = args.indexOf("--limit");
  if (li !== -1) {
    const n = Number(args[li + 1]);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`--limit needs a positive integer, got "${args[li + 1]}"`);
    }
    limit = n;
  }
  return { command: "run", limit };
}

// ---------------------------------------------------------------------------
// IO: loading inputs
// ---------------------------------------------------------------------------

/**
 * All places grouped per chunk file: [[place,...], ...] with chunk files in
 * sorted order. place = { id, name, lon, lat, iso2, wiki? }.
 */
export function loadChunks() {
  const files = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => {
    const data = JSON.parse(readFileSync(join(CHUNKS_DIR, f), "utf8"));
    return (data.places ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      lon: p.lon,
      lat: p.lat,
      iso2: p.iso2,
      wiki: typeof p.wiki === "string" && p.wiki ? p.wiki : null,
      chunk: f,
    }));
  });
}

export function loadCrawlTitles() {
  if (!existsSync(CRAWL_CACHE_PATH)) return { titles: new Map(), matched: 0, errors: 0, malformed: 0 };
  const raw = readFileSync(CRAWL_CACHE_PATH, "utf8").split("\n");
  return parseCrawlCache(raw);
}

export function loadDone() {
  if (!existsSync(OUT_PATH)) return { done: new Set(), malformed: 0 };
  return parseResume(readFileSync(OUT_PATH, "utf8").split("\n"));
}

/**
 * Ordered work list: [{ place, title }] where title is the Wikipedia title to
 * resolve via the slug path, or null when the place needs the search fallback.
 *
 * Ordering: alternate US / non-US (each internally round-robin across chunk
 * files), so a --limit pilot is a genuine mix of US + non-US places instead
 * of being swallowed by the biggest chunks. Truncated to `limit` when set.
 */
export function buildWorkList(chunkGroups, crawlTitles, done, limit) {
  const toWork = (p) => ({
    place: p,
    title: p.wiki ? slugToTitle(p.wiki) : (crawlTitles.get(p.id) ?? null),
  });
  const usGroups = chunkGroups.map((places) =>
    places.filter((p) => !done.has(p.id) && p.iso2 === "US").map(toWork),
  );
  const otherGroups = chunkGroups.map((places) =>
    places.filter((p) => !done.has(p.id) && p.iso2 !== "US").map(toWork),
  );
  const us = interleaveRoundRobin(usGroups);
  const other = interleaveRoundRobin(otherGroups);
  const all = interleaveRoundRobin([us, other]);
  return limit == null ? all : all.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Network (not unit-tested; exercised only in live runs)
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isNetError(err) {
  return (
    err instanceof TypeError ||
    err?.name === "AbortError" ||
    /fetch failed|network|econn|enotfound|etimedout|eai_again/i.test(String(err?.message ?? err))
  );
}

async function fetchJsonOnce(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: ctl.signal });
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      await sleep(Math.min(60, retryAfter || 5) * 1000);
      throw new Error(`throttled HTTP ${res.status}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 140)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** fetchJson with retries; throws after MAX_ATTEMPTS (run aborts, resume keeps progress). */
async function fetchJson(url) {
  let attempt = 0;
  for (;;) {
    try {
      return await fetchJsonOnce(url);
    } catch (err) {
      attempt++;
      if (attempt >= MAX_ATTEMPTS || !isNetError(err)) throw err;
      await sleep(2000 * attempt);
    }
  }
}

// One shared pacing gate: at most one request start per PACING_MS.
let lastStart = 0;
async function pacedFetchJson(url) {
  const wait = PACING_MS - (Date.now() - lastStart);
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
  return fetchJson(url);
}

/**
 * Slug path: resolve up to BATCH_TITLES Wikipedia titles to Wikidata QIDs in
 * one call. Returns Map<title, qid|null>.
 */
export async function resolveQidsByTitles(titles) {
  const params = new URLSearchParams({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    titles: titles.join("|"),
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
  const data = await pacedFetchJson(`${WIKI_API}?${params}`);
  const out = new Map();
  for (const page of data?.query?.pages ?? []) {
    if (page?.missing) {
      out.set(page.title, null);
    } else {
      out.set(page.title, page?.pageprops?.wikibase_item ?? null);
    }
  }
  return out;
}

/** Search fallback: top candidates [{ qid, label, description }]. */
export async function searchEntities(name) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: name,
    language: "en",
    limit: String(SEARCH_CANDIDATES),
    type: "item",
    format: "json",
    formatversion: "2",
  });
  const data = await pacedFetchJson(`${WD_API}?${params}`);
  return (data?.search ?? [])
    .filter((c) => typeof c?.id === "string")
    .map((c) => ({ qid: c.id, label: c.label ?? "", description: c.description ?? "" }));
}

/** Full entity record (claims incl. P625/P17), or null. */
export async function entityData(qid) {
  const data = await pacedFetchJson(entityDataUrl(qid));
  return data?.entities?.[qid] ?? null;
}

const countryQidCache = new Map();

/**
 * Extract a QID from a WDQS `?item` binding URI.
 * WDQS returns http://www.wikidata.org/entity/Q30 (not /wiki/…).
 */
export function parseCountryQid(sparqlData) {
  const uri = sparqlData?.results?.bindings?.[0]?.item?.value;
  const m = typeof uri === "string" ? uri.match(/\/entity\/(Q\d+)$/) : null;
  return m ? m[1] : null;
}

/**
 * iso2 -> Wikidata country QID via P297 (ISO 3166-1 alpha-2). Note: P298 is
 * the alpha-3 code, not alpha-2. Null on failure => country check skipped.
 */
export async function resolveCountryQid(iso2) {
  if (countryQidCache.has(iso2)) return countryQidCache.get(iso2);
  const sparql = `SELECT ?item WHERE { ?item wdt:P297 "${iso2}" } LIMIT 1`;
  const url = `${WD_SPARQL}?${new URLSearchParams({ query: sparql, format: "json" })}`;
  let qid = null;
  try {
    qid = parseCountryQid(await pacedFetchJson(url));
  } catch (err) {
    console.error(`[qid-join] country lookup for ${iso2} failed (${err.message}); country check skipped`);
  }
  countryQidCache.set(iso2, qid);
  return qid;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function writeResult(place, qid, method) {
  const rec = { geonamesId: place.id, qid: qid ?? null, method, at: new Date().toISOString() };
  appendFileSync(OUT_PATH, JSON.stringify(rec) + "\n");
  return rec;
}

async function run(limit) {
  mkdirSync(OUT_DIR, { recursive: true });
  const chunkGroups = loadChunks();
  const totalPlaces = chunkGroups.reduce((n, g) => n + g.length, 0);
  const crawl = loadCrawlTitles();
  const { done, malformed } = loadDone();
  if (malformed > 0) console.error(`[qid-join] skipped ${malformed} malformed resume lines`);
  if (crawl.malformed > 0) console.error(`[qid-join] skipped ${crawl.malformed} malformed crawl-cache lines`);

  const work = buildWorkList(chunkGroups, crawl.titles, done, limit);
  console.error(
    `[qid-join] places=${totalPlaces} done=${done.size} crawl-titles=${crawl.titles.size} work=${work.length}`,
  );
  if (work.length === 0) {
    console.error("[qid-join] nothing to do");
    return;
  }

  const stats = { slug: 0, search: 0, unmatched: 0 };
  const t0 = Date.now();

  // --- Slug path: batch consecutive slug-title places 50 per request. ---
  const searchQueue = [];
  const titleToPlaces = new Map();
  for (const w of work) {
    if (w.title) {
      if (!titleToPlaces.has(w.title)) titleToPlaces.set(w.title, []);
      titleToPlaces.get(w.title).push(w);
    } else {
      searchQueue.push(w);
    }
  }
  const titles = [...titleToPlaces.keys()];
  for (let i = 0; i < titles.length; i += BATCH_TITLES) {
    const batch = titles.slice(i, i + BATCH_TITLES);
    const resolved = await resolveQidsByTitles(batch);
    for (const title of batch) {
      const qid = resolved.get(title);
      for (const w of titleToPlaces.get(title)) {
        if (qid) {
          writeResult(w.place, qid, "slug");
          stats.slug++;
        } else {
          searchQueue.push(w); // slug miss falls through to the search path
        }
      }
    }
    const doneSoFar = stats.slug + stats.search + stats.unmatched;
    if ((i / BATCH_TITLES) % 10 === 0 || i + BATCH_TITLES >= titles.length) {
      console.error(
        `[qid-join] slug batches ${Math.min(i + BATCH_TITLES, titles.length)}/${titles.length} ` +
          `slug=${stats.slug} queued-for-search=${searchQueue.length - doneSoFar}`,
      );
    }
  }

  // --- Search path: verified wbsearchentities fallback. ---
  let n = 0;
  for (const w of searchQueue) {
    n++;
    const { place } = w;
    let accepted = null;
    try {
      const candidates = await searchEntities(place.name);
      for (const c of candidates) {
        const entity = await entityData(c.qid);
        if (!entity) continue;
        const countryQid = await resolveCountryQid(place.iso2);
        const verdict = verifyCandidate(place, entity, countryQid);
        if (verdict.ok) {
          accepted = { qid: c.qid, km: verdict.km, label: c.label };
          break;
        }
        if (n <= 10 || process.env.QID_JOIN_VERBOSE) {
          console.error(
            `[qid-join] reject ${place.name} -> ${c.qid} (${c.label}): ${verdict.reason}` +
              (verdict.km != null ? ` ${verdict.km.toFixed(1)}km` : ""),
          );
        }
      }
    } catch (err) {
      // Persistent network/API failure: abort the run; everything written so
      // far is resumable, nothing is recorded for this place.
      console.error(`[qid-join] ABORT after ${n}/${searchQueue.length} search places: ${err.message}`);
      throw err;
    }
    if (accepted) {
      writeResult(place, accepted.qid, "search");
      stats.search++;
    } else {
      writeResult(place, null, "unmatched");
      stats.unmatched++;
    }
    if (n % 25 === 0 || n === searchQueue.length) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.error(
        `[qid-join] search ${n}/${searchQueue.length} ` +
          `slug=${stats.slug} search=${stats.search} unmatched=${stats.unmatched} ${el}s`,
      );
    }
  }

  const total = stats.slug + stats.search + stats.unmatched;
  console.error(
    `[qid-join] DONE ${total} places: slug=${stats.slug} search=${stats.search} ` +
      `unmatched=${stats.unmatched} join-rate=${(((stats.slug + stats.search) / total) * 100).toFixed(1)}%`,
  );
}

export function summarize(outPath = OUT_PATH) {
  const { done, malformed } = parseResume(readFileSync(outPath, "utf8").split("\n"));
  const byMethod = { slug: 0, search: 0, unmatched: 0 };
  for (const line of readFileSync(outPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const rec = JSON.parse(t);
      if (rec.method in byMethod) byMethod[rec.method]++;
    } catch {
      // counted via malformed above
    }
  }
  const total = done.size;
  const joined = byMethod.slug + byMethod.search;
  const lines = [
    `qid-join report (${outPath})`,
    `  recorded:   ${total}${malformed ? ` (${malformed} malformed skipped)` : ""}`,
    `  slug:       ${byMethod.slug}`,
    `  search:     ${byMethod.search}`,
    `  unmatched:  ${byMethod.unmatched}`,
    `  join rate:  ${total ? ((joined / total) * 100).toFixed(1) : "n/a"}% (${joined}/${total})`,
  ];
  return lines.join("\n");
}

export async function main(argv) {
  const { command, limit } = parseArgs(argv);
  if (command === "report") {
    if (!existsSync(OUT_PATH)) {
      console.log("no output file yet — run the join first");
      return;
    }
    console.log(summarize());
    return;
  }
  await run(limit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).catch((err) => {
    console.error(`[qid-join] fatal: ${err?.stack ?? err}`);
    process.exit(1);
  });
}
