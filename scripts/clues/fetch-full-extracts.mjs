// fetch-full-extracts.mjs — Option A fuller-extract fetcher for the
// GeoDetective Phase 2 continuation.
//
// Run: node scripts/clues/fetch-full-extracts.mjs [--limit <n>]
//        [--batch <n>] [--delay-ms <ms>] [--out <file.jsonl>]
//        [--pool <pool.jsonl>] [--records <records.jsonl>]
//
// Why: Phase 2 generation ran on the crawl cache's extracts, which are
// the first 6 SENTENCES of each article's lead (the hook pipeline's
// exintro+exsentences=6 excerpt). Under the locked tier-2 rule most of
// those excerpts carry no sourceable climate mechanism, so 2,057 of
// 2,189 attempts failed closed at climate. Option A (Liz, 2026-10-04):
// fetch the SAME matched articles again — same source, same titles,
// no re-matching, no new title decisions — but take the FULL lead
// (section 0): the identical MediaWiki extracts call with exintro=1
// and explaintext=1 and NO exsentences limit.
//
// Order/targets: pool fame order from production/pool.jsonl, skipping
// the places already accepted in Phase 2 (records.jsonl). The article
// fetched for each place is exactly the title recorded in its pool
// input (extracts[0].article — the title the crawl matched under the
// Hyderabad rule).
//
// Storage: append-only JSONL at .scratch/geodetective/full-extracts.jsonl
// (gitignored scratch, NEVER committed — same status as the crawl
// cache). One line per place:
//   {place_id, article, resolvedTitle, url, status, text, chars,
//    words, fetchedAt}
// status: "ok" (non-empty lead text) | "empty" (page exists, lead
// empty) | "missing" (no such page) | "error" (transient failure
// after retries — retried on the next run, never treated as done).
// Resume invariant mirrors the crawl: a run skips places with a
// terminal record (ok/empty/missing) and retries "error" records.
//
// Politeness: batched title queries (default 20 titles/request) with
// a delay between requests (default 350 ms — at most ~3 requests/s,
// each covering 20 articles, far lighter per article than the crawl),
// a descriptive User-Agent, and maxlag=5. Transient failures retry
// up to 3 times with backoff (honoring Retry-After).
//
// Text cap: stored text is capped at MAX_TEXT_CHARS characters
// (30,000). Section-0 leads are far shorter in practice; the cap only
// binds on pathological pages, and truncation is flagged on the
// record ("truncated": true).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PRODUCTION_DIR = join(HERE, "production");
const DEFAULT_POOL = join(PRODUCTION_DIR, "pool.jsonl");
const DEFAULT_RECORDS = join(PRODUCTION_DIR, "records.jsonl");
const DEFAULT_OUT = join(ROOT, ".scratch", "geodetective", "full-extracts.jsonl");

export const API = "https://en.wikipedia.org/w/api.php";
export const USER_AGENT =
  "MeridianGame/1.0 (https://veeresh-bikkaneti.github.io/Meridian/; contact: https://github.com/veeresh-bikkaneti/Meridian)";
export const MAX_TEXT_CHARS = 30000;
export const DONE_STATUSES = new Set(["ok", "empty", "missing"]);
const MAX_ATTEMPTS = 3;

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

export function isDoneRecord(rec) {
  return Boolean(rec) && DONE_STATUSES.has(rec.status);
}

/** Query params for one batched full-lead request. */
export function buildParams(titles) {
  return new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    titles: titles.join("|"),
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
}

/**
 * Resolve a requested title through the API's normalized + redirects
 * maps (each a list of {from, to}) to the final page title.
 */
export function resolveFinalTitle(title, normalized = [], redirects = []) {
  let current = title;
  const norm = new Map(normalized.map((n) => [n.from, n.to]));
  if (norm.has(current)) current = norm.get(current);
  const redir = new Map(redirects.map((r) => [r.from, r.to]));
  const seen = new Set();
  while (redir.has(current) && !seen.has(current)) {
    seen.add(current);
    current = redir.get(current);
  }
  return current;
}

/**
 * Shape one API response into one fetch record per requested place.
 * `requested` is [{place_id, article, url}]. Pure — unit-tested.
 */
export function shapeRecords(requested, data, fetchedAt = new Date().toISOString()) {
  const query = data?.query ?? {};
  const pages = Array.isArray(query.pages) ? query.pages : [];
  const byTitle = new Map(pages.map((p) => [p.title, p]));
  return requested.map(({ place_id, article, url }) => {
    const resolvedTitle = resolveFinalTitle(article, query.normalized ?? [], query.redirects ?? []);
    const page = byTitle.get(resolvedTitle);
    const base = { place_id, article, resolvedTitle, url, fetchedAt };
    if (!page || page.missing) {
      return { ...base, status: "missing", text: null, chars: 0, words: 0 };
    }
    const raw = typeof page.extract === "string" ? page.extract.trim() : "";
    if (!raw) {
      return { ...base, status: "empty", text: null, chars: 0, words: 0 };
    }
    const truncated = raw.length > MAX_TEXT_CHARS;
    const text = truncated ? raw.slice(0, MAX_TEXT_CHARS) : raw;
    return {
      ...base,
      status: "ok",
      text,
      chars: text.length,
      words: wordCount(text),
      ...(truncated ? { truncated: true } : {}),
    };
  });
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(requested) {
  const url = `${API}?${buildParams(requested.map((r) => r.article))}`;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        throw Object.assign(new Error(`HTTP ${res.status}`), { retryAfter });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.error) {
        // maxlag and friends are transient; anything else is too, for
        // our purposes — the batch is recorded as errors and a later
        // run retries. Never substitute another source.
        throw new Error(`API error ${data.error.code ?? "?"}: ${data.error.info ?? ""}`.trim());
      }
      return shapeRecords(requested, data);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = Math.max(1000 * 2 ** (attempt - 1), (err.retryAfter ?? 0) * 1000);
        await sleep(backoff);
      }
    }
  }
  const fetchedAt = new Date().toISOString();
  return requested.map(({ place_id, article, url }) => ({
    place_id,
    article,
    resolvedTitle: article,
    url,
    status: "error",
    text: null,
    chars: 0,
    words: 0,
    error: String(lastError?.message ?? lastError).slice(0, 200),
    fetchedAt,
  }));
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main(argv) {
  const limit = Number(argValue(argv, "--limit") ?? "100");
  const batchSize = Number(argValue(argv, "--batch") ?? "20");
  const delayMs = Number(argValue(argv, "--delay-ms") ?? "350");
  const outPath = argValue(argv, "--out") ?? DEFAULT_OUT;
  const poolPath = argValue(argv, "--pool") ?? DEFAULT_POOL;
  const recordsPath = argValue(argv, "--records") ?? DEFAULT_RECORDS;
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(batchSize) || batchSize < 1) {
    console.error("usage: node fetch-full-extracts.mjs [--limit <n>] [--batch <n>] [--delay-ms <ms>] [--out <file>] [--pool <file>] [--records <file>]");
    process.exitCode = 1;
    return;
  }

  const accepted = new Set(
    readJsonLines(recordsPath)
      .filter((r) => r.status === "accepted")
      .map((r) => r.place_id),
  );
  const done = new Map();
  for (const rec of readJsonLines(outPath)) {
    if (isDoneRecord(rec)) done.set(rec.place_id, rec);
    else done.delete(rec.place_id); // an "error" line never marks done
  }

  const queue = [];
  for (const input of readJsonLines(poolPath)) {
    const placeId = input.place.place_id;
    if (accepted.has(placeId) || done.has(placeId)) continue;
    const extract = Array.isArray(input.extracts) ? input.extracts[0] : undefined;
    if (!extract?.article) continue;
    queue.push({ place_id: placeId, article: extract.article, url: extract.url });
    if (queue.length >= limit) break;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  console.log(
    `full-extract fetch: ${queue.length} place(s) queued (${done.size} already done, ${accepted.size} accepted skipped) -> ${outPath}`,
  );
  const tally = { ok: 0, empty: 0, missing: 0, error: 0 };
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const records = await fetchBatch(batch);
    appendFileSync(outPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
    for (const r of records) tally[r.status] = (tally[r.status] ?? 0) + 1;
    if (i + batchSize < queue.length) await sleep(delayMs);
    if ((i / batchSize) % 10 === 0 || i + batchSize >= queue.length) {
      console.log(`  ${Math.min(i + batchSize, queue.length)}/${queue.length} fetched — ${JSON.stringify(tally)}`);
    }
  }
  console.log(`done: ${JSON.stringify(tally)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
