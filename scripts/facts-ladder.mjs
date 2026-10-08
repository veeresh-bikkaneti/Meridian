#!/usr/bin/env node
/**
 * facts-ladder.mjs — Worker 1 (build-time): merge all Phase 1 fact outputs
 * into chunk places as an optional `fact` field.
 *
 * Per-place precedence (first hit wins):
 *   1. Wikidata referenced facts — P138 (named_after) + P571 (inception)
 *      composed into ONE story sentence. Only statements with
 *      hasReference === true are used (Veeresh's traceability bar).
 *   2. Wiki-text triples — the verbatim Wikipedia source sentence.
 *   3. EB1911 sentences (UK/IE places; needsReview sentences are skipped).
 *   4. The existing `history` hook sentence already in the chunk → kind 'hook'.
 *   5. Generic blurb (no `fact` field written).
 *
 * Every composed fact (kinds wikidata/wikitext/eb1911) MUST pass
 * validateFact() before merge. Failures are rejected LOUDLY (reported per
 * place with the violation codes) and the place falls through to the next
 * rung — never silently downgraded.
 *
 * Wikidata composition notes:
 *   - P571 "inception" is verbalized as "Founded in YEAR" per the approved
 *     template. P571 can drift ("first written attestation", e.g. Romania),
 *     so the year is dropped when qualifiers signal attestation
 *     ("no later than", "oldest predecessor") or hedging ("circa",
 *     "probably") — the place then composes from named_after alone.
 *   - A bare year with no honoree is a date anchor, not a story (and fails
 *     the 20-char validator floor), so year-only Wikidata yields no fact.
 *   - The validator's "source" is the canonical verbalization of the two
 *     referenced statements; the compose is a deterministic template merge,
 *     so the validator's real work here is the length / banned-pattern /
 *     inversion / scope-word / date-binding gates.
 *
 * fact field written to chunks:
 *   { text, kind: 'wikidata'|'wikitext'|'eb1911'|'hook',
 *     source: 'Wikidata'|'Wikipedia'|'EB1911', qid?, href? }
 * `qid` is carried for wikidata (card attribution link); `href` for eb1911
 * (the Wikisource page URL).
 *
 * Usage:
 *   node scripts/facts-ladder.mjs run --chunks australia,arkansas [--dry-run] [--fetch-missing] [--join-limit 150]
 *   node scripts/facts-ladder.mjs report [--chunks australia,arkansas]
 *
 * `run` requires --chunks (a full merge is a deliberate --all decision).
 * --fetch-missing runs the qid-join building blocks + the Wikidata extractor
 * for places in the target chunks not yet covered (network; polite pacing).
 * --dry-run computes and reports without writing chunk files.
 *
 * Node stdlib only. Imports the Phase 1 modules (no network in unit tests).
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateFact } from "./facts-validate.mjs";
import { isSelfName, placeBaseName, MAX_YEAR } from "./facts-wiki-text.mjs";
import {
  readRecords as readWikidataRecords,
  readProcessedQids as readWikidataQids,
  extract as wikidataExtract,
  chunkArray,
} from "./facts-wikidata-extract.mjs";
import {
  loadChunks as loadJoinChunks,
  loadCrawlTitles,
  loadDone as loadJoinDone,
  buildWorkList,
  resolveQidsByTitles,
  searchEntities,
  entityData,
  resolveCountryQid,
  verifyCandidate,
  slugToTitle,
  BATCH_TITLES,
  OUT_PATH as QID_JOIN_PATH,
} from "./facts-qid-join.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");
const FACTS_DIR = join(REPO, ".scratch", "facts");
const WIKITEXT_PATH = join(FACTS_DIR, "wiki-text-facts.jsonl");
const EB1911_PATH = join(FACTS_DIR, "eb1911-facts.jsonl");

export const FACT_KINDS = ["wikidata", "wikitext", "eb1911", "hook"];
export const MIN_YEAR = 1000;

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip torn lines */ }
  }
  return out;
}

/** geonamesId -> qid (joined only; unmatched/null rows excluded). */
export function indexQidJoin(rows = readJsonl(QID_JOIN_PATH)) {
  const m = new Map();
  for (const r of rows) {
    if (r && typeof r.geonamesId === "string" && typeof r.qid === "string" && r.qid) {
      m.set(r.geonamesId, r.qid);
    }
  }
  return m;
}

/**
 * qid -> referenced-only statement records. Unreferenced statements are
 * dropped here — the ladder never presents them as facts.
 */
export function indexWikidata(records = readWikidataRecords()) {
  const m = new Map();
  for (const r of records) {
    if (!r || r.hasReference !== true || typeof r.qid !== "string") continue;
    if (!m.has(r.qid)) m.set(r.qid, []);
    m.get(r.qid).push(r);
  }
  return m;
}

/** geonamesId -> wiki-text fact triples. */
export function indexWikiText(rows = readJsonl(WIKITEXT_PATH)) {
  const m = new Map();
  for (const r of rows) {
    if (!r || typeof r.geonamesId !== "string" || typeof r.sentence !== "string") continue;
    if (!m.has(r.geonamesId)) m.set(r.geonamesId, []);
    m.get(r.geonamesId).push(r);
  }
  return m;
}

/** geonamesId -> eb1911 mined sentences (needsReview rows excluded). */
export function indexEb1911(rows = readJsonl(EB1911_PATH)) {
  const m = new Map();
  for (const r of rows) {
    if (!r || typeof r.geonamesId !== "string" || typeof r.sentence !== "string") continue;
    if (r.needsReview === true) continue;
    if (!m.has(r.geonamesId)) m.set(r.geonamesId, []);
    m.get(r.geonamesId).push(r);
  }
  return m;
}

export function loadInputs() {
  return {
    qidByGeonames: indexQidJoin(),
    wikidataByQid: indexWikidata(),
    wikiTextByGeonames: indexWikiText(),
    eb1911ByGeonames: indexEb1911(),
  };
}

// ---------------------------------------------------------------------------
// Wikidata rung: pick + compose + validate
// ---------------------------------------------------------------------------

const YEAR_RE = /^(-?\d{1,4})-\d{2}-\d{2}T/;

/** Wikidata ISO time -> year, or null when unparseable / out of range. */
export function parseWikidataYear(rawValue) {
  const m = YEAR_RE.exec(String(rawValue ?? ""));
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) return null;
  return y;
}

const ATTESTATION_RE = /no later than|oldest predecessor|first mention|attest|earliest/i;
const HEDGE_RE = /circa|approximately|probably|around|uncertain/i;

const qualifierText = (rec) =>
  (rec.qualifiers ?? []).map((q) => `${q.property ?? ""} ${q.value ?? ""}`).join(" | ");

/**
 * Choose the named_after honoree and inception year from referenced records.
 * Returns { person, year, notes } where notes explains dropped pieces
 * (attestation/hedge/self-name) for the run report.
 */
export function pickWikidataParts(place, records) {
  const notes = [];
  const placeBase = placeBaseName(place.name ?? "");
  // P138: referenced, non-empty label; entity honorees first (a QID value is
  // far more likely to be a real person/place than a bare literal).
  const named = (records ?? [])
    .filter((r) => r.property === "P138" && typeof r.valueLabel === "string" && r.valueLabel.trim())
    .sort((a, b) => Number(!!b.valueQid) - Number(!!a.valueQid));
  let person = null;
  for (const r of named) {
    const label = r.valueLabel.trim();
    if (label.length > 80) { notes.push(`p138-too-long:${label.slice(0, 30)}`); continue; }
    if (isSelfName(label, placeBase)) { notes.push(`p138-self-name:${label}`); continue; }
    person = label;
    break;
  }
  // P571: first referenced inception whose year survives the guards.
  let year = null;
  for (const r of (records ?? []).filter((r) => r.property === "P571")) {
    const y = parseWikidataYear(r.rawValue);
    if (y == null) { notes.push("p571-unparseable-year"); continue; }
    const qt = qualifierText(r);
    if (ATTESTATION_RE.test(qt)) { notes.push(`p571-attestation-dropped:${y}`); continue; }
    if (HEDGE_RE.test(qt)) { notes.push(`p571-hedged-dropped:${y}`); continue; }
    year = y;
    break;
  }
  return { person, year, notes };
}

/**
 * Compose the single story sentence from the picked parts, and build the
 * validator's source sentence (the canonical verbalization of the two
 * referenced statements the compose is deterministically merged from).
 * Returns null when there is no story (no honoree, or year-only).
 */
export function composeWikidataFact(person, year) {
  if (!person) return null; // year-only is a date anchor, not a story
  if (year != null) {
    return {
      text: `Founded in ${year} and named after ${person}.`,
      source: `Founded in ${year}. Named after ${person}.`,
    };
  }
  return {
    text: `Named after ${person}.`,
    source: `Named after ${person}.`,
  };
}

/**
 * Run the no-fabrication gate over a composed fact. Returns
 * { ok: true, fact } or { ok: false, violations } — the caller must treat a
 * rejection as rung failure (loud), never a silent downgrade.
 */
export function buildValidatedFact(kind, source, factDraft, composedText) {
  const violations = validateFact(factDraft, composedText);
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, fact: { text: composedText, kind, source } };
}

/** Rung 1: Wikidata. Returns { fact, rung } or { fact: null, rung, reason, notes }. */
export function wikidataRung(place, inputs) {
  const qid = inputs.qidByGeonames.get(place.id);
  if (!qid) return { fact: null, rung: "wikidata", reason: "no-qid" };
  const records = inputs.wikidataByQid.get(qid) ?? [];
  if (records.length === 0) return { fact: null, rung: "wikidata", reason: "no-referenced-statements" };
  const { person, year, notes } = pickWikidataParts(place, records);
  const composed = composeWikidataFact(person, year);
  if (!composed) {
    if (year != null) notes.push("year-only-dropped"); // a bare year is a date anchor, not a story
    return { fact: null, rung: "wikidata", reason: "no-usable-parts", notes };
  }
  const draft = { factType: "named_after", person, year, sentence: composed.source };
  const built = buildValidatedFact("wikidata", "Wikidata", draft, composed.text);
  if (!built.ok) {
    return { fact: null, rung: "wikidata", reason: "validator-rejected", violations: built.violations, notes };
  }
  return { fact: { ...built.fact, qid }, rung: "wikidata", notes };
}

// ---------------------------------------------------------------------------
// Wiki-text rung (verbatim Wikipedia sentences)
// ---------------------------------------------------------------------------

/** Rung 2: wiki-text triples. Attribution requires the chunk's wiki slug. */
export function wikitextRung(place, inputs) {
  const facts = inputs.wikiTextByGeonames.get(place.id) ?? [];
  if (facts.length === 0) return { fact: null, rung: "wikitext", reason: "none" };
  if (typeof place.wiki !== "string" || !place.wiki) {
    return { fact: null, rung: "wikitext", reason: "no-wiki-slug" };
  }
  const rejected = [];
  const ordered = [...facts].sort(
    (a, b) => (a.factType === "named_after" ? 0 : 1) - (b.factType === "named_after" ? 0 : 1),
  );
  for (const f of ordered) {
    const draft = { factType: f.factType, person: f.person, year: f.year, sentence: f.sentence };
    const built = buildValidatedFact("wikitext", "Wikipedia", draft, f.sentence);
    if (built.ok) return { fact: built.fact, rung: "wikitext" };
    rejected.push({ factType: f.factType, violations: built.violations });
  }
  return { fact: null, rung: "wikitext", reason: "validator-rejected", rejected };
}

// ---------------------------------------------------------------------------
// EB1911 rung (verbatim Wikisource sentences)
// ---------------------------------------------------------------------------

/** Rung 3: EB1911 sentences. needsReview rows never reach this index. */
export function eb1911Rung(place, inputs) {
  const facts = inputs.eb1911ByGeonames.get(place.id) ?? [];
  if (facts.length === 0) return { fact: null, rung: "eb1911", reason: "none" };
  const rejected = [];
  for (const f of facts) {
    const draft = { factType: "event", sentence: f.sentence };
    const built = buildValidatedFact("eb1911", "EB1911", draft, f.sentence);
    if (built.ok) return { fact: { ...built.fact, href: f.sourceUrl }, rung: "eb1911" };
    rejected.push({ violations: built.violations });
  }
  return { fact: null, rung: "eb1911", reason: "validator-rejected", rejected };
}

// ---------------------------------------------------------------------------
// Hook rung (existing history sentence — already merge-gated at enrich time)
// ---------------------------------------------------------------------------

/** Rung 4: the chunk's own history hook, verbatim. No re-validation needed. */
export function hookRung(place) {
  if (typeof place.history === "string" && place.history.length > 0) {
    return { fact: { text: place.history, kind: "hook", source: "Wikipedia" }, rung: "hook" };
  }
  return { fact: null, rung: "hook", reason: "none" };
}

// ---------------------------------------------------------------------------
// Ladder: first winning rung
// ---------------------------------------------------------------------------

/**
 * The winning fact for one place, or { fact: null, ... } when nothing above
 * the blurb applies. `trace` collects every rung's miss reason for reports.
 */
export function factForPlace(place, inputs) {
  const trace = [];
  const wd = wikidataRung(place, inputs);
  trace.push({ rung: "wikidata", reason: wd.reason ?? "hit", notes: wd.notes });
  if (wd.fact) return { fact: wd.fact, rung: "wikidata", trace };
  const wt = wikitextRung(place, inputs);
  trace.push({ rung: "wikitext", reason: wt.reason ?? "hit", rejected: wt.rejected });
  if (wt.fact) return { fact: wt.fact, rung: "wikitext", trace };
  const eb = eb1911Rung(place, inputs);
  trace.push({ rung: "eb1911", reason: eb.reason ?? "hit", rejected: eb.rejected });
  if (eb.fact) return { fact: eb.fact, rung: "eb1911", trace };
  const hk = hookRung(place);
  trace.push({ rung: "hook", reason: hk.reason ?? "hit" });
  if (hk.fact) return { fact: hk.fact, rung: "hook", trace };
  return { fact: null, rung: "none", trace };
}

/** Card attribution for a merged fact (mirrored in generated-places.ts). */
export function factAttribution(fact, placeWiki) {
  switch (fact.kind) {
    case "wikidata":
      return { label: "Wikidata", href: `https://www.wikidata.org/wiki/${fact.qid}` };
    case "eb1911":
      return { label: "EB1911", href: fact.href };
    case "wikitext":
    case "hook":
    default:
      return { label: "GeoNames · Wikipedia", href: `https://en.wikipedia.org/wiki/${placeWiki}` };
  }
}

// ---------------------------------------------------------------------------
// Chunk merge
// ---------------------------------------------------------------------------

function chunkPath(chunkId) {
  return join(CHUNKS_DIR, `${chunkId}.json`);
}

/** Insert `fact` after `history` (or after `blurb`) so the record reads naturally. */
export function withFact(place, fact) {
  const out = {};
  let inserted = false;
  for (const [k, v] of Object.entries(place)) {
    out[k] = v;
    if (!inserted && (k === "history" || (k === "blurb" && !("history" in place)))) {
      out.fact = fact;
      inserted = true;
    }
  }
  if (!inserted) out.fact = fact;
  return out;
}

/**
 * Merge facts into one chunk file. Returns per-rung counts + rejections.
 * With dryRun, computes everything but writes nothing.
 */
export function mergeChunk(chunkId, inputs, { dryRun = false } = {}) {
  const path = chunkPath(chunkId);
  const chunk = JSON.parse(readFileSync(path, "utf8"));
  const counts = { wikidata: 0, wikitext: 0, eb1911: 0, hook: 0, none: 0 };
  const rejections = [];
  let wrote = 0;
  chunk.places = chunk.places.map((place) => {
    const { fact, rung, trace } = factForPlace(place, inputs);
    counts[rung]++;
    // Loud rejections: validator failures and dropped Wikidata parts are
    // reported even when a lower rung caught the place — a rejected fact is
    // never a silent downgrade.
    const loud = (trace ?? []).filter(
      (t) => t.reason === "validator-rejected" || (t.notes ?? []).length > 0,
    );
    if (loud.length > 0) {
      rejections.push({ id: place.id, name: place.name, won: rung, loud });
    }
    if (fact) {
      wrote++;
      return withFact(place, fact);
    }
    return place;
  });
  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.ladder-tmp`;
    writeFileSync(tmp, JSON.stringify(chunk), "utf8");
    renameSync(tmp, path);
  }
  return { chunkId, places: chunk.places.length, counts, rejections, wrote, dryRun };
}

// ---------------------------------------------------------------------------
// --fetch-missing: join + extract for uncovered places (network)
// ---------------------------------------------------------------------------

function writeJoinResult(place, qid, method) {
  const rec = { geonamesId: place.id, qid: qid ?? null, method, at: new Date().toISOString() };
  appendFileSync(QID_JOIN_PATH, JSON.stringify(rec) + "\n");
  return rec;
}

/**
 * For places in the target chunks with no join row yet: run the slug path,
 * then the verified search fallback (the qid-join building blocks), then
 * run the Wikidata extractor for every newly joined qid not yet extracted.
 * Resumable via the .scratch/facts JSONL files. joinLimit caps the work list.
 */
export async function fetchMissing(chunkIds, joinLimit = 150) {
  mkdirSync(FACTS_DIR, { recursive: true });
  const groups = loadJoinChunks().filter(
    (g) => g.length > 0 && chunkIds.includes(g[0].chunk.replace(/\.json$/, "")),
  );
  const crawl = loadCrawlTitles();
  const { done } = loadJoinDone();
  const work = buildWorkList(groups, crawl.titles, done, joinLimit);
  console.log(`[ladder] fetch-missing: ${work.length} places to join across ${groups.length} chunk groups`);
  const stats = { slug: 0, search: 0, unmatched: 0 };
  const newQids = [];

  // Slug path: batch 50 titles per request.
  const searchQueue = [];
  const titleToPlaces = new Map();
  for (const w of work) {
    if (w.title) {
      if (!titleToPlaces.has(w.title)) titleToPlaces.set(w.title, []);
      titleToPlaces.get(w.title).push(w);
    } else searchQueue.push(w);
  }
  const titles = [...titleToPlaces.keys()];
  for (const batch of chunkArray(titles, BATCH_TITLES)) {
    const resolved = await resolveQidsByTitles(batch);
    for (const title of batch) {
      const qid = resolved.get(title);
      for (const w of titleToPlaces.get(title)) {
        if (qid) {
          writeJoinResult(w.place, qid, "slug");
          stats.slug++;
          newQids.push(qid);
        } else {
          searchQueue.push(w);
        }
      }
    }
    console.log(`[ladder] join slug: ${stats.slug} joined, ${searchQueue.length} queued for search`);
  }

  // Search fallback: verified candidates only.
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
        if (verdict.ok) { accepted = c.qid; break; }
      }
    } catch (err) {
      console.error(`[ladder] ABORT after ${n}/${searchQueue.length} search places: ${err.message}`);
      throw err;
    }
    if (accepted) {
      writeJoinResult(place, accepted, "search");
      stats.search++;
      newQids.push(accepted);
    } else {
      writeJoinResult(place, null, "unmatched");
      stats.unmatched++;
    }
    if (n % 25 === 0 || n === searchQueue.length) {
      console.log(`[ladder] join search ${n}/${searchQueue.length}: ${JSON.stringify(stats)}`);
    }
  }
  console.log(`[ladder] join done: ${JSON.stringify(stats)}`);

  // Wikidata extract for joined-but-not-yet-extracted qids.
  const processed = readWikidataQids();
  const todo = [...new Set(newQ