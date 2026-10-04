// fetch-climate-sections.mjs — tier-2 source-expansion scoping fetch
// (Liz, 2026-10-04): for each sampled place, fetch its article's
// Climate section (Geography section as fallback) as ADDITIONAL
// tier-2 source material. Same article the pipeline already matched
// (the recorded title — no re-matching), same source (Wikipedia),
// same license/attribution. This widens the input, never the rules.
//
// Run: node scripts/clues/fetch-climate-sections.mjs
//        [--sample <scope-sample.json>] [--out <file.jsonl>]
//        [--batch <n>] [--delay-ms <ms>] [--limit <n>]
//
// Mechanics: batched MediaWiki action=query prop=revisions
// (rvprop=content, rvslots=main) — ONE request per batch of 20
// titles returns full page wikitext; sections are sliced locally
// (headings are unambiguous == markers == in wikitext; slicing
// includes subsections, whose content a section-index fetch would
// split away). Wikitext is reduced to prose plaintext: tables and
// templates (incl. climate-chart templates, whose data is tabular,
// not quotable prose) are removed, refs/comments/tags stripped,
// links resolved to their display text.
//
// Section choice (documented in the scoping report):
//   1. Best "climate" heading — exact "climate" first, then a heading
//      starting with "climate", then one containing "climate";
//      within a tier, the first in document order. If the match is a
//      subsection (e.g. Geography > Climate), only that subsection's
//      span is taken.
//   2. Else the best "geography" heading by the same tiers, span
//      INCLUDING its subsections.
//   3. Else status "no-section".
//
// Storage: append-only JSONL at .scratch/geodetective/
// climate-sections.jsonl (gitignored, NEVER committed). One line per
// place: {place_id, article, resolvedTitle, url, status, source,
// heading, headingPath, text, chars, words, fetchedAt}.
// status: "ok" | "no-section" | "missing" | "error" (error retried
// on the next run, never treated as done — the crawl's invariant).
//
// Cost accounting: the run prints (and the scoping report quotes)
// places, HTTP requests actually made, wall time, bytes received.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { API, USER_AGENT, resolveFinalTitle } from "./fetch-full-extracts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const DEFAULT_SAMPLE = join(HERE, "production", "scope-sample.json");
const DEFAULT_OUT = join(ROOT, ".scratch", "geodetective", "climate-sections.jsonl");

export const DONE_STATUSES = new Set(["ok", "no-section", "missing"]);
const MAX_ATTEMPTS = 3;
const MAX_TEXT_CHARS = 30000;

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Split wikitext into sections. Returns [{level, title, path, body}]
 * in document order; body is the raw wikitext between this heading
 * and the next heading of level <= this level (so it INCLUDES
 * subsection headings + their content). Content before the first
 * heading is the lead (level 0, title "").
 */
export function splitSections(wikitext) {
  const lines = String(wikitext ?? "").split("\n");
  const heads = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (m) heads.push({ line: i, level: m[1].length, title: m[2].trim() });
  });
  const sections = [];
  const leadEnd = heads.length ? heads[0].line : lines.length;
  sections.push({ level: 0, title: "", path: [], body: lines.slice(0, leadEnd).join("\n"), start: 0 });
  heads.forEach((h, hi) => {
    let end = lines.length;
    for (let j = hi + 1; j < heads.length; j += 1) {
      if (heads[j].level <= h.level) {
        end = heads[j].line;
        break;
      }
    }
    // path = chain of ancestor headings (strictly smaller levels)
    const path = [];
    for (let j = hi - 1; j >= 0; j -= 1) {
      if (heads[j].level < h.level) {
        if (!path.length || heads[j].level < path[0].level) path.unshift(heads[j]);
        if (heads[j].level === 2) break;
      }
    }
    sections.push({
      level: h.level,
      title: h.title,
      path: path.map((p) => p.title),
      body: lines.slice(h.line + 1, end).join("\n"),
      start: h.line,
    });
  });
  return sections;
}

function headingTier(title, keyword) {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (t === keyword) return 0;
  if (t.startsWith(keyword)) return 1;
  if (t.includes(keyword)) return 2;
  return -1;
}

/**
 * Pick the target section: best climate heading (by tier, then
 * document order), else best geography heading, else null.
 * Returns {source: "climate"|"geography", section} or null.
 */
export function pickTargetSection(sections) {
  for (const [source, keyword] of [
    ["climate", "climate"],
    ["geography", "geography"],
  ]) {
    let best = null;
    for (const section of sections) {
      if (section.level === 0) continue;
      const tier = headingTier(section.title, keyword);
      if (tier < 0) continue;
      if (!best || tier < best.tier) best = { tier, section };
    }
    if (best) return { source, section: best.section };
  }
  return null;
}

/** Remove balanced {{...}} templates (nested) from wikitext. */
export function stripTemplates(text) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith("{{", i)) {
      depth += 1;
      i += 1;
      continue;
    }
    if (text.startsWith("}}", i)) {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0) out += text[i];
  }
  return out;
}

/** Remove balanced {| ... |} tables from wikitext. */
export function stripTables(text) {
  const lines = text.split("\n");
  const kept = [];
  let depth = 0;
  for (const line of lines) {
    if (line.includes("{|")) depth += 1;
    if (depth === 0) kept.push(line);
    if (line.includes("|}")) depth = Math.max(0, depth - 1);
  }
  return kept.join("\n");
}

/** Reduce a wikitext span to prose plaintext. */
export function wikitextToText(wikitext) {
  let text = String(wikitext ?? "");
  text = stripTables(text);
  text = stripTemplates(text);
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, " ");
  text = text.replace(/<ref\b[^>]*\/>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  // links: files/categories vanish; piped links keep display text
  text = text.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, " ");
  text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\]]+\]/g, " ");
  text = text.replace(/https?:\/\/\S+/g, " ");
  // emphasis + heading markers + list bullets
  text = text.replace(/'''?/g, "");
  text = text.replace(/^={2,6}\s*(.+?)\s*={2,6}\s*$/gm, "$1");
  text = text.replace(/^[*#;:]+ */gm, "");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

/** Slice + convert the target section of one page's wikitext. */
export function extractSectionText(wikitext) {
  const sections = splitSections(wikitext);
  const picked = pickTargetSection(sections);
  if (!picked) return null;
  const text = wikitextToText(picked.section.body);
  if (!text) return { source: picked.source, heading: picked.section.title, headingPath: picked.section.path, text: "" };
  return {
    source: picked.source,
    heading: picked.section.title,
    headingPath: picked.section.path,
    text: text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text,
    truncated: text.length > MAX_TEXT_CHARS,
  };
}

/** Query params for one batched wikitext request. */
export function buildParams(titles) {
  return new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: titles.join("|"),
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
}

/**
 * Shape one API response into one fetch record per requested place.
 * Pure — unit-tested. `requested` is [{place_id, article, url}].
 */
export function shapeRecords(requested, data, fetchedAt = new Date().toISOString()) {
  const query = data?.query ?? {};
  const pages = Array.isArray(query.pages) ? query.pages : [];
  const byTitle = new Map(pages.map((p) => [p.title, p]));
  return requested.map(({ place_id, article, url }) => {
    const resolvedTitle = resolveFinalTitle(article, query.normalized ?? [], query.redirects ?? []);
    const page = byTitle.get(resolvedTitle);
    const base = { place_id, article, resolvedTitle, url, fetchedAt };
    if (!page || page.missing) return { ...base, status: "missing", source: null, heading: null, headingPath: [], text: null, chars: 0, words: 0 };
    const wikitext = page.revisions?.[0]?.slots?.main?.content ?? page.revisions?.[0]?.["*"] ?? "";
    if (!wikitext) return { ...base, status: "missing", source: null, heading: null, headingPath: [], text: null, chars: 0, words: 0 };
    const section = extractSectionText(wikitext);
    if (!section || !section.text) {
      return { ...base, status: "no-section", source: section?.source ?? null, heading: section?.heading ?? null, headingPath: section?.headingPath ?? [], text: null, chars: 0, words: 0 };
    }
    return {
      ...base,
      status: "ok",
      source: section.source,
      heading: section.heading,
      headingPath: section.headingPath,
      text: section.text,
      chars: section.text.length,
      words: wordCount(section.text),
      ...(section.truncated ? { truncated: true } : {}),
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

const cost = { requests: 0, bytes: 0 };

async function fetchBatch(requested) {
  const url = `${API}?${buildParams(requested.map((r) => r.article))}`;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      cost.requests += 1;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        throw Object.assign(new Error(`HTTP ${res.status}`), { retryAfter });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      cost.bytes += raw.length;
      const data = JSON.parse(raw);
      if (data?.error) throw new Error(`API error ${data.error.code ?? "?"}: ${data.error.info ?? ""}`.trim());
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
    source: null,
    heading: null,
    headingPath: [],
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

async function main(argv = []) {
  const samplePath = argValue(argv, "--sample") ?? DEFAULT_SAMPLE;
  const outPath = argValue(argv, "--out") ?? DEFAULT_OUT;
  const batchSize = Number(argValue(argv, "--batch") ?? "20");
  const delayMs = Number(argValue(argv, "--delay-ms") ?? "350");
  const limit = Number(argValue(argv, "--limit") ?? "Infinity");
  const startedAt = Date.now();

  const sampleDoc = JSON.parse(readFileSync(samplePath, "utf8"));
  const done = new Map();
  for (const rec of readJsonLines(outPath)) {
    if (DONE_STATUSES.has(rec.status)) done.set(rec.place_id, rec);
    else done.delete(rec.place_id);
  }
  const queue = sampleDoc.sample
    .filter((e) => e.article && !done.has(e.place_id))
    .slice(0, Number.isFinite(limit) ? limit : undefined)
    .map((e) => ({ place_id: e.place_id, article: e.article, url: e.url }));
  console.log(`climate-section fetch: ${queue.length} place(s) queued (${done.size} already done) -> ${outPath}`);

  const tally = { ok: 0, "no-section": 0, missing: 0, error: 0 };
  const sourceTally = { climate: 0, geography: 0 };
  mkdirSync(dirname(outPath), { recursive: true });
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const records = await fetchBatch(batch);
    appendFileSync(outPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
    for (const r of records) {
      tally[r.status] = (tally[r.status] ?? 0) + 1;
      if (r.status === "ok") sourceTally[r.source] = (sourceTally[r.source] ?? 0) + 1;
    }
    if (i + batchSize < queue.length) await sleep(delayMs);
  }
  const wallMs = Date.now() - startedAt;
  console.log(`done: ${JSON.stringify(tally)} sources: ${JSON.stringify(sourceTally)}`);
  console.log(
    `cost: ${cost.requests} HTTP requests, ${(cost.bytes / 1024).toFixed(0)} KiB received, wall ${wallMs} ms for ${queue.length} places`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
