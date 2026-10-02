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
 *     significant word (4+ characters) appears in the source extract.
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
// History often lives in sentence 4+ of an intro; 6 sentences costs the
// same request count with slightly larger responses. Merge-time extraction
// means already-crawled 3-sentence extracts keep working — they just see
// fewer candidates.
const EXTRACT_SENTENCES = 6;
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

/**
 * Remove parenthesized spans: "X (founded 1854) grew" -> "X grew".
 * Loops to a fixpoint so nested parens ("X (a (b) c) grew") are fully
 * removed instead of leaving a stray ")".
 */
export function stripParens(sentence) {
  let prev = sentence;
  for (;;) {
    // [^()]* matches the innermost pair first; looping to a fixpoint
    // removes nested parens fully instead of leaving a stray ")".
    const next = prev.replace(/\s*\([^()]*\)/g, "");
    if (next === prev) return next.replace(/\s+/g, " ").trim();
    prev = next;
  }
}

// Strong hooks: a person, an event, a record, a naming story — the things a
// kid can retell (rule 3). Tier 3 is genuinely historical; tier 1 is
// modern-identity ("known for the Mercedes-Benz plant") — allowed as a last
// resort before the definitional fallback, but it must never outrank a
// founding story (rule 1: history first, modern identity second).
const HISTORICAL_HOOKS = [
  /\bnamed\s+(?:after|for)\s+[^.]{2,80}/i,
  /\brenamed\s+(?:after|for)\s+[^.]{2,80}/i,
  /\bbirthplace\s+of\s+[^.]{2,80}/i,
  /\bsite\s+of\s+(?:the\s+)?[^.]{2,80}/i,
  /\bbattle\s+of\s+[^.]{2,80}/i,
  /\bwas\s+the\s+first\s+[^.]{2,80}/i,
  /\b(?:is|was)\s+the\s+oldest\s+[^.]{2,80}/i,
  /\bplayed\s+(?:a\s+)?(?:key|major|central)\s+role\s+in\s+[^.]{2,80}/i,
];
const MODERN_HOOKS = [
  /\bknown\s+for\s+[^.]{2,80}/i,
  /\bfamous\s+for\s+[^.]{2,80}/i,
  /\bhome\s+to\s+[^.]{2,80}/i,
  /\bhosted\s+[^.]{2,80}/i,
];
// Date anchors only count when the sentence tells more than the date: a
// proper noun (a person, a railroad, a company) or a story keyword must be
// present, otherwise "It incorporated in 1914." would pass as a "hook" and
// no child could retell it.
const DATE_HOOKS = [
  /\b(?:was\s+)?founded\s+in\s+\d{4}/i,
  /\b(?:was\s+)?established\s+in\s+\d{4}/i,
  /\b(?:was\s+)?incorporated\s+in\s+\d{4}/i,
  /\bsettled\s+in\s+(?:the\s+)?\d{4}s?/i,
];
const STORY_KEYWORDS =
  /\b(railroad|railway|gold|silver|oil|cotton|battle|war|trail|fort|mission|mill|mine|mining|canal|port|depot|expedition|revolution|protest|march|boycott|strike|flood|fire|tornado|space|rocket|music|jazz|blues|baseball|football|settlers?|pioneer|frontier|homestead)\b/i;
// Generic admin words don't count as the "proper noun" that makes a date
// anchor a story: "incorporated in 1914 by the County Commission" is
// paperwork, not a hook any child could retell.
const ADMIN_WORDS = /\b(county|commission|council|board|district|city|town|village|municipality|government|department|authority)\b/i;
// Hooks are verbatim Wikipedia sentences, and some intros lead
// with violence. A kids' game never leads a card with these — the sentence
// is rejected and the card keeps its plain blurb.
const UNSAFE_HOOK_PATTERNS = [
  /\bmassacre\b/i,
  /\blynch(?:ing|ed|es)?\b/i,
  /\bmurder(?:ed|er)?\b/i,
  /\brape\b/i,
  /\bKKK\b/,
  /\bku klux klan\b/i,
  /\bterrorist\b/i,
  /\bgenocide\b/i,
  /\btorture\b/i,
];

// US states/territories: a "proper noun" that is just the state name
// ("incorporated in 1914 in Alabama") is geography, not a story.
const US_STATE_NAMES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
  "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia",
  "washington", "west virginia", "wisconsin", "wyoming",
  "district of columbia", "puerto rico", "guam",
];

/** First capitalized phrase in the sentence names a US state/territory. */
function startsWithStateName(phrase) {
  const p = phrase.toLowerCase();
  return US_STATE_NAMES.some((s) => p === s || p.startsWith(s + " "));
}

function hookScore(sentence, nameTokens = new Set()) {
  for (const re of UNSAFE_HOOK_PATTERNS) {
    if (re.test(sentence)) return -1; // rejected, not just unscored
  }
  for (const re of HISTORICAL_HOOKS) {
    if (re.test(sentence)) return 3;
  }
  for (const re of DATE_HOOKS) {
    if (re.test(sentence)) {
      // The capitalized phrase must be a story carrier (a person, a
      // railroad, a company) — not admin paperwork, not the state name
      // every geographic sentence contains, and not the place's own name.
      const m = sentence.match(/\s([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){0,2})/);
      const phrase = m ? m[1] : "";
      const word = phrase.split(" ")[0].toLowerCase();
      const properNoun =
        phrase.length > 0 &&
        !ADMIN_WORDS.test(phrase) &&
        !startsWithStateName(phrase) &&
        !nameTokens.has(word);
      return STORY_KEYWORDS.test(sentence) || properNoun ? 2 : 0;
    }
  }
  for (const re of MODERN_HOOKS) {
    if (re.test(sentence)) return 1;
  }
  return 0;
}

export const HISTORY_MIN_LEN = 20;
export const HISTORY_MAX_LEN = 240;

/**
 * Pick the hook sentence from a Wikipedia intro extract. Returns
 * `{ sentence }` or `{ rejected }`. The sentence is verbatim from the
 * extract minus parentheticals — never rewritten, never extended.
 * `placeName` feeds the date-anchor guard: the place's own name is
 * geography, not a story carrier.
 */
export function extractHookSentence(extractText, placeName = "") {
  if (typeof extractText !== "string" || extractText.trim().length === 0) {
    return { rejected: "empty-extract" };
  }
  const nameTokens = new Set(
    String(placeName).toLowerCase().match(/[a-z]+/g) ?? [],
  );
  const sentences = splitSentences(extractText);
  if (sentences.length === 0) return { rejected: "no-sentences" };
  // Highest hook score wins; unsafe sentences (score -1) can never win, so a
  // card with only violent hooks keeps its plain blurb. Ties keep the
  // earlier sentence — a hook-bearing first sentence is never displaced.
  let best = -1;
  for (let i = 0; i < sentences.length; i++) {
    const score = hookScore(sentences[i], nameTokens);
    if (score <= 0) continue;
    if (best === -1 || score > hookScore(sentences[best], nameTokens)) best = i;
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
  /\bpopulation\b/i, // "population of" and bare "population 5,000" alike
  /\b\d[\d,]*\s*(people|residents|inhabitants|households)\b/i, // bare stats teach nothing
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
export function validateHistory(sentence, extractText, blurb, placeName = "") {
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
    // The place name and its region words appear in every good hook
    // ("Edna was founded in 1882 in southeastern Texas") — exclude them
    // before measuring overlap, or the check eats legitimate history.
    const nameTokens = new Set(
      String(placeName).toLowerCase().match(/[a-z0-9]+/g) ?? [],
    );
    const blurbWords = new Set(
      contentWords(blurb).filter((w) => !nameTokens.has(w)),
    );
    const sentWords = contentWords(sentence).filter((w) => !nameTokens.has(w));
    const overlap = sentWords.filter((w) => blurbWords.has(w)).length;
    if (sentWords.length > 0 && overlap / sentWords.length >= 0.75) {
      violations.push("restates-geography-blurb");
    }
  }
  return violations;
}

/**
 * Choose the article for a place from one geosearch response. Three passes:
 *   1. exact base-name match on a non-disambiguated title — "Tuscumbia,
 *      Alabama" beats "Tuscumbia Historic District" for Tuscumbia;
 *   2. parenthetical disambiguation with a geographic paren —
 *      "Auburn (Nebraska)" for Auburn, but never "Springfield (band)";
 *   3. (none — fail closed: a card never borrows another article's history).
 * Returns the page object or null. Coordinates are already within
 * GEO_RADIUS_M by construction of the query.
 */
export function pickArticle(pages, placeName) {
  if (!Array.isArray(pages)) return null;
  const want = normalizeTitle(placeName);
  const baseOf = (title) => normalizeTitle(title).split(",")[0].trim();
  // Pass 1: exact match, undisambiguated title preferred.
  for (const page of pages) {
    if (
      page &&
      typeof page.title === "string" &&
      !page.title.includes("(") &&
      baseOf(page.title) === want
    ) {
      return page;
    }
  }
  // Pass 2: the paren must look geographic (state name, 2-letter code, or
  // comma-separated "City (State, Country)"). Anything else — a band, a
  // song, a university — fails closed.
  const parenOf = (title) => {
    const m = title.match(/\(([^)]*)\)/);
    return m ? m[1] : "";
  };
  const parenIsGeographic = (paren) => {
    const p = paren.trim().toLowerCase();
    return (
      p.includes(",") ||
      /^[a-z]{2}$/.test(p) ||
      startsWithStateName(p) ||
      US_STATE_NAMES.some((s) => p.includes(s))
    );
  };
  for (const page of pages) {
    if (
      page &&
      typeof page.title === "string" &&
      baseOf(page.title) === want &&
      parenIsGeographic(parenOf(page.title))
    ) {
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
  // Safety net: the worker pool already caps concurrency at CONCURRENCY, so
  // this gate is normally open. It only engages if pacedFetch is ever called
  // outside the pool.
  while (inflight.size >= CONCURRENCY) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const wait = TICK_MS - (Date.now() - lastStart);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastStart = Date.now();
  const p = (async () => {
    let attempt = 0;
    let throttleRetries = 0;
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
          // Throttling is not a network outage: honor Retry-After, but
          // count it — a persistently throttled IP must become a retriable
          // "error" record, not an infinite sleep-retry loop wedging the
          // worker with no progress log.
          if (++throttleRetries > 10) {
            throw new Error(`wikipedia throttled ${res.status} x${throttleRetries}`);
          }
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
 * "matched" | "no-article" | "title-mismatch" | "no-extract" | "too-far" |
 * "error". "too-far" means the title matched but the article's coordinates
 * are outside the 10 km radius — kept distinct from "title-mismatch" so the
 * report shows resolution quality honestly.
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

/**
 * Resume invariant: "error" records are transient (network blip, throttling)
 * and must be retried, never treated as done. Exported for unit tests —
 * this is the single most important correctness property of the crawl.
 */
const DONE_STATUSES = new Set(["matched", "no-article", "title-mismatch", "no-extract", "too-far"]);
export function isDoneRecord(rec) {
  return !!rec && typeof rec.id === "string" && DONE_STATUSES.has(rec.status);
}

function readCache() {
  const done = new Map();
  if (!existsSync(CACHE_PATH)) return done;
  const lines = readFileSync(CACHE_PATH, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (isDoneRecord(rec)) done.set(rec.id, rec);
    } catch {
      // A torn final line from a killed process is skipped; the place is
      // simply re-crawled. Appends are single-line JSON + "\n".
    }
  }
  return done;
}

function loadNotableIds() {
  const notable = JSON.parse(readFileSync(NOTABLE_PATH, "utf8"));
  return new Set(
    Object.keys(notable)
      .filter((k) => !k.startsWith("_"))
      .map((gid) => `gn-${gid}`),
  );
}

function loadPlaces() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const notableIds = loadNotableIds();
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

/**
 * Wikipedia article slug for the runtime's source link
 * (`https://en.wikipedia.org/wiki/${slug}`). Spaces become underscores;
 * everything else unsafe in a URL path is percent-encoded, while the
 * characters Wikipedia itself leaves readable (",", ":", "/") are kept.
 */
export function wikiSlug(title) {
  return encodeURIComponent(title.replace(/ /g, "_"))
    .replace(/%2C/gi, ",")
    .replace(/%3A/gi, ":")
    .replace(/%2F/gi, "/");
}

export function buildHistoryForCacheRec(rec, place) {
  if (rec.status !== "matched" || !rec.extract) return { skipped: rec.status };
  const r = extractHookSentence(rec.extract, place.name);
  if (!r.sentence) return { skipped: r.rejected };
  const violations = validateHistory(r.sentence, rec.extract, place.blurb, place.name);
  if (violations.length > 0) return { skipped: `invalid: ${violations.join("; ")}` };
  return {
    history: r.sentence,
    wiki: wikiSlug(rec.title),
  };
}

async function cmdMerge() {
  const done = readCache();
  if (done.size === 0) {
    console.error("cache is empty — run `crawl` first");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const notableIds = loadNotableIds();
  const skipped = {};
  let enriched = 0;
  let totalBytes = 0;
  for (const regionId of Object.keys(manifest.regions).sort()) {
    const path = join(CHUNKS_DIR, `${regionId}.json`);
    const chunk = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    for (const p of chunk.places) {
      if (typeof p.history === "string" && p.history.length > 0) continue;
      // Curated notable notes win — a stale cache entry never merges a
      // Wikipedia hook onto a curated-notable place (mirrors loadPlaces).
      if (notableIds.has(p.id)) continue;
      const rec = done.get(p.id);
      if (!rec) continue;
      const built = buildHistoryForCacheRec(rec, p);
      if (built.history) {
        p.history = built.history;
        p.wiki = built.wiki;
        // The card now has its hook — clear the hook-missing marker so the
        // linter stops flagging it (card-compose.mjs contract).
        delete p.hookMissing;
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
  // historySentences accumulates across merge runs (crawl → merge → crawl →
  // merge), so the manifest never undercounts after a resumed crawl.
  const prevEnriched = manifest.meta.enrichment?.historySentences ?? 0;
  manifest.meta.enrichment = {
    source: "Wikipedia article intros (CC BY-SA) via the MediaWiki API",
    historySentences: prevEnriched + enriched,
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
