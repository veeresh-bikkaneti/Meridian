#!/usr/bin/env node
/**
 * facts-wikidata-extract.mjs — Worker B: Wikidata structured-fact extraction.
 *
 * Pulls P138 (named after), P571 (inception), P547 (commemorates) statements
 * for a list of Wikidata QIDs from https://query.wikidata.org/sparql, WITH
 * provenance detection (prov:wasDerivedFrom references).
 *
 * Reference policy: statements WITH >=1 reference are flagged hasReference:true.
 * Unreferenced statements are ALSO kept but flagged hasReference:false and must
 * NOT be presented as reliable downstream (a `verifiedOnly` filter can exclude
 * them). Never trust an unreferenced Wikidata statement as a kids'-card fact.
 *
 * P571 semantic drift: inception values can be "first written attestation"
 * rather than "founded" (e.g. Romania). Raw value + precision are preserved and
 * the field is reported verbatim as `inception` — never relabelled "founded".
 *
 * Wikidata data is CC0 (public domain) — no attribution friction.
 *
 * Usage:
 *   node scripts/facts-wikidata-extract.mjs                 # extract default 50-QID pilot
 *   node scripts/facts-wikidata-extract.mjs extract --limit 10
 *   node scripts/facts-wikidata-extract.mjs extract --qids Q60,Q183
 *   node scripts/facts-wikidata-extract.mjs extract --qids-file qids.txt
 *   node scripts/facts-wikidata-extract.mjs coverage        # report on .scratch output
 *
 * Output: appends JSONL records to .scratch/facts/wikidata-facts.jsonl
 *   {qid, geonamesId|null, property, valueLabel, valueQid|null,
 *    qualifiers, hasReference, retrievedAt}
 * Resumable: QIDs already present in the output file are skipped.
 *
 * Node stdlib only. No network in unit tests (canned SPARQL JSON fixtures).
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUTPUT_PATH = resolve(REPO_ROOT, '.scratch/facts/wikidata-facts.jsonl');

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'MeridianKidsQuiz/1.0 (Wikidata fact extraction for kids geography cards; educational research)';
const MIN_SLEEP_MS = 2000;   // endpoint etiquette: >=2s between queries
const BATCH_SIZE = 50;       // max QIDs per SPARQL query

/** The three properties we extract, with human names. */
export const TARGET_PROPERTIES = {
  P138: 'named_after',
  P571: 'inception',
  P547: 'commemorates',
};

/**
 * Default pilot QID list (50 places): US cities, world capitals, and
 * countries — including Q60 (New York City), Q43668 (Louisville, Kentucky)
 * and Q2931901 (Louisville, Georgia). All QIDs label-verified against the
 * live Wikidata endpoint on 2026-10-02.
 */
export const DEFAULT_QIDS = [
  'Q60',     // New York City
  'Q61',     // Washington, D.C.
  'Q43668',  // Louisville, Kentucky
  'Q2931901',// Louisville, Georgia
  'Q23556',  // Atlanta
  'Q1297',   // Chicago
  'Q1345',   // Philadelphia
  'Q16555',  // Houston
  'Q34404',  // New Orleans
  'Q62',     // San Francisco
  'Q16563',  // Memphis
  'Q16554',  // Denver
  'Q8652',   // Miami
  'Q5083',   // Seattle
  'Q65',     // Los Angeles
  'Q23197',  // Nashville
  'Q43199',  // Omaha
  'Q16552',  // San Diego
  'Q16556',  // Phoenix
  'Q38022',  // St. Louis
  'Q64',     // Berlin
  'Q90',     // Paris
  'Q84',     // London
  'Q649',    // Moscow
  'Q1490',   // Tokyo
  'Q956',    // Beijing
  'Q85',     // Cairo
  'Q1486',   // Buenos Aires
  'Q8678',   // Rio de Janeiro
  'Q3130',   // Sydney
  'Q1085',   // Prague
  'Q1899',   // Kyiv
  'Q220',    // Rome
  'Q1524',   // Athens
  'Q1748',   // Copenhagen
  'Q1757',   // Helsinki
  'Q183',    // Germany
  'Q142',    // France
  'Q30',     // United States
  'Q145',    // United Kingdom
  'Q159',    // Russia
  'Q17',     // Japan
  'Q408',    // Australia
  'Q414',    // Argentina
  'Q155',    // Brazil
  'Q16',     // Canada
  'Q38',     // Italy
  'Q29',     // Spain
  'Q31',     // Belgium
  'Q34',     // Sweden
];

// ---------------------------------------------------------------------------
// SPARQL query building
// ---------------------------------------------------------------------------

/**
 * Build a SPARQL query pulling P138/P571/P547 statement-level detail for a
 * batch of QIDs: the value's English label, the value node (entity URI or
 * literal), any qualifiers, and any reference node (prov:wasDerivedFrom).
 *
 * One row is returned per (statement x qualifier x reference) combination;
 * parseSparqlRows() collapses rows back into per-statement records.
 *
 * @param {string[]} qids e.g. ['Q60','Q61']
 * @returns {string} SPARQL query text
 */
export function buildBatchQuery(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  return `SELECT ?item ?property ?statement ?value ?valueLabel ?qualifierProp ?qualifierValue ?qualifierValueLabel ?reference
WHERE {
  VALUES ?item { ${values} }
  {
    SELECT ?item ?property ?statement ?value WHERE {
      VALUES (?propP ?propW ?property) {
        (p:P138 ps:P138 "P138")
        (p:P571 ps:P571 "P571")
        (p:P547 ps:P547 "P547")
      }
      ?item ?propP ?statement .
      ?statement ?propW ?value .
    }
  }
  OPTIONAL {
    ?statement ?qp ?qualifierValue .
    FILTER(STRSTARTS(STR(?qp), "http://www.wikidata.org/prop/qualifier/"))
    BIND(REPLACE(STR(?qp), "http://www.wikidata.org/prop/qualifier/", "") AS ?qualifierProp)
  }
  OPTIONAL { ?statement prov:wasDerivedFrom ?reference . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

// ---------------------------------------------------------------------------
// Row parsing: SPARQL JSON rows -> statement records
// ---------------------------------------------------------------------------

const uriToQid = (uri) => {
  const m = /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(uri || '');
  return m ? m[1] : null;
};

/**
 * Collapse SPARQL result rows into per-statement records.
 *
 * Each row carries: item, property ("P138"|"P571"|"P547"), statement (node
 * URI), value (literal or entity URI), valueLabel, an optional qualifier
 * pair, and an optional reference node. Multiple rows for the same statement
 * are merged; qualifiers are unioned; hasReference is true if ANY row for
 * the statement carried a reference node.
 *
 * @param {object[]} bindings SPARQL JSON result bindings
 * @param {string} retrievedAt ISO timestamp
 * @returns {object[]} records {qid, geonamesId, property, valueLabel, valueQid,
 *   rawValue, qualifiers, hasReference, retrievedAt}
 */
export function parseSparqlRows(bindings, retrievedAt) {
  const byStmt = new Map();
  for (const b of bindings) {
    const qid = uriToQid(b.item?.value);
    if (!qid) continue;
    const property = b.property?.value;
    if (!TARGET_PROPERTIES[property]) continue;
    const stmtKey = b.statement?.value || `${qid}|${property}|${b.value?.value}`;
    let rec = byStmt.get(stmtKey);
    if (!rec) {
      const rawVal = b.value?.value ?? '';
      rec = {
        qid,
        geonamesId: null,
        property,
        valueLabel: b.valueLabel?.value ?? rawVal,
        valueQid: b.value?.type === 'uri' ? uriToQid(rawVal) : null,
        rawValue: rawVal,
        qualifiers: [],
        _qualKeys: new Set(),
        hasReference: false,
        retrievedAt,
      };
      byStmt.set(stmtKey, rec);
    }
    const qp = b.qualifierProp?.value;
    if (qp) {
      const qv = b.qualifierValue?.value ?? '';
      const qkey = `${qp}=${qv}`;
      if (!rec._qualKeys.has(qkey)) {
        rec._qualKeys.add(qkey);
        rec.qualifiers.push({
          property: qp,
          value: b.qualifierValueLabel?.value ?? qv,
          valueQid: b.qualifierValue?.type === 'uri' ? uriToQid(qv) : null,
        });
      }
    }
    if (b.reference?.value) rec.hasReference = true;
  }
  return [...byStmt.values()].map(({ _qualKeys, ...rec }) => rec);
}

// ---------------------------------------------------------------------------
// Batching + fetch with etiquette
// ---------------------------------------------------------------------------

/** Split an array into chunks of at most n. */
export function chunkArray(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST the SPARQL query with polite headers and exponential backoff on
 * 429/503 (endpoint etiquette: back off, don't hammer).
 * @returns {Promise<object>} parsed SPARQL JSON
 */
export async function sparqlRequest(query, { maxRetries = 5, fetchFn = fetch } = {}) {
  let delay = 4000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchFn(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: 'query=' + encodeURIComponent(query),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt === maxRetries) {
        throw new Error(`WDQS ${res.status} after ${maxRetries} retries — backing off per endpoint etiquette`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      console.error(`WDQS ${res.status} — backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(wait);
      delay *= 2;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WDQS ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }
  throw new Error('unreachable');
}

/**
 * Fetch statement records for one batch of QIDs, sleeping >=2s afterwards
 * per endpoint etiquette (skippable via sleepMs: 0 in tests).
 */
export async function fetchBatch(qids, { fetchFn = fetch, sleepMs = MIN_SLEEP_MS } = {}) {
  const query = buildBatchQuery(qids);
  const json = await sparqlRequest(query, { fetchFn });
  const retrievedAt = new Date().toISOString();
  const records = parseSparqlRows(json?.results?.bindings ?? [], retrievedAt);
  if (sleepMs > 0) await sleep(sleepMs);
  return records;
}

// ---------------------------------------------------------------------------
// Output: JSONL append + resume
// ---------------------------------------------------------------------------

function ensureOutputDir() {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
}

/** QIDs already present in the output file (resume-skip). */
export function readProcessedQids(path = OUTPUT_PATH) {
  if (!existsSync(path)) return new Set();
  const done = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.qid) done.add(rec.qid);
    } catch { /* skip malformed lines */ }
  }
  return done;
}

/** Append records as JSONL (one line per record). */
export function appendRecords(records, path = OUTPUT_PATH) {
  if (records.length === 0) return 0;
  mkdirSync(dirname(path), { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  appendFileSync(path, lines, 'utf8');
  return records.length;
}

/**
 * Extract facts for qids -> output file, resumable (QIDs already present
 * are skipped, not refetched).
 * @returns {Promise<{processed:string[], skipped:string[], records:object[]}>}
 */
export async function extract(qids, { fetchFn = fetch, sleepMs = MIN_SLEEP_MS, outputPath = OUTPUT_PATH } = {}) {
  const done = readProcessedQids(outputPath);
  const todo = qids.filter((q) => !done.has(q));
  const skipped = qids.filter((q) => done.has(q));
  const all = [];
  const processed = [];
  for (const batch of chunkArray(todo, BATCH_SIZE)) {
    console.log(`fetching batch of ${batch.length}: ${batch.join(',')}`);
    const records = await fetchBatch(batch, { fetchFn, sleepMs });
    const n = appendRecords(records, outputPath);
    console.log(`  -> ${records.length} statements (${n} lines appended)`);
    all.push(...records);
    processed.push(...batch);
  }
  return { processed, skipped, records: all };
}

// ---------------------------------------------------------------------------
// coverage command: report on what's in the output file
// ---------------------------------------------------------------------------

/** Read all records from the output file. */
export function readRecords(path = OUTPUT_PATH) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out;
}

/** Compute coverage stats: QIDs processed, statements per property, % with references. */
export function coverageStats(records) {
  const qids = new Set(records.map((r) => r.qid));
  const perProperty = {};
  for (const p of Object.keys(TARGET_PROPERTIES)) perProperty[p] = { total: 0, withRef: 0 };
  for (const r of records) {
    const slot = perProperty[r.property];
    if (!slot) continue;
    slot.total++;
    if (r.hasReference) slot.withRef++;
  }
  const withRef = records.filter((r) => r.hasReference).length;
  return {
    qidsProcessed: qids.size,
    statements: records.length,
    perProperty,
    pctWithReferences: records.length ? Math.round((withRef / records.length) * 100) : 0,
  };
}

export function printCoverage(records = readRecords()) {
  const s = coverageStats(records);
  console.log(`QIDs processed: ${s.qidsProcessed}`);
  console.log(`Statements found: ${s.statements}`);
  for (const [p, slot] of Object.entries(s.perProperty)) {
    const pct = slot.total ? Math.round((slot.withRef / slot.total) * 100) : 0;
    console.log(`  ${p} (${TARGET_PROPERTIES[p]}): ${slot.total} statements, ${pct}% with references`);
  }
  console.log(`Overall % with references: ${s.pctWithReferences}%`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { command: 'extract', qids: null, qidsFile: null, limit: null };
  const rest = [];
  for (const a of argv) {
    if (a === 'extract' || a === 'coverage') args.command = a;
    else if (a.startsWith('--qids=')) args.qids = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--qids-file=')) args.qidsFile = a.slice(12);
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice(8));
    else rest.push(a);
  }
  // support `--qids Q1,Q2` (space-separated) form
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--qids' && rest[i + 1]) args.qids = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (rest[i] === '--qids-file' && rest[i + 1]) args.qidsFile = rest[++i];
    else if (rest[i] === '--limit' && rest[i + 1]) args.limit = Number(rest[++i]);
  }
  return args;
}

/** Visible for tests. */
export function loadQids(args) {
  let qids;
  if (args.qids) qids = args.qids;
  else if (args.qidsFile) {
    qids = readFileSync(resolve(args.qidsFile), 'utf8')
      .split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^Q\d+$/i.test(s));
  } else qids = [...DEFAULT_QIDS];
  // validate + dedupe, preserving order
  const seen = new Set();
  const out = [];
  for (const q of qids) {
    const up = q.toUpperCase();
    if (/^Q\d+$/.test(up) && !seen.has(up)) { seen.add(up); out.push(up); }
  }
  return out;
}

/** Visible for tests. */
export function parseCliArgs(argv) {
  return parseArgs(argv);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'coverage') {
    printCoverage();
    return;
  }
  let qids = loadQids(args);
  if (args.limit != null && Number.isFinite(args.limit)) qids = qids.slice(0, args.limit);
  console.log(`extract: ${qids.length} QIDs requested`);
  const { processed, skipped, records } = await extract(qids);
  console.log(`done: ${processed.length} processed, ${skipped.length} already present (resumed), ${records.length} new statements`);
  printCoverage();
}

// Only run CLI when executed directly (importable for tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('fatal:', e.message); process.exit(1); });
}
