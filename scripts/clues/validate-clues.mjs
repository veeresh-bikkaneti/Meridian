/**
 * GeoDetective clue-set validator — library + CLI.
 *
 * What this validator is (and is not)
 * -----------------------------------
 * This enforces the MECHANICAL parts of the clue contract only:
 * schema shape, clue / sentence length, name-leak ban (word-boundary
 * plus fragment/embedded match, reusing the seed-guard semantics of
 * scripts/build-loop.mjs on feat/meridian-loop), tier-1 coordinate /
 * elevation phrasing patterns, per-clue source presence and verbatim
 * traceability to a supplied extract, difficulty / aliases recording,
 * a token-overlap proxy for climate-vs-geography redundancy, a
 * climate-lexicon proxy for "does the climate clue mention weather at
 * all", and a Flesch-Kincaid reading-level ceiling.
 *
 * Semantic tier-fit (does this history clue really teach history? does
 * the hook actually hook? is tier 5 a giveaway rather than a summary?)
 * and true semantic redundancy are NOT mechanically decidable. No
 * token test here proves them; those remain human-review judgements.
 * The mechanical proxies below are deliberately conservative and fail
 * closed where verification is impossible (e.g. a clue set with
 * clueSources but no extract to check them against is rejected with
 * SOURCE_UNTRACEABLE, never waved through).
 *
 * No dependencies, deterministic, no network, no LLM anything.
 *
 * CLI:
 *   node scripts/clues/validate-clues.mjs <set.json> \
 *     [--name "Place Name"] [--aliases a,b] [--banned a,b] \
 *     [--extract <file>]
 * Prints the JSON result to stdout; exit 0 if ok, else 1.
 * If --name is omitted, nothing is derived from placeId: leak checking
 * then covers only set.aliases plus any --aliases / --banned terms.
 * --aliases / --banned are comma-separated lists for ctx.aliases /
 * ctx.bannedTerms respectively.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DIFFICULTIES, LIMITS, normalizeName } from "./schema.mjs";

// ---------------------------------------------------------------------------
// Mechanical proxies: stopwords, climate lexicon, syllables
// ---------------------------------------------------------------------------

/**
 * Common English function words (~45) dropped before the climate /
 * geography token-overlap comparison, so the Jaccard score reflects
 * content words rather than grammar both clues inevitably share.
 * Proxy limit: this list is fixed and English-only; a content word
 * missing from it still counts toward overlap.
 */
export const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "has",
  "have",
  "had",
  "its",
  "it",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "where",
  "when",
  "which",
  "who",
  "while",
  "during",
  "each",
  "than",
  "then",
  "into",
  "over",
  "under",
  "near",
]);

/**
 * Climate-signal lexicon (proxy): weather / season words. If the
 * climate clue (tier 1) contains zero tokens from this set, it carries
 * no mechanical evidence of being about climate at all
 * (CLIMATE_NO_SIGNAL). Proxy limit: exact-token match against this
 * fixed list — a genuinely climatic phrasing using only words outside
 * the list will be flagged, and a listed word used non-climatically
 * will pass. Human review remains the semantic judge.
 */
export const CLIMATE_LEXICON = new Set([
  "rain",
  "snow",
  "winter",
  "summer",
  "spring",
  "autumn",
  "fall",
  "wind",
  "winds",
  "storm",
  "storms",
  "monsoon",
  "dry",
  "wet",
  "humid",
  "humidity",
  "hot",
  "cold",
  "warm",
  "cool",
  "freeze",
  "freezing",
  "frost",
  "drought",
  "typhoon",
  "hurricane",
  "temperatures",
  "temperature",
  "climate",
  "seasons",
  "seasonal",
  "rainfall",
  "sunny",
  "cloudy",
  "fog",
  "fogs",
  "heat",
  "chill",
  "mild",
  "damp",
  "arid",
  "breezy",
]);

/**
 * Syllable-count heuristic (proxy for Flesch-Kincaid):
 * count groups of consecutive vowels (a e i o u y) in the lowercased
 * word; apply a silent-e adjustment (a trailing "e" does not add a
 * syllable, except after consonant+"le" as in "table"); minimum 1.
 * It miscounts some words (e.g. irregular vowel clusters), which is
 * acceptable for a ceiling check with headroom, not for fine grading.
 */
export function countSyllables(rawWord) {
  const w = String(rawWord)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith("e")) {
    const consonantLe = w.endsWith("le") && w.length > 2 && !"aeiouy".includes(w[w.length - 3]);
    if (!consonantLe) count -= 1;
  }
  return Math.max(1, count);
}

/**
 * Flesch-Kincaid grade level:
 *   0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
 * Words are alphabetic tokens; sentences are split on [.!?]+ (a text
 * with words but no terminator counts as one sentence). Empty text
 * grades 0.
 */
export function fleschKincaidGrade(text) {
  if (typeof text !== "string") return 0;
  const words = text.match(/[A-Za-z']+/g) ?? [];
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentenceCount) + 11.8 * (syllables / words.length) - 15.59;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function collapseWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function contentTokens(text) {
  const norm = normalizeName(text);
  if (!norm) return new Set();
  return new Set(norm.split(" ").filter((tok) => tok && !STOPWORDS.has(tok)));
}

function rawTokens(text) {
  const norm = normalizeName(text);
  if (!norm) return [];
  return norm.split(" ").filter(Boolean);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Collect every leak term (normalized, de-duplicated) from ctx + set. */
function leakTerms(set, ctx) {
  const raw = [];
  if (isNonEmptyString(ctx.placeName)) raw.push(ctx.placeName);
  if (Array.isArray(set.aliases)) {
    for (const a of set.aliases) if (typeof a === "string") raw.push(a);
  }
  if (Array.isArray(ctx.aliases)) {
    for (const a of ctx.aliases) if (typeof a === "string") raw.push(a);
  }
  if (Array.isArray(ctx.bannedTerms)) {
    for (const a of ctx.bannedTerms) if (typeof a === "string") raw.push(a);
  }
  const seen = new Set();
  const terms = [];
  for (const term of raw) {
    const norm = normalizeName(term);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    terms.push(norm);
  }
  return terms;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate one production clue set.
 *
 * @param {*} set  Parsed clue-set JSON (any value; malformed input
 *   yields reasons, never a throw).
 * @param {{placeName?: string, aliases?: string[], bannedTerms?: string[],
 *   extractText?: string}} [ctx]
 * @returns {{ok: boolean, reasons: Array<{code: string, tier?: number,
 *   detail: string}>}} All violations found, in check order.
 */
export function validateClueSet(set, ctx = {}) {
  const reasons = [];
  const push = (code, detail, tier) => {
    const reason = { code };
    if (tier !== undefined) reason.tier = tier;
    reason.detail = detail;
    reasons.push(reason);
  };
  const safeCtx = ctx && typeof ctx === "object" ? ctx : {};

  // -- Malformed top level ---------------------------------------------------
  if (!set || typeof set !== "object" || Array.isArray(set)) {
    push("SCHEMA_FIELD", "set must be an object");
    return { ok: false, reasons };
  }

  // -- SCHEMA ----------------------------------------------------------------
  if (set.v !== 1) {
    push("SCHEMA_VERSION", `v must be 1, got ${JSON.stringify(set.v)}`);
  }
  if (!isNonEmptyString(set.placeId)) {
    push("SCHEMA_FIELD", "placeId must be a non-empty string");
  }
  if (!set.target || typeof set.target !== "object" || Array.isArray(set.target)) {
    push("SCHEMA_FIELD", "target must be an object with lon and lat");
  } else {
    const { lon, lat } = set.target;
    if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      push(
        "SCHEMA_FIELD",
        `target.lon must be a finite number in [-180, 180], got ${JSON.stringify(lon)}`,
      );
    }
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      push(
        "SCHEMA_FIELD",
        `target.lat must be a finite number in [-90, 90], got ${JSON.stringify(lat)}`,
      );
    }
  }
  if (!set.source || typeof set.source !== "object" || Array.isArray(set.source)) {
    push("SCHEMA_FIELD", "source must be an object with label and href");
  } else {
    if (!isNonEmptyString(set.source.label)) {
      push("SCHEMA_FIELD", "source.label must be a non-empty string");
    }
    if (!isNonEmptyString(set.source.href)) {
      push("SCHEMA_FIELD", "source.href must be a non-empty string");
    }
  }

  // -- TIER_COUNT / TIER_EMPTY -------------------------------------------------
  const cluesIsArray = Array.isArray(set.clues);
  if (!cluesIsArray) {
    push("TIER_COUNT", "clues must be an array of exactly 5 strings");
  } else {
    if (set.clues.length !== 5) {
      push("TIER_COUNT", `clues must contain exactly 5 entries, got ${set.clues.length}`);
    }
    set.clues.forEach((clue, tier) => {
      if (!isNonEmptyString(clue)) {
        push("TIER_EMPTY", `clue at tier ${tier} is empty or not a string`, tier);
      }
    });
  }
  const stringClues = cluesIsArray
    ? set.clues.map((c) => (isNonEmptyString(c) ? c : null))
    : [null, null, null, null, null];

  // -- DIFFICULTY ---------------------------------------------------------------
  if (set.difficulty === undefined || set.difficulty === null) {
    push("DIFFICULTY_MISSING", "difficulty is missing");
  } else if (!DIFFICULTIES.includes(set.difficulty)) {
    push(
      "DIFFICULTY_INVALID",
      `difficulty must be one of ${DIFFICULTIES.join(", ")}, got ${JSON.stringify(set.difficulty)}`,
    );
  }

  // -- ALIASES --------------------------------------------------------------------
  if (!Array.isArray(set.aliases)) {
    push("ALIASES_MISSING", "aliases is missing or not an array");
  } else if (!set.aliases.every((a) => typeof a === "string")) {
    push("ALIASES_MISSING", "aliases must be an array of strings");
  }

  // -- SOURCE_MISSING --------------------------------------------------------------
  let clueSourcesUsable = false;
  if (!Array.isArray(set.clueSources)) {
    push("SOURCE_MISSING", "clueSources is missing or not an array");
  } else if (set.clueSources.length !== 5) {
    push(
      "SOURCE_MISSING",
      `clueSources must contain exactly 5 entries, got ${set.clueSources.length}`,
    );
  } else {
    clueSourcesUsable = true;
    set.clueSources.forEach((entry, tier) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !isNonEmptyString(entry.snippet) ||
        !isNonEmptyString(entry.extractId)
      ) {
        clueSourcesUsable = false;
        push(
          "SOURCE_MISSING",
          `clueSources[${tier}] must have non-empty snippet and extractId`,
          tier,
        );
      }
    });
  }

  // -- Per-clue checks --------------------------------------------------------------
  const terms = leakTerms(set, safeCtx);

  stringClues.forEach((clue, tier) => {
    if (clue === null) return;

    // Length: whole clue and each sentence.
    const words = wordCount(clue);
    if (words > LIMITS.MAX_CLUE_WORDS) {
      push("CLUE_TOO_LONG", `clue has ${words} words (max ${LIMITS.MAX_CLUE_WORDS})`, tier);
    }
    for (const sentence of clue.split(/[.!?]+/)) {
      if (!sentence.trim()) continue;
      const sWords = wordCount(sentence);
      if (sWords > LIMITS.MAX_SENTENCE_WORDS) {
        push(
          "SENTENCE_TOO_LONG",
          `sentence has ${sWords} words (max ${LIMITS.MAX_SENTENCE_WORDS})`,
          tier,
        );
      }
    }

    // Name leak: word-boundary match on the normalized clue (padded
    // with spaces), plus the fragment rule — a term that is itself a
    // single token of length >= 4 is also rejected when embedded
    // inside a different clue token (e.g. "paris" inside "parisian").
    // Multi-word terms are phrase-matched only: their generic
    // constituent words ("city", "south") are NOT banned on their own.
    // This matches the build-loop seed-guard semantics exactly
    // (aligned during Phase 1 integration; an earlier draft also
    // decomposed multi-word terms, which false-fired on ordinary words
    // like "southwestern" and "megacity" in the seed sets).
    if (terms.length > 0) {
      const norm = normalizeName(clue);
      const padded = ` ${norm} `;
      const tokens = norm ? norm.split(" ").filter(Boolean) : [];
      for (const term of terms) {
        if (padded.includes(` ${term} `)) {
          push("NAME_LEAK", `clue contains banned term "${term}"`, tier);
        }
        if (!term.includes(" ") && term.length >= 4) {
          const reportedFragments = new Set();
          for (const tok of tokens) {
            if (tok !== term && tok.includes(term) && !reportedFragments.has(tok)) {
              reportedFragments.add(tok);
              push(
                "NAME_LEAK",
                `clue contains banned term "${term}" embedded in token "${tok}"`,
                tier,
              );
            }
          }
        }
      }
    }

    // Tier-1 (geography) coordinate / elevation patterns — mechanical
    // patterns only, checked on the raw lowercased clue.
    if (tier === 0) {
      const lower = clue.toLowerCase();
      const matched = [];
      if (/\d+\.\d+/.test(clue)) matched.push("decimal number");
      if (/\b(latitude|longitude|coordinates|elevation|altitude)\b/.test(lower)) {
        matched.push("coordinate/elevation word");
      }
      if (lower.includes("above sea level")) matched.push('"above sea level"');
      if (/\bdegrees\s+(north|south|east|west)\b/.test(lower)) {
        matched.push('"degrees <direction>"');
      }
      if (matched.length > 0) {
        push(
          "TIER1_COORDS",
          `geography clue uses forbidden pattern(s): ${matched.join(", ")}`,
          tier,
        );
      }
    }

    // Reading level.
    const grade = fleschKincaidGrade(clue);
    if (grade > LIMITS.MAX_FK_GRADE) {
      push(
        "READING_LEVEL",
        `Flesch-Kincaid grade ${grade.toFixed(1)} exceeds max ${LIMITS.MAX_FK_GRADE}`,
        tier,
      );
    }
  });

  // -- Climate proxies (tier 1 vs tier 0) -------------------------------------------
  const geoClue = stringClues[0] ?? null;
  const climateClue = stringClues[1] ?? null;
  if (geoClue !== null && climateClue !== null) {
    const geoTokens = contentTokens(geoClue);
    const climateTokens = contentTokens(climateClue);
    const union = new Set([...geoTokens, ...climateTokens]);
    if (union.size > 0) {
      let intersection = 0;
      for (const tok of geoTokens) if (climateTokens.has(tok)) intersection += 1;
      const jaccard = intersection / union.size;
      if (jaccard >= LIMITS.CLIMATE_MAX_JACCARD) {
        push(
          "CLIMATE_REDUNDANT",
          `climate/geography content-token Jaccard ${jaccard.toFixed(2)} >= ${LIMITS.CLIMATE_MAX_JACCARD}`,
          1,
        );
      }
    }
    const climateRaw = rawTokens(climateClue);
    if (!climateRaw.some((tok) => CLIMATE_LEXICON.has(tok))) {
      push("CLIMATE_NO_SIGNAL", "climate clue contains no token from the climate lexicon", 1);
    }
  }

  // -- SOURCE_UNTRACEABLE --------------------------------------------------------------
  // Whitespace choice (documented): both snippet and extract are
  // whitespace-collapsed (every run of whitespace -> one space, trimmed)
  // before comparison; the comparison itself is case-sensitive, so a
  // snippet must match the extract's exact characters and casing.
  if (clueSourcesUsable) {
    if (safeCtx.extractText === undefined || safeCtx.extractText === null) {
      // Fail closed: sources were recorded but nothing was supplied
      // to verify them against.
      push("SOURCE_UNTRACEABLE", "no extract supplied; cannot verify");
    } else {
      const extractNorm = collapseWhitespace(String(safeCtx.extractText));
      set.clueSources.forEach((entry, tier) => {
        const snippetNorm = collapseWhitespace(entry.snippet);
        if (!extractNorm.includes(snippetNorm)) {
          push(
            "SOURCE_UNTRACEABLE",
            `clueSources[${tier}] snippet not found verbatim in extract`,
            tier,
          );
        }
      });
    }
  }

  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// CLI (thin wrapper over validateClueSet)
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const opts = {
    file: null,
    name: undefined,
    aliases: undefined,
    banned: undefined,
    extract: undefined,
  };
  const list = (v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--name") opts.name = argv[++i];
    else if (arg === "--aliases") opts.aliases = list(argv[++i] ?? "");
    else if (arg === "--banned") opts.banned = list(argv[++i] ?? "");
    else if (arg === "--extract") opts.extract = argv[++i];
    else if (!arg.startsWith("--") && opts.file === null) opts.file = arg;
  }
  return opts;
}

function main(argv) {
  const opts = parseCliArgs(argv);
  if (!opts.file) {
    console.error(
      'Usage: node scripts/clues/validate-clues.mjs <set.json> [--name "Place Name"] [--aliases a,b] [--banned a,b] [--extract <file>]',
    );
    process.exitCode = 1;
    return;
  }
  let set;
  try {
    set = JSON.parse(readFileSync(opts.file, "utf8"));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reasons: [{ code: "SCHEMA_FIELD", detail: `cannot read set file: ${err.message}` }],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }
  const ctx = {};
  if (opts.name !== undefined) ctx.placeName = opts.name;
  if (opts.aliases !== undefined) ctx.aliases = opts.aliases;
  if (opts.banned !== undefined) ctx.bannedTerms = opts.banned;
  if (opts.extract !== undefined) {
    try {
      ctx.extractText = readFileSync(opts.extract, "utf8");
    } catch (err) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            reasons: [
              { code: "SOURCE_UNTRACEABLE", detail: `cannot read extract file: ${err.message}` },
            ],
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
  }
  const result = validateClueSet(set, ctx);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
