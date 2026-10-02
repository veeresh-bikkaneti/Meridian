#!/usr/bin/env node
/**
 * facts-eb1911.mjs — Mine founding/naming/event sentences about GB/IE places
 * from the 1911 Encyclopaedia Britannica transclusions on en.wikisource.org.
 *
 * IMPORTANT SCRAPING NOTE: the main-namespace Wikisource pages for EB1911
 * (e.g. "1911 Encyclopædia Britannica/Bath (England)") contain only a
 * transclusion stub (<pages index="EB1911 - Volume 3.djvu" .../>), so we use
 * the MediaWiki parse API with prop=text (rendered HTML) and strip tags.
 * prop=wikitext is useless for these entries.
 *
 * Page titles use "1911 Encyclopædia Britannica/<Name>" (note the æ ligature)
 * with disambiguation suffixes like "(England)", "(Scotland)", "(Wales)",
 * "(Ireland)" — e.g. "1911 Encyclopædia Britannica/Bath (England)".
 *
 * Kid-content filter (MANDATORY — this feeds a kids' product):
 *   - BLOCKLIST: period racial slurs / dehumanizing language → sentence is
 *     rejected outright (never recorded).
 *   - REVIEWLIST: colonial/imperial/conquest language → sentence is recorded
 *     with needsReview:true so a human eyeballs it before use.
 *   When in doubt, flag for review rather than accept.
 *
 * Usage:
 *   node scripts/facts-eb1911.mjs pilot --limit 200 [--seed 42]
 *   node scripts/facts-eb1911.mjs report
 *
 * Output (git-ignored, resumable):
 *   .scratch/facts/eb1911-facts.jsonl     — one JSON record per mined sentence
 *   .scratch/facts/eb1911-attempts.jsonl  — per-place outcome log (for resume + report)
 *
 * Record: {geonamesId, placeName, sentence, sourceUrl, sourceTitle,
 *          needsReview, at}
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHUNK_DIR = path.join(REPO_ROOT, "src/game/data/geonames/chunks");
const OUT_DIR = path.join(REPO_ROOT, ".scratch/facts");
const FACTS_FILE = path.join(OUT_DIR, "eb1911-facts.jsonl");
const ATTEMPTS_FILE = path.join(OUT_DIR, "eb1911-attempts.jsonl");

const UA =
  "MeridianFactsBot/1.0 (kids geography quiz research; en.wikisource.org EB1911 mining)";
const SLEEP_MS = 1100;
const API = "https://en.wikisource.org/w/api.php";
const EB_PREFIX = "1911 Encyclopædia Britannica";

// ---------------------------------------------------------------------------
// Place selection
// ---------------------------------------------------------------------------

export function loadGbIePlaces(chunkDir = CHUNK_DIR) {
  const places = [];
  for (const f of fs.readdirSync(chunkDir)) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(fs.readFileSync(path.join(chunkDir, f), "utf8"));
    for (const p of j.places || []) {
      if (p.iso2 === "GB" || p.iso2 === "IE") places.push(p);
    }
  }
  return places;
}

/** Deterministic shuffle (mulberry32) so the pilot is reproducible. */
export function selectPilot(places, limit = 200, seed = 42) {
  const arr = [...places];
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Wikisource API (network)
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function apiGet(params) {
  const url = API + "?" + new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 429) {
            const err = new Error("HTTP 429 rate limited");
            err.code = "RATE_LIMITED";
            return reject(err);
          }
          if (res.statusCode >= 500) {
            const err = new Error("HTTP " + res.statusCode);
            err.code = "SERVER_ERROR";
            return reject(err);
          }
          if (res.statusCode !== 200) {
            return reject(new Error("HTTP " + res.statusCode + " " + url));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("bad JSON from " + url));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("request timeout"));
    });
  });
}

/** Fetch a rendered EB1911 article page. Returns {title, html} or {missing}. */
export async function fetchEbPage(title) {
  const j = await apiGet({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    format: "json",
  });
  if (j.error) return { missing: true, info: j.error.info };
  return { title: j.parse.title, html: j.parse.text["*"] };
}

/** List titles under the EB1911 prefix starting with `stem`. */
export async function listEbTitles(stem) {
  const j = await apiGet({
    action: "query",
    list: "allpages",
    apprefix: EB_PREFIX + "/" + stem,
    apnamespace: "0",
    aplimit: "25",
    format: "json",
  });
  return (j.query.allpages || []).map((p) => p.title);
}

export function candidateTitles(name, iso2) {
  const suffixes =
    iso2 === "IE"
      ? [" (Ireland)", " (England)", " (Scotland)", " (Wales)"]
      : [" (England)", " (Scotland)", " (Wales)", " (Ireland)"];
  const out = [name, ...suffixes.map((s) => name + s)];
  return [...new Set(out)].map((t) => EB_PREFIX + "/" + t);
}

/** Pick a fallback title from an allpages listing (skip people, prefer places). */
export function pickFallbackTitle(stem, titles, tried) {
  const triedSet = new Set(tried);
  const exact = EB_PREFIX + "/" + stem;
  // Only parenthesized disambiguations of the exact stem ("Bath (England)"),
  // never person entries like "Bath, William Pulteney" or run-on words.
  const cands = titles.filter(
    (t) => !triedSet.has(t) && t.startsWith(exact + " (") && !/,/.test(t)
  );
  // Prefer country-disambiguated place entries.
  const placey = cands.filter((t) =>
    /\((England|Scotland|Wales|Ireland|United Kingdom|Great Britain)\)/.test(t)
  );
  return placey[0] || cands[0] || null;
}

// ---------------------------------------------------------------------------
// Text extraction (pure)
// ---------------------------------------------------------------------------

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
};

/** Crudely strip rendered HTML to plain text. */
export function htmlToText(html) {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h\d|li|tr|table|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  t = t.replace(/&(?:amp|lt|gt|quot|#39|nbsp|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/g, (m) => ENTITIES[m] || m);
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const cp = Number(n);
    return cp === 8203 ? "" : String.fromCodePoint(cp); // drop zero-width space
  });
  t = t
    .replace(/[ \t\xa0]+/g, " ")
    .replace(/\s+([,.;:!?%])/g, "$1") // "Somersetshire , England" → "Somersetshire, England"
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return t;
}

/**
 * Find where the actual article starts in the cleaned page text.
 * The nav header ends around the "disclaimer" marker; the entry itself
 * begins with its ALL-CAPS headword, e.g. "BATH, a city, ...".
 */
export function findArticleStart(text) {
  const discl = text.search(/1911 Encyclopædia Britannica disclaimer/i);
  const searchFrom = discl >= 0 ? discl : 0;
  const re = /([A-Z][A-Z'’\- ]{2,60}?),?\s+(a|an|the)\s/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index < searchFrom) continue;
    const head = m[1].replace(/[’']/g, "'").trim();
    if (head === head.toUpperCase() && head.length >= 3 && !/\d/.test(head)) {
      return m.index;
    }
  }
  return -1;
}

/** Is this page a disambiguation / index page rather than an article? */
export function isDisambiguation(text) {
  return (
    /disambiguation/i.test(text.slice(0, 800)) ||
    /\bmay refer to:?\s*$/im.test(text.slice(0, 1200)) ||
    (text.slice(0, 1500).match(/1911 Encyclopædia Britannica/g) || []).length > 6
  );
}

const ABBR = [
  "St",
  "Mr",
  "Mrs",
  "Ms",
  "Dr",
  "Rev",
  "Hon",
  "No",
  "Vol",
  "pp",
  "cf",
  "e\\.g",
  "i\\.e",
  "etc",
  "vs",
  "ft",
  "m",
  "km",
];

/** Split plain text into sentences, guarding common abbreviations. */
export function splitSentences(text) {
  let t = " " + text.replace(/\n+/g, " ");
  const displays = [];
  for (const a of ABBR) {
    const ph = `\u0001${displays.length}\u0002`;
    displays.push(a.replace(/\\/g, "")); // "e\.g" → "e.g"
    t = t.replace(new RegExp(`\\b${a}\\.`, "g"), ph);
  }
  // Protect decimal numbers like "1.5":
  t = t.replace(/(\d)\.(\d)/g, "$1\u0003$2");
  const parts = t.split(/(?<=[.!?]["'”’)]?)\s+(?=[A-Z0-9"“‘(])/);
  return parts
    .map((s) =>
      s
        .replace(/\u0003/g, ".")
        .replace(/\u0001(\d+)\u0002/g, (_, i) => displays[Number(i)] + ".")
        .trim()
    )
    .filter((s) => s.length > 0);
}

const FOUR_YEAR = /\b(1[0-9]{3}|20[0-2][0-9])\b/;
// Early-medieval founding years ("founded in 863", "founded 71 AD") need
// 2-3 digit support, but only when the number sits near the founding word
// (so "300 ft." elevations elsewhere in the sentence don't count).
const NEAR_YEAR = (kw) =>
  new RegExp(
    `\\b${kw}\\b[^.]{0,50}\\b\\d{2,4}\\b|\\b\\d{2,4}\\b[^.]{0,50}\\b${kw}\\b`,
    "i"
  );

/** Patterns for card-worthy founding/naming/event sentences. */
export const FACT_PATTERNS = [
  { name: "founded", re: /\bfound(?:ed|ing)\b/i, nearYear: "found(?:ed|ing)" },
  { name: "charter", re: /\bcharter(?:ed|s)?\b/i, nearYear: "charter(?:ed|s)?" },
  { name: "named-after", re: /\bnamed\s+(after|for|in\s+honou?r\s+of)\b/i },
  { name: "birthplace", re: /\bbirthplace\s+of\b/i },
  { name: "first-oldest", re: /\b(?:the|a)\s+(?:first|oldest)\b/i },
  { name: "battle-siege", re: /\b(?:battle|siege)\s+of\b|\bbesieged\b/i },
  { name: "roman", re: /\bRoman\b.{0,40}\b(?:station|fort|town|camp|wall)\b/i },
  { name: "coronation-capital", re: /\b(?:crowned|coronation|capital\s+of)\b/i },
];

/**
 * Pick card-worthy sentences. Returns [{sentence, pattern}] — verbatim
 * sentences, at most `maxN`, preferring ones with a year.
 */
export function pickFactSentences(sentences, maxN = 3) {
  const hits = [];
  for (const s of sentences) {
    if (s.length < 30 || s.length > 600) continue;
    for (const p of FACT_PATTERNS) {
      if (!p.re.test(s)) continue;
      if (p.nearYear && !FOUR_YEAR.test(s) && !NEAR_YEAR(p.nearYear).test(s) && !/\bcentury\b/i.test(s)) continue;
      hits.push({ sentence: s, pattern: p.name, hasYear: FOUR_YEAR.test(s) });
      break;
    }
  }
  hits.sort((a, b) => Number(b.hasYear) - Number(a.hasYear));
  return hits.slice(0, maxN);
}

// ---------------------------------------------------------------------------
// Kid-content filter (pure) — MANDATORY for this kids' product.
// ---------------------------------------------------------------------------

/**
 * BLOCKLIST — unambiguous period racial slurs / dehumanizing language.
 * Any sentence matching is REJECTED (never recorded).
 * NOTE: examples in tests are clearly-labeled synthetic strings.
 */
export const BLOCKLIST = [
  /\bnigg?(?:er|a)s?\b/i, // n-word variants
  /\bcoons?\b/i,
  /\bchinks?\b/i,
  /\bwogs?\b/i,
  /\bpakis?\b/i,
  /\bkaffirs?\b/i,
  /\bdarkie?s?\b/i,
  /\bredskins?\b/i,
  /\bsquaws?\b/i,
  /\bhottentots?\b/i,
  /\bcoolies?\b/i,
  /\bhalf[\s-]?castes?\b/i,
  /\bhalf[\s-]?breeds?\b/i,
  /\bsavages?\b/i,
  /\bbarbarous\b/i,
  /\binferior\s+races?\b/i,
  /\blower\s+races?\b/i,
  /\bdegenerate\s+races?\b/i,
  /\bwhite\s+man'?s\s+burden\b/i,
  /\bsubject\s+races?\b/i,
];

/** "native(s)" + clearly pejorative adjective → block; otherwise review. */
export const NATIVE_PEjorative = /\bnatives?\b/i;
const NATIVE_PEjorative_ADJ = /\b(lazy|ignorant|treacherous|degraded|filthy|stupid|inferior|savage|cunning|thievish)\b/i;

/**
 * REVIEWLIST — colonial/imperial/conquest-adjacent language. Sentences
 * matching are RECORDED with needsReview:true for a human to eyeball.
 */
export const REVIEWLIST = [
  /\bcolony\b/i,
  /\bcolonial\b/i,
  /\bcolonis[et]\b/i,
  /\bcoloniz\w+\b/i,
  /\bempire\b/i,
  /\bimperial\b/i,
  /\bconquered\b/i,
  /\bconquests?\b/i,
  /\btribes?\b/i,
  /\btribal\b/i,
  /\bslaves?\b/i,
  /\bslavery\b/i,
  /\bnegro(?:es)?\b/i,
  /\bplantations?\b/i,
  /\bunciviliz\w+\b/i,
  /\bheathens?\b/i,
  /\bcannibals?\b/i,
  /\bnatives?\b/i,
];

/**
 * Screen one sentence. Returns {verdict: 'accept'|'review'|'block', reasons}.
 * When in doubt → 'review'.
 */
export function screenSentence(sentence) {
  const reasons = [];
  for (const re of BLOCKLIST) {
    if (re.test(sentence)) {
      reasons.push("blocked:" + re.source);
      return { verdict: "block", reasons };
    }
  }
  if (NATIVE_PEjorative.test(sentence) && NATIVE_PEjorative_ADJ.test(sentence)) {
    reasons.push("blocked:pejorative-native");
    return { verdict: "block", reasons };
  }
  for (const re of REVIEWLIST) {
    if (re.test(sentence)) reasons.push("review:" + re.source);
  }
  return { verdict: reasons.length ? "review" : "accept", reasons };
}

// ---------------------------------------------------------------------------
// Pilot runner
// ---------------------------------------------------------------------------

function sourceUrl(subpageTitle) {
  return (
    "https://en.wikisource.org/wiki/" +
    encodeURIComponent(subpageTitle).replace(/%20/g, "_")
  );
}

function appendJsonl(file, obj) {
  fs.appendFileSync(file, JSON.stringify(obj) + "\n");
}

function loadDoneIds(file) {
  const done = new Set();
  if (!fs.existsSync(file)) return done;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.geonamesId) done.add(o.geonamesId);
    } catch {}
  }
  return done;
}

async function processPlace(place) {
  const { id, name, iso2 } = place;
  const tried = [];
  let page = null;
  let outcome = "missed";
  let detail = "no-page";

  try {
    for (const title of candidateTitles(name, iso2)) {
      tried.push(title);
      await sleep(SLEEP_MS);
      const r = await fetchEbPage(title);
      if (r.missing) continue;
      page = r;
      break;
    }
    // allpages fallback for disambiguated titles like "Bath (England)"
    if (!page) {
      await sleep(SLEEP_MS);
      const titles = await listEbTitles(name);
      const fb = pickFallbackTitle(name, titles, tried);
      if (fb) {
        tried.push(fb);
        await sleep(SLEEP_MS);
        const r = await fetchEbPage(fb);
        if (!r.missing) page = r;
      }
    }
    if (!page) return { outcome, detail, tried };

    const text = htmlToText(page.html);
    if (isDisambiguation(text)) return { outcome, detail: "disambiguation", tried };
    const start = findArticleStart(text);
    const body = start >= 0 ? text.slice(start) : text;
    const sentences = splitSentences(body);
    if (sentences.length < 3) return { outcome, detail: "thin-text", tried };

    const picks = pickFactSentences(sentences, 3);
    if (!picks.length) return { outcome, detail: "no-pattern-match", tried };

    // Screen: drop blocked, keep accepted/review-flagged.
    const screened = picks.map((p) => ({ ...p, screen: screenSentence(p.sentence) }));
    const usable = screened.filter((s) => s.screen.verdict !== "block");
    if (!usable.length) {
      return { outcome: "blocked", detail: "all-candidates-blocked", tried };
    }
    const best = usable.find((s) => s.screen.verdict === "accept") || usable[0];
    const needsReview = best.screen.verdict === "review";
    const record = {
      geonamesId: id,
      placeName: name,
      sentence: best.sentence,
      sourceUrl: sourceUrl(page.title),
      sourceTitle: page.title,
      needsReview,
      pattern: best.pattern,
      at: new Date().toISOString(),
    };
    return { outcome: needsReview ? "needsReview" : "found", record, tried };
  } catch (e) {
    if (e.code === "RATE_LIMITED") throw e; // hard stop: abort run, keep progress
    return { outcome: "missed", detail: "error:" + e.message, tried };
  }
}

async function cmdPilot(argv) {
  const limit = Number(argv["--limit"] || 200);
  const seed = Number(argv["--seed"] || 42);
  const places = loadGbIePlaces();
  console.log(`GB/IE places in chunks: ${places.length}`);
  const pilot = selectPilot(places, limit, seed);
  const done = loadDoneIds(ATTEMPTS_FILE);
  const todo = pilot.filter((p) => !done.has(p.id));
  console.log(`Pilot: ${pilot.length} selected, ${todo.length} remaining (resumable).`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const counts = { found: 0, needsReview: 0, missed: 0, blocked: 0 };
  let i = 0;
  for (const p of todo) {
    i++;
    let res;
    try {
      res = await processPlace(p);
    } catch (e) {
      if (e.code === "RATE_LIMITED") {
        console.log("\n!! 429 rate-limited by en.wikisource.org — aborting run (hard stop). Progress saved.");
        break;
      }
      throw e;
    }
    counts[res.outcome] = (counts[res.outcome] || 0) + 1;
    appendJsonl(ATTEMPTS_FILE, {
      geonamesId: p.id,
      placeName: p.name,
      iso2: p.iso2,
      outcome: res.outcome,
      detail: res.detail || null,
      tried: res.tried,
      at: new Date().toISOString(),
    });
    if (res.record) appendJsonl(FACTS_FILE, res.record);
    if (i % 10 === 0 || i === todo.length) {
      console.log(
        `  [${i}/${todo.length}] ${p.name} → ${res.outcome}${res.detail ? " (" + res.detail + ")" : ""} | totals ${JSON.stringify(counts)}`
      );
    }
  }
  console.log("\nPilot run finished. Totals:", JSON.stringify(counts));
  console.log("Facts file:", FACTS_FILE);
}

function cmdReport() {
  const attempts = [];
  if (fs.existsSync(ATTEMPTS_FILE)) {
    for (const line of fs.readFileSync(ATTEMPTS_FILE, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        attempts.push(JSON.parse(line));
      } catch {}
    }
  }
  const facts = [];
  if (fs.existsSync(FACTS_FILE)) {
    for (const line of fs.readFileSync(FACTS_FILE, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        facts.push(JSON.parse(line));
      } catch {}
    }
  }
  const counts = { found: 0, needsReview: 0, missed: 0, blocked: 0 };
  const detailCounts = {};
  for (const a of attempts) {
    counts[a.outcome] = (counts[a.outcome] || 0) + 1;
    if (a.detail) detailCounts[a.detail] = (detailCounts[a.detail] || 0) + 1;
  }
  const n = attempts.length || 1;
  console.log("=== EB1911 pilot report ===");
  console.log(`places attempted: ${attempts.length}`);
  console.log(`found (auto-accepted): ${counts.found} (${((counts.found / n) * 100).toFixed(1)}%)`);
  console.log(`needsReview:          ${counts.needsReview} (${((counts.needsReview / n) * 100).toFixed(1)}%)`);
  console.log(`missed:               ${counts.missed} (${((counts.missed / n) * 100).toFixed(1)}%)`);
  console.log(`blocked-content:      ${counts.blocked} (${((counts.blocked / n) * 100).toFixed(1)}%)`);
  console.log("miss details:", JSON.stringify(detailCounts, null, 1));
  console.log(`\nrecords in facts file: ${facts.length}`);
  console.log("\n--- 10 sample sentences ---");
  for (const f of facts.slice(0, 10)) {
    console.log(`\n[${f.placeName}] (${f.pattern}${f.needsReview ? ", NEEDS REVIEW" : ""})`);
    console.log("  " + f.sentence);
    console.log("  " + f.sourceUrl);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const argv = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) argv[rest[i]] = rest[i + 1] || "true";
  }
  if (cmd === "pilot") await cmdPilot(argv);
  else if (cmd === "report") cmdReport();
  else {
    console.log("usage: node scripts/facts-eb1911.mjs pilot --limit 200 [--seed 42]");
    console.log("       node scripts/facts-eb1911.mjs report");
    process.exit(2);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
