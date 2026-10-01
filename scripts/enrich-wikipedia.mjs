/**
 * Wikipedia history enrichment for the GeoNames place cards.
 *
 * Every Meridian card follows Veeresh's four rules:
 *   1. History first, modern identity second.
 *   2. Geography you can picture (never coordinates/elevation filler).
 *   3. One memorable hook (person, quote, event, record).
 *   4. Short and story-like; numbers only when they teach.
 *
 * The 124,690 generated places ship with a templated plain-geography blurb
 * (rules 2 + 4). This pipeline adds a history-first hook sentence (rules 1 +
 * 3) sourced from Wikipedia, deterministically:
 *
 *   - Resolution: one Wikipedia `generator=geosearch` call per place finds
 *     articles tagged within 10 km of the place's gate-verified coordinates.
 *     The article is accepted only when its title matches the place name —
 *     the Hyderabad rule applied to article resolution, so a card can never
 *     borrow another town's history.
 *   - Extraction: the hook sentence is an actual sentence from the article's
 *     intro, chosen by history-pattern scoring, with parentheticals removed.
 *     No words are ever added — the no-fabrication validator proves every
 *     content word appears in the source extract.
 *   - No LLM anywhere: the card is composed by deterministic string
 *     operations only, keeping the "no LLM for place data" invariant.
 *
 * Usage:
 *   node scripts/enrich-wikipedia.mjs crawl   # resolution crawl (resumable)
 *   node scripts/enrich-wikipedia.mjs merge   # validate + patch chunks
 *   node scripts/enrich-wikipedia.mjs report  # coverage report from cache
 *
 * The crawl is polite (User-Agent, ~3 req/s, maxlag) and resumable: every
 * API answer is appended to CACHE_PATH as JSONL before the next request, so
 * killing the process loses nothing.
 *
 * node stdlib only — no dependencies.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");
const MANIFEST_PATH = join(REPO, "src", "game", "data", "geonames", "manifest.json");
const NOTABLE_PATH = join(REPO, "src", "game", "data", "notable-notes.json");

export const CACHE_DIR = join(REPO, ".scratch", "wikipedia-enrichment");
export const CACHE_PATH = join(CACHE_DIR, "crawl-cache.jsonl");

const API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT =
  "MeridianGame/1.0 (https://veeresh-bikkaneti.github.io/Meridian/; contact: https://github.com/veeresh-bikkaneti/Meridian)";
const GEO_RADIUS_M = 10_000;
// 50: in dense downtowns the top results are all tiny landmarks (buildings,
// parks) tagged at the same center — the city article itself gets crowded
// out of a small limit. Two-pass title matching (exact base name first)
// then picks the right one.
const GEO_LIMIT = 50;
const EXTRACT_SENTENCES = 3;
// Pacing: at most one request start per TICK_MS; CONCURRENCY in flight.
const TICK_MS = 350;
const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Pure functions (importable for unit tests)
// ---------------------------------------------------------------------------

/** "Fort Worth (Texas)" -> "fort worth"; "gn-123" untouched (ids never go here). */
export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does the Wikipedia title name the same place? Strict by design: either
 * side must contain the other after normalization. "Lancaster, Pennsylvania"
 * never matches a "Lancaster, Wisconsin" row because resolution is already
 * constrained to a 10 km radius — but the title check is the second lock.
 */
export function titlesMatch(title, placeName) {
  const t = normalizeTitle(title);
  const n = normalizeTitle(placeName);
  if (!t || !n) return false;
  return t.includes(n) || n.includes(t);
}

/**
 * Split plaintext into sentences on terminal punctuation, without breaking
 * on abbreviations ("St. Louis", "Mercedes-Benz U.S. International") — a
 * naive split would shred those into fragments and the hook picker would
 * keep a truncated half-sentence.
 */
const ABBREV_TAIL = /\b(?:U\.S|U\.K|St|Mt|Dr|Mr|Mrs|Ms|Jr|Sr|Ave|Blvd|Co|Inc|Ltd|No|vs|Capt|Gen|Col|Sgt|Rep|Sen|Gov)\.$/;
export function splitSentences(text) {
  const raw = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out = [];
  for (const frag of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && ABBREV_TAIL.test(prev)) {
      out[out.length - 1] = `${prev} ${frag}`;
    } else {
      out.push(frag);
    }
  }
  return out;
}

/** Remove parenthesized spans: "X (founded 1854) grew" -> "X grew". */
export function stripParens(sentence) {
  return sentence
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Strong hooks: a person, an event, a record, a naming story — the things a
// kid can retell (rule 3). Each must match a real historical hook.
const STRONG_HOOKS = [
  /named\s+(?:after|for)\s+[^.]{2,80}/i,
  /renamed\s+(?:after|for)\s+[^.]{2,80}/i,
  /birthplace\s+of\s+[^.]{2,80}/i,
  /site\s+of\s+(?:the\s+)?[^.]{2,80}/i,
  /battle\s+of\s+[^.]{2,80}/i,
  /was\s+the\s+first\s+[^.]{2,80}/i,
  /(?:is|was)\s+the\s+oldest\s+[^.]{2,80}/i,
  /known\s+for\s+[^.]{2,80}/i,
  /famous\s+for\s+[^.]{2,80}/i,
  /home\s+to\s+[^.]{2,80}/i,
  /played\s+(?:a\s+)?(?:key|major|central)\s+role\s+in\s+[^.]{2,80}/i,
  /hosted\s+[^.]{2,80}/i,
];
// Date anchors only count when the sentence tells more than the date: a
// proper noun (a person, a railroad, a company) or a story keyword must be
// present, otherwise "It incorporated in 1914." would pass as a "hook" and
// no child could retell it.
const DATE_HOOKS = [
  /(?:was\s+)?founded\s+in\s+\d{4}/i,
  /(?:was\s+)?established\s+in\s+\d{4}/i,
  /(?:was\s+)?incorporated\s+in\s+\d{4}/i,
  /settled\s+in\s+(?:the\s+)?\d{4}s?/i,
];
const STORY_KEYWORDS =
  /\b(railroad|railway|gold|silver|oil|cotton|battle|war|trail|fort|mission|mill|mine|mining|canal|port|depot|expedition|revolution|protest|march|boycott|strike|flood|fire|tornado|space|rocket|film|movie|music|jazz|blues|baseball|football)\b/i;
const PROPER_NOUN_MID_SENTENCE = /\s[A-Z][a-z]{2,}/;

function hookScore(sentence) {
  for (const re of STRONG_HOOKS) {
    if (re.test(sentence)) return 2;
  }
  for (const re of DATE_HOOKS) {
    if (re.test(sentence)) {
      const hasStory =
        STORY_KEYWORDS.test(sentence) || PROPER_NOUN_MID_SENTENCE.test(sentence);
      return hasStory ? 1 : 0;
    }
  }
  return 0;
}

export const HISTORY_MIN_LEN = 20;
export const HISTORY_MAX_LEN = 240;

/**
 * Pick the hook sentence from a Wikipedia intro extract. Returns
 * `{ sentence }` or `{ rejected }`. The sentence is verbatim from the
 * extract minus parentheticals — never rewritten, never extended.
 */
export function extractHookSentence(extractText) {
  if (typeof extractText !== "string" || extractText.trim().length === 0) {
    return { rejected: "empty-extract" };
  }
  const sentences = splitSentences(extractText);
  if (sentences.length === 0) return { rejected: "no-sentences" };
  // Highest hook score wins; the definitional first sentence ("X is a city
  // in...") only wins ties when nothing later carries a hook.
  let best = -1;
  for (let i = 0; i < sentences.length; i++) {
    const score = hookScore(sentences[i]);
    if (score === 0) continue;
    if (best === -1) {
      best = i;
      continue;
    }
    const bestScore = hookScore(sentences[best]);
    if (score > bestScore || (score === bestScore && best === 0 && i > 0)) best = i;
  }
  if (best === -1) return { rejected: "no-hook-pattern" };
  const sentence = stripParens(sentences[best]);
  if (sentence.length < HISTORY_MIN_LEN) return { rejected: "too-short" };
  if (sentence.length > HISTORY_MAX_LEN) return { rejected: "too-long" };
  return { sentence };
}

const BANNED_PATTERNS = [
  /°/, // coordinates never belong in a kid's card
  /\b\d[\d,]*\s*(m|ft|feet|metres|meters)\b.*\b(above|elevation|a\.s\.l\.)/i,
  /\belevation\b/i,
  /\bpopulation\s+of\b/i,
  /\bcensus\b/i,
];

/** Content words: lowercase alphanumerics longer than 3 chars. */
export function contentWords(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length > 3);
}

/**
 * No-fabrication gate: every content word of the history sentence must
 * appear in the source extract, it must fit the card, carry no banned
 * filler, and not restate the geography blurb. Returns violation strings
 * (empty = valid).
 */
export function validateHistory(sentence, extractText, blurb) {
  const violations = [];
  if (typeof sentence !== "string" || sentence.length < HISTORY_MIN_LEN) {
    violations.push("too-short");
  }
  if (sentence.length > HISTORY_MAX_LEN) violations.push("too-long");
  if (!/[.!?]$/.test(sentence.trim())) violations.push("no-terminal-punctuation");
  for (const re of BANNED_PATTERNS) {
    if (re.test(sentence)) {
      violations.push(`banned-pattern ${re.source.slice(0, 40)}`);
      break;
    }
  }
  const extractWords = new Set(contentWords(extractText ?? ""));
  const missing = contentWords(sentence).filter((w) => !extractWords.has(w));
  if (missing.length > 0) {
    violations.push(`fabricated words: ${missing.slice(0, 6).join(", ")}`);
  }
  if (typeof blurb === "string" && blurb.length > 0) {
    const blurbWords = new Set(contentWords(blurb));
    const sentWords = contentWords(sentence);
    const overlap = sentWords.filter((w) => blurbWords.has(w)).length;
    if (sentWords.length > 0 && overlap / sentWords.length >= 0.6) {
      violations.push("restates-geography-blurb");
    }
  }
  return violations;
}

/**
 * Choose the article for a place from one geosearch response. Two passes:
 *   1. exact base-name match — "Tuscumbia, Alabama" beats
 *      "Tuscumbia Historic District" for the town of Tuscumbia;
 *   2. containment fallback for articles like "Edna, Texas".
 * Returns the page object or null. Coordinates are already within
 * GEO_RADIUS_M by construction of the query.
 */
export function pickArticle(pages, placeName) {
  if (!Array.isArray(pages)) return null;
  const want = normalizeTitle(placeName);
  const baseOf = (title) => normalizeTitle(title).split(",")[0].trim();
  for (const page of pages) {
    if (page && typeof page.title === "string" && baseOf(page.title) === want) {
      return page;
    }
  }
  for (const page of pages) {
    if (page && typeof page.title === "string" && titlesMatch(page.title, placeName)) {
      return page;
    }
  }
  return null;
}

export function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// Wikipedia API (polite, paced)
// ---------------------------------------------------------------------------

let lastStart = 0;
const inflight = new Set();
let consecutiveNetErrors = 0;
let cooldownPromise = null;
const NET_ERROR_COOLDOWN_AT = 25; // consecutive network failures before pausing

// Circuit breaker: when the network (or Wikipedia) is down, fail-fast error
// records would burn through the whole queue in minutes and leave everything
// for a resume pass. Instead, park all workers on one shared cooldown probe
// until Wikipedia answers again, then continue where we left off.
async function waitForNetworkRecovery() {
  if (cooldownPromise) return cooldownPromise;
  cooldownPromise = (async () => {
    console.error("[crawl] network failing — pausing until Wikipedia responds…");
    for (;;) {
      await new Promise((r) => setTimeout(r, 30_000));
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 15_000);
        try {
          const res = await fetch(
            "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json",
            { headers: { "User-Agent": USER_AGENT }, signal: ctl.signal },
          );
          if (res.ok) break;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // Still down — keep waiting.
      }
    }
    consecutiveNetErrors = 0;
    cooldownPromise = null;
    console.error("[crawl] network recovered — resuming");
  })();
  return cooldownPromise;
}

export function isNetError(err) {
  return (
    err instanceof TypeError ||
    err?.name === "AbortError" ||
    /fetch failed|network|econn|enotfound|etimedout|eai_again/i.test(String(err?.message ?? err))
  );
}

async function pacedFetch(url) {
  while (inflight.size >= CONCURRENCY) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const wait = TICK_MS - (Date.now() - lastStart);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastStart = Date.now();
  const p = (async () => {
    let attempt = 0;
    for (;;) {
      // 30 s cap per attempt: a tar-pitted or dead connection becomes a
      // retriable "error" instead of hanging the crawl forever.
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: ctl.signal,
        });
        if (res.status === 429 || res.status === 503) {
          const retryAfter = Number(res.headers.get("retry-after") ?? "5");
          await new Promise((r) => setTimeout(r, Math.min(60, retryAfter || 5) * 1000));
          continue;
        }
        if (!res.ok) throw new Error(`wikipedia ${res.status} for ${url.slice(0, 120)}`);
        consecutiveNetErrors = 0;
        return res.json();
      } catch (err) {
        if (isNetError(err)) {
          consecutiveNetErrors++;
          if (consecutiveNetErrors >= NET_ERROR_COOLDOWN_AT) {
            await waitForNetworkRecovery();
            continue; // retry the same attempt after recovery
          }
        }
        attempt++;
        if (attempt >= 4) throw err;
        // Transient failure — back off, then retry the attempt.
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } finally {
        clearTimeout(timer);
      }
    }
  })();
  inflight.add(p);
  try {
    return await p;
  } finally {
    inflight.delete(p);
  }
}

/**
 * One polite call per place: nearby articles (<=10 km) with intro extracts
 * and coordinates. Returns { status, title, extract } where status is one of
 * "matched" | "no-article" | "title-mismatch" | "no-extract" | "error".
 */
export async function resolvePlace(place) {
  const params = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${place.lat}|${place.lon}`,
    ggsradius: String(GEO_RADIUS_M),
    ggslimit: String(GEO_LIMIT),
    prop: "extracts|coordinates",
    exintro: "1",
    explaintext: "1",
    exsentences: String(EXTRACT_SENTENCES),
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
  try {
    const data = await pacedFetch(`${API}?${params}`);
    const pages = data?.query?.pages ?? [];
    const page = pickArticle(pages, place.name);
    if (!page) {
      return { status: pages.length === 0 ? "no-article" : "title-mismatch" };
    }
    const extract = typeof page.extract === "string" ? page.extract.trim() : "";
    if (!extract) return { status: "no-extract", title: page.title };
    const coords = page.coordinates?.[0];
    if (coords) {
      const km = haversineKm(place.lat, place.lon, coords.lat, coords.lon);
      if (km > GEO_RADIUS_M / 1000 + 1) return { status: "too-far", title: page.title };
    }
    return { status: "matched", title: page.title, extract };
  } catch (err) {
    return { status: "error", error: String(err?.message ?? err).slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------
// Crawl driver (resumable JSONL cache)
// ---------------------------------------------------------------------------

function readCache() {
  const done = new Map();
  if (!existsSync(CACHE_PATH)) return done;
  const lines = readFileSync(CACHE_PATH, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      // "error" is transient (network blip, throttling) — never treated as
      // done, so a resume retries those places instead of skipping them.
      if (rec && rec.id && rec.status !== "error") done.set(rec.id, rec);
    } catch {
      // A torn final line from a killed process is skipped; the place is
      // simply re-crawled. Appends are single-line JSON + "\n".
    }
  }
  return done;
}

function loadPlaces() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const notable = JSON.parse(readFileSync(NOTABLE_PATH, "utf8"));
  const notableIds = new Set(
    Object.keys(notable)
      .filter((k) => !k.startsWith("_"))
      .map((gid) => `gn-${gid}`),
  );
  const places = [];
  for (const regionId of Object.keys(manifest.regions).sort()) {
    const chunk = JSON.parse(readFileSync(join(CHUNKS_DIR, `${regionId}.json`), "utf8"));
    for (const p of chunk.places) {
      // Curated notable notes win over enrichment — never overwrite them.
      if (notableIds.has(p.id)) continue;
      // Already enriched records are not re-crawled.
      if (typeof p.history === "string" && p.history.length > 0) continue;
      places.push({ id: p.id, name: p.name, lon: p.lon, lat: p.lat, blurb: p.blurb });
    }
  }
  return places;
}

/**
 * Fixed-size worker pool: exactly `concurrency` workers pull items from a
 * shared cursor until exhausted. Exported for unit tests — the crawl's
 * correctness (never more than `concurrency` in flight) rests on this.
 */
export async function runWorkerPool(items, concurrency, fn) {
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function cmdCrawl(limit = Infinity) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const done = readCache();
  const places = loadPlaces().filter((p) => !done.has(p.id));
  console.log(`places to crawl: ${places.length.toLocaleString("en-US")} (${done.size.toLocaleString("en-US")} cached)`);
  const out = createWriteStream(CACHE_PATH, { flags: "a" });
  const counts = {};
  let n = 0;
  const t0 = Date.now();
  const queue = places.slice(0, limit);
  // Fixed-size worker pool: exactly CONCURRENCY workers pull from a shared
  // cursor. (A Promise.all(queue.map(…)) here would start all ~124k places
  // at once — the pacedFetch in-flight check is check-then-act racy across
  // the await points, so it degrades into a request storm.)
  await runWorkerPool(queue, CONCURRENCY, async (place) => {
    let rec;
    try {
      rec = { id: place.id, ...(await resolvePlace(place)), at: new Date().toISOString() };
    } catch (err) {
      // resolvePlace already retries internally; a throw here is
      // unexpected — record it as a retriable error, never drop the place.
      rec = {
        id: place.id,
        name: place.name,
        status: "error",
        error: String(err?.message ?? err),
        at: new Date().toISOString(),
      };
    }
    // Keep the extract for the merge-time no-fabrication gate.
    out.write(JSON.stringify(rec) + "\n");
    counts[rec.status] = (counts[rec.status] ?? 0) + 1;
    n++;
    if (n % 500 === 0) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  ${n}/${queue.length} in ${el}s  ${JSON.stringify(counts)}`);
    }
  });
  out.end();
  await new Promise((r) => out.on("finish", r));
  console.log(`crawl done: ${n} places  ${JSON.stringify(counts)}`);
}

async function cmdReport() {
  const done = readCache();
  const counts = {};
  let withExtract = 0;
  let hookOk = 0;
  const samples = [];
  for (const rec of done.values()) {
    counts[rec.status] = (counts[rec.status] ?? 0) + 1;
    if (rec.status === "matched" && rec.extract) {
      withExtract++;
      const r = extractHookSentence(rec.extract);
      if (r.sentence) {
        hookOk++;
        if (samples.length < 8) samples.push({ id: rec.id, title: rec.title, sentence: r.sentence });
      }
    }
  }
  console.log(`cached: ${done.size}  ${JSON.stringify(counts)}`);
  console.log(`matched with extract: ${withExtract}, hook sentence found: ${hookOk}`);
  for (const s of samples) console.log(`  - [${s.id}] (${s.title})\n    "${s.sentence}"`);
}

// ---------------------------------------------------------------------------
// Merge driver: validate + patch chunks + refresh manifest bytes
// ---------------------------------------------------------------------------

export function buildHistoryForCacheRec(rec, place) {
  if (rec.status !== "matched" || !rec.extract) return { skipped: rec.status };
  const r = extractHookSentence(rec.extract);
  if (!r.sentence) return { skipped: r.rejected };
  const violations = validateHistory(r.sentence, rec.extract, place.blurb);
  if (violations.length > 0) return { skipped: `invalid: ${violations.join("; ")}` };
  return {
    history: r.sentence,
    wiki: rec.title.replace(/ /g, "_"),
  };
}

async function cmdMerge() {
  const done = readCache();
  if (done.size === 0) {
    console.error("cache is empty — run `crawl` first");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const skipped = {};
  let enriched = 0;
  let totalBytes = 0;
  for (const regionId of Object.keys(manifest.regions).sort()) {
    const path = join(CHUNKS_DIR, `${regionId}.json`);
    const chunk = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    for (const p of chunk.places) {
      if (typeof p.history === "string" && p.history.length > 0) continue;
      const rec = done.get(p.id);
      if (!rec) continue;
      const built = buildHistoryForCacheRec(rec, p);
      if (built.history) {
        p.history = built.history;
        p.wiki = built.wiki;
        enriched++;
        changed = true;
      } else {
        skipped[built.skipped] = (skipped[built.skipped] ?? 0) + 1;
      }
    }
    if (changed) {
      // Field order is stable (history/wiki appended after blurb-era fields
      // by assignment order); counts and ids are untouched.
      writeFileSync(path, JSON.stringify(chunk) + "\n");
    }
    const bytes = statSync(path).size;
    totalBytes += bytes;
    manifest.regions[regionId].bytes = bytes;
  }
  manifest.meta.chunkBytes = totalBytes;
  manifest.meta.enrichment = {
    source: "Wikipedia article intros (CC BY-SA) via the MediaWiki API",
    historySentences: enriched,
    generated: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`merge done: ${enriched.toLocaleString("en-US")} places enriched`);
  console.log(`skipped: ${JSON.stringify(skipped)}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const cmd = process.argv[2];
const onlyMain = process.argv[1] === fileURLToPath(import.meta.url);
if (onlyMain) {
  if (cmd === "crawl") {
    const limit = process.argv[3] ? Number(process.argv[3]) : Infinity;
    await cmdCrawl(limit);
  } else if (cmd === "merge") {
    await cmdMerge();
  } else if (cmd === "report") {
    await cmdReport();
  } else {
    console.error("usage: enrich-wikipedia.mjs <crawl [limit]|merge|report>");
    process.exit(1);
  }
}
