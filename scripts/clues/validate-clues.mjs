/**
 * GeoDetective clue-set validator — Phase 2, aligned to generation
 * prompt v1 (adopted verbatim at scripts/clues/generation-prompt.md,
 * locked by Veeresh 2026-10-04). Library + CLI.
 *
 * What is validated
 * -----------------
 * A production record in prompt §10 shape
 * ({schema, status, place_id, answer{…}, clues[5 × {tier, tier_name,
 * text, narrowing, source{article, url, quote}}]}), checked against
 * its §9 input ({place{…}, curated_aliases[], extracts[]}) when one is
 * supplied via ctx.input. Rejection records (§6 shape) are checked by
 * validateRejectionRecord().
 *
 * Rules enforced mechanically (fail closed):
 * - schema id / status / place_id, and — when the §9 input is known —
 *   the answer block must match the input place exactly (name, country,
 *   subdivision, lat, lon): a record about a different place than its
 *   input is a pipeline mix-up, never a pass.
 * - difficulty is an integer 1-5 (prompt §8 guessability).
 * - every recorded alias is SOURCED (prompt §8): it appears in the
 *   input's curated_aliases or as a folded substring of a supplied
 *   extract (e.g. a demonym attested in the article text). An unsourced
 *   alias is a leak-ban hole.
 * - exactly 5 clues, tiers 1-5 in ladder order with matching tier_name.
 * - clue length 15-40 words, 1-2 sentences, no sentence over 25 words
 *   (prompt §3 + §7 reading support).
 * - narrowing line present on every clue (prompt §10 field note).
 * - per-clue source fields present; the quote is a verbatim span of
 *   the cited extract (whitespace-collapsed, case-sensitive), at least
 *   LIMITS.MIN_QUOTE_CHARS long — a trivial quote cannot audit a clue.
 * - NAME-LEAK BAN (prompt §4, LOCKED): no clue text may contain, as a
 *   folded substring, the canonical name, any name part of length >= 3,
 *   any alias or alias part of length >= 3, or curated aliases — with
 *   diacritic folding, so "paris" catches "Parisian" and "sao" catches
 *   "São". Name parts shorter than 3 characters ("de", "al") are
 *   enforced as whole tokens only: as raw substrings they occur inside
 *   unrelated common words ("de" in "describe") and would make every
 *   clue for such places unwritable, which is a broken rule rather
 *   than a strict one. Indirect wordplay patterns ("rhymes with",
 *   "sounds like", letter-spelling) are banned by pattern (proxy).
 *   Name-meaning translations as a clue's payload are NOT mechanically
 *   decidable and remain human-review territory (documented gap).
 * - universal writing-rule bans (prompt §3 rule 2), mechanical subset:
 *   census filler (census/population-count phrasing, statistical-area
 *   terms), coordinate/elevation vocabulary in every tier, plus a
 *   decimal-number pattern on tier 1 (coordinate proxy, as Phase 1).
 * - reading level: Flesch-Kincaid grade per clue <= LIMITS.MAX_FK_GRADE
 *   (proxy for the LOCKED reading-age-~10 target; see schema.mjs for
 *   the calibration note).
 * - climate proxies (prompt §2 non-redundancy): content-token Jaccard
 *   between climate and geography clues < 0.5, and the climate clue
 *   must contain at least one climate-lexicon token (signal proxy).
 *   Whether the climate clue truly cites a mechanism / extreme /
 *   paradox (vs a bare classification) is semantic — the verbatim
 *   quote requirement makes it auditable, human review judges it.
 * - tier-5 proxy: the share of the giveaway clue's content tokens
 *   already seen in tiers 1-4 must be < 0.6 (a giveaway that mostly
 *   repeats earlier clues is a summary suspect). Semantic
 *   giveaway-vs-summary judgement stays with human review.
 *
 * No dependencies, deterministic, no network, no LLM anything.
 *
 * CLI:
 *   node scripts/clues/validate-clues.mjs <record.json> [--input <input.json>]
 * Prints the JSON result to stdout; exit 0 if ok, else 1. Without
 * --input, cross-checks against the §9 input are skipped but quote
 * verification fails closed (no extracts supplied → QUOTE_UNTRACEABLE).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  LIMITS,
  SCHEMA_ID,
  TIERS,
  foldText,
  isValidDifficulty,
  normalizeName,
} from "./schema.mjs";

export { foldText, normalizeName };

// ---------------------------------------------------------------------------
// Mechanical proxies: stopwords, climate lexicon, syllables (Phase 1, kept)
// ---------------------------------------------------------------------------

/** Function words dropped before token-overlap comparisons. */
export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to",
  "for", "with", "by", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "has", "have", "had", "its", "it", "this", "that",
  "these", "those", "there", "here", "where", "when", "which", "who",
  "while", "during", "each", "than", "then", "into", "over", "under",
  "near",
]);

/** Climate-signal lexicon (proxy): weather / season words. */
export const CLIMATE_LEXICON = new Set([
  "rain", "snow", "winter", "summer", "spring", "autumn", "fall",
  "wind", "winds", "storm", "storms", "monsoon", "dry", "wet", "humid",
  "humidity", "hot", "cold", "warm", "cool", "freeze", "freezing",
  "frost", "drought", "typhoon", "hurricane", "temperatures",
  "temperature", "climate", "seasons", "seasonal", "rainfall", "sunny",
  "cloudy", "fog", "fogs", "heat", "chill", "mild", "damp", "arid",
  "breezy",
]);

/**
 * Syllable-count heuristic (proxy for Flesch-Kincaid): count groups of
 * consecutive vowels (a e i o u y); silent-e adjustment (a trailing "e"
 * does not add a syllable, except after consonant+"le" as in "table");
 * minimum 1.
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

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentencesOf(text) {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
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

function jaccard(setA, setB) {
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) if (setB.has(tok)) intersection += 1;
  return intersection / union.size;
}

// ---------------------------------------------------------------------------
// Leak terms (prompt §4, LOCKED strict substring rule)
// ---------------------------------------------------------------------------

/**
 * Build the leak-term list for a place: folded canonical name, folded
 * aliases, folded curated aliases — each as a full term plus its
 * space-separated parts. Parts of length >= 3 are substring terms;
 * shorter parts are whole-token terms only (see header note).
 *
 * @returns {Array<{term: string, tokenOnly: boolean, source: string}>}
 */
export function buildLeakTerms(answer, curatedAliases = []) {
  const byTerm = new Map();
  const addTerm = (folded, tokenOnly, source) => {
    if (!folded) return;
    const existing = byTerm.get(folded);
    if (!existing || (existing.tokenOnly && !tokenOnly)) {
      byTerm.set(folded, { term: folded, tokenOnly, source });
    }
  };
  const addName = (raw, source) => {
    const folded = foldText(raw);
    if (!folded) return;
    addTerm(folded, false, source);
    for (const part of folded.split(" ")) {
      if (!part) continue;
      addTerm(part, part.length < 3, `${source} part`);
    }
  };
  if (answer && isNonEmptyString(answer.name)) addName(answer.name, "name");
  if (answer && Array.isArray(answer.aliases)) {
    for (const a of answer.aliases) if (typeof a === "string") addName(a, "alias");
  }
  if (Array.isArray(curatedAliases)) {
    for (const a of curatedAliases) if (typeof a === "string") addName(a, "curated alias");
  }
  return [...byTerm.values()];
}

/**
 * Find leak-term hits in one clue text. Returns one entry per
 * (term, matched form): for substring terms the matched form is the
 * term itself; the check is a raw substring search over the folded
 * clue, so derived forms ("parisian") hit their base term ("paris").
 */
export function findLeaks(clueText, terms) {
  const folded = foldText(clueText);
  if (!folded) return [];
  const tokens = new Set(folded.split(" ").filter(Boolean));
  const hits = [];
  for (const { term, tokenOnly, source } of terms) {
    if (tokenOnly) {
      if (tokens.has(term)) hits.push({ term, source, via: "token" });
    } else if (folded.includes(term)) {
      hits.push({ term, source, via: "substring" });
    }
  }
  return hits;
}

/** Indirect wordplay patterns (prompt §4) — mechanical proxy subset. */
export const WORDPLAY_PATTERNS = [
  /rhymes?\s+with/i,
  /sounds?\s+like/i,
  /anagram/i,
  /spells?\s+(it\s+)?out/i,
  /letter\s+by\s+letter/i,
  /starts?\s+with\s+the\s+letter/i,
  /first\s+letter\s+of/i,
  /initials?\s+spell/i,
];

/** Census / coordinate filler patterns (prompt §3 rule 2), all tiers. */
export const CONTENT_BAN_PATTERNS = [
  { re: /\bcensus\b/i, label: "census reference" },
  { re: /population\s+(of|was|is)\s+[\d]/i, label: "population count" },
  { re: /\b\d[\d,]*\s*(people|residents|inhabitants)\b/i, label: "population count" },
  { re: /metropolitan statistical area/i, label: "statistical-area term" },
  { re: /micropolitan/i, label: "statistical-area term" },
  { re: /census-designated/i, label: "census-designated term" },
  { re: /\b(latitude|longitude|coordinates?|elevation|altitude)\b/i, label: "coordinate/elevation word" },
  { re: /above sea level/i, label: "elevation phrasing" },
  { re: /\bdegrees\s+(north|south|east|west)\b/i, label: "coordinate phrasing" },
];

// ---------------------------------------------------------------------------
// Record validation (prompt §10 accepted records)
// ---------------------------------------------------------------------------

/**
 * Validate one accepted-format production record.
 *
 * @param {*} record  Parsed §10 record (any value; malformed input
 *   yields reasons, never a throw).
 * @param {{input?: {place: object, curated_aliases?: string[],
 *   extracts?: Array<{article: string, url: string, text: string}>}}} [ctx]
 * @returns {{ok: boolean, reasons: Array<{code: string, tier?: number,
 *   detail: string}>}}
 */
export function validateRecord(record, ctx = {}) {
  const reasons = [];
  const push = (code, detail, tier) => {
    const reason = { code };
    if (tier !== undefined) reason.tier = tier;
    reason.detail = detail;
    reasons.push(reason);
  };
  const input = ctx && typeof ctx === "object" ? ctx.input : undefined;
  const inputPlace = input && typeof input === "object" ? input.place : undefined;
  const extracts = input && Array.isArray(input.extracts) ? input.extracts : [];
  const curatedAliases = input && Array.isArray(input.curated_aliases) ? input.curated_aliases : [];

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    push("SCHEMA_FIELD", "record must be an object");
    return { ok: false, reasons };
  }
  if (record.schema !== SCHEMA_ID) {
    push("SCHEMA_ID", `schema must be "${SCHEMA_ID}", got ${JSON.stringify(record.schema)}`);
  }
  if (record.status !== "accepted") {
    push(
      "STATUS_INVALID",
      `validateRecord expects status "accepted", got ${JSON.stringify(record.status)}`,
    );
    return { ok: false, reasons };
  }
  if (!isNonEmptyString(record.place_id)) {
    push("SCHEMA_FIELD", "place_id must be a non-empty string");
  } else if (inputPlace && record.place_id !== inputPlace.place_id) {
    push(
      "PLACE_ID_MISMATCH",
      `place_id ${JSON.stringify(record.place_id)} does not match input ${JSON.stringify(inputPlace.place_id)}`,
    );
  }

  // -- answer block ------------------------------------------------------
  const answer = record.answer;
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    push("ANSWER_FIELD", "answer must be an object");
    return { ok: false, reasons };
  }
  if (!isNonEmptyString(answer.name)) push("ANSWER_FIELD", "answer.name must be a non-empty string");
  if (!isNonEmptyString(answer.country)) push("ANSWER_FIELD", "answer.country must be a non-empty string");
  if (!isNonEmptyString(answer.subdivision)) {
    push("ANSWER_FIELD", "answer.subdivision must be a non-empty string");
  }
  if (typeof answer.lat !== "number" || !Number.isFinite(answer.lat) || answer.lat < -90 || answer.lat > 90) {
    push("ANSWER_FIELD", `answer.lat must be a finite number in [-90, 90], got ${JSON.stringify(answer.lat)}`);
  }
  if (typeof answer.lon !== "number" || !Number.isFinite(answer.lon) || answer.lon < -180 || answer.lon > 180) {
    push("ANSWER_FIELD", `answer.lon must be a finite number in [-180, 180], got ${JSON.stringify(answer.lon)}`);
  }
  if (!isValidDifficulty(answer.difficulty)) {
    push(
      "DIFFICULTY_INVALID",
      `answer.difficulty must be an integer 1-5, got ${JSON.stringify(answer.difficulty)}`,
    );
  }
  if (!Array.isArray(answer.aliases) || !answer.aliases.every((a) => typeof a === "string")) {
    push("ANSWER_FIELD", "answer.aliases must be an array of strings");
  }
  if (inputPlace) {
    if (isNonEmptyString(answer.name) && answer.name !== inputPlace.name) {
      push("ANSWER_MISMATCH", `answer.name ${JSON.stringify(answer.name)} != input name ${JSON.stringify(inputPlace.name)}`);
    }
    if (isNonEmptyString(answer.country) && answer.country !== inputPlace.country) {
      push("ANSWER_MISMATCH", `answer.country ${JSON.stringify(answer.country)} != input country ${JSON.stringify(inputPlace.country)}`);
    }
    if (isNonEmptyString(answer.subdivision) && answer.subdivision !== inputPlace.subdivision) {
      push("ANSWER_MISMATCH", `answer.subdivision ${JSON.stringify(answer.subdivision)} != input subdivision ${JSON.stringify(inputPlace.subdivision)}`);
    }
    if (typeof answer.lat === "number" && Math.abs(answer.lat - inputPlace.lat) > 1e-6) {
      push("ANSWER_MISMATCH", `answer.lat ${answer.lat} != input lat ${inputPlace.lat}`);
    }
    if (typeof answer.lon === "number" && Math.abs(answer.lon - inputPlace.lon) > 1e-6) {
      push("ANSWER_MISMATCH", `answer.lon ${answer.lon} != input lon ${inputPlace.lon}`);
    }
  }

  // -- alias sourcing (prompt §8) ----------------------------------------
  if (Array.isArray(answer.aliases)) {
    const curatedFolded = new Set(curatedAliases.map((a) => foldText(a)));
    const nameFolded = foldText(answer.name ?? "");
    const extractFolded = extracts.map((e) => foldText(e && e.text));
    for (const alias of answer.aliases) {
      const folded = foldText(alias);
      if (!folded || folded === nameFolded) continue;
      if (curatedFolded.has(folded)) continue;
      if (extractFolded.some((text) => text.includes(folded))) continue;
      push(
        "ALIAS_UNSOURCED",
        `alias ${JSON.stringify(alias)} is neither in curated_aliases nor attested in the supplied extracts`,
      );
    }
  }

  // -- clues ---------------------------------------------------------------
  const clues = record.clues;
  if (!Array.isArray(clues)) {
    push("CLUE_COUNT", "clues must be an array of exactly 5 entries");
    return { ok: reasons.length === 0, reasons };
  }
  if (clues.length !== 5) {
    push("CLUE_COUNT", `clues must contain exactly 5 entries, got ${clues.length}`);
  }
  const terms = buildLeakTerms(answer, curatedAliases);
  const clueTexts = [];

  clues.forEach((clue, idx) => {
    const tier = idx + 1;
    if (!clue || typeof clue !== "object" || Array.isArray(clue)) {
      push("SCHEMA_FIELD", `clues[${idx}] must be an object`, tier);
      clueTexts.push(null);
      return;
    }
    if (clue.tier !== tier) {
      push("TIER_ORDER", `clues[${idx}].tier must be ${tier}, got ${JSON.stringify(clue.tier)}`, tier);
    }
    if (clue.tier_name !== TIERS[idx]) {
      push(
        "TIER_NAME",
        `clues[${idx}].tier_name must be "${TIERS[idx]}", got ${JSON.stringify(clue.tier_name)}`,
        tier,
      );
    }
    if (!isNonEmptyString(clue.narrowing)) {
      push("NARROWING_MISSING", `clues[${idx}].narrowing must be a non-empty string`, tier);
    }
    // source fields + verbatim quote
    const source = clue.source;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      push("SOURCE_FIELD", `clues[${idx}].source must be an object {article, url, quote}`, tier);
    } else {
      if (!isNonEmptyString(source.article)) push("SOURCE_FIELD", `clues[${idx}].source.article missing`, tier);
      if (!isNonEmptyString(source.url)) push("SOURCE_FIELD", `clues[${idx}].source.url missing`, tier);
      if (!isNonEmptyString(source.quote)) {
        push("SOURCE_FIELD", `clues[${idx}].source.quote missing`, tier);
      } else {
        const quoteCollapsed = collapseWhitespace(source.quote);
        if (quoteCollapsed.length < LIMITS.MIN_QUOTE_CHARS) {
          push(
            "QUOTE_TRIVIAL",
            `clues[${idx}].source.quote is ${quoteCollapsed.length} chars (min ${LIMITS.MIN_QUOTE_CHARS})`,
            tier,
          );
        }
        if (extracts.length === 0) {
          push("QUOTE_UNTRACEABLE", `clues[${idx}]: no extracts supplied; cannot verify quote`, tier);
        } else {
          const cited =
            extracts.find((e) => e && e.article === source.article) ??
            extracts.find((e) => e && e.url === source.url);
          if (!cited) {
            push(
              "SOURCE_ARTICLE_UNKNOWN",
              `clues[${idx}].source cites article ${JSON.stringify(source.article)} which is not among the supplied extracts`,
              tier,
            );
          } else if (!collapseWhitespace(cited.text ?? "").includes(quoteCollapsed)) {
            push(
              "QUOTE_UNTRACEABLE",
              `clues[${idx}].source.quote not found verbatim in the cited extract`,
              tier,
            );
          }
        }
      }
    }
    // clue text checks
    if (!isNonEmptyString(clue.text)) {
      push("SCHEMA_FIELD", `clues[${idx}].text must be a non-empty string`, tier);
      clueTexts.push(null);
      return;
    }
    clueTexts.push(clue.text);
    const words = wordCount(clue.text);
    if (words < LIMITS.MIN_CLUE_WORDS || words > LIMITS.MAX_CLUE_WORDS) {
      push(
        "CLUE_WORDS",
        `clue has ${words} words (allowed ${LIMITS.MIN_CLUE_WORDS}-${LIMITS.MAX_CLUE_WORDS})`,
        tier,
      );
    }
    const sentences = sentencesOf(clue.text);
    if (sentences.length < LIMITS.MIN_CLUE_SENTENCES || sentences.length > LIMITS.MAX_CLUE_SENTENCES) {
      push(
        "CLUE_SENTENCES",
        `clue has ${sentences.length} sentences (allowed ${LIMITS.MIN_CLUE_SENTENCES}-${LIMITS.MAX_CLUE_SENTENCES})`,
        tier,
      );
    }
    for (const sentence of sentences) {
      const sWords = wordCount(sentence);
      if (sWords > LIMITS.MAX_SENTENCE_WORDS) {
        push("SENTENCE_TOO_LONG", `sentence has ${sWords} words (max ${LIMITS.MAX_SENTENCE_WORDS})`, tier);
      }
    }
    // leak ban
    for (const hit of findLeaks(clue.text, terms)) {
      push("NAME_LEAK", `clue contains banned term "${hit.term}" (${hit.source}, ${hit.via} match)`, tier);
    }
    for (const re of WORDPLAY_PATTERNS) {
      if (re.test(clue.text)) {
        push("NAME_LEAK_INDIRECT", `clue matches wordplay pattern ${re}`, tier);
      }
    }
    // content bans
    for (const { re, label } of CONTENT_BAN_PATTERNS) {
      if (re.test(clue.text)) push("CONTENT_BANNED", `clue contains banned content: ${label}`, tier);
    }
    if (tier === 1 && /\d+\.\d+/.test(clue.text)) {
      push("TIER1_COORDS", "geography clue contains a decimal number (coordinate proxy)", tier);
    }
    // reading level
    const grade = fleschKincaidGrade(clue.text);
    if (grade > LIMITS.MAX_FK_GRADE) {
      push(
        "READING_LEVEL",
        `Flesch-Kincaid grade ${grade.toFixed(1)} exceeds max ${LIMITS.MAX_FK_GRADE}`,
        tier,
      );
    }
  });

  // -- climate proxies -----------------------------------------------------
  const geoText = clueTexts[0];
  const climateText = clueTexts[1];
  if (geoText && climateText) {
    const overlap = jaccard(contentTokens(geoText), contentTokens(climateText));
    if (overlap >= LIMITS.CLIMATE_MAX_JACCARD) {
      push(
        "CLIMATE_REDUNDANT",
        `climate/geography content-token Jaccard ${overlap.toFixed(2)} >= ${LIMITS.CLIMATE_MAX_JACCARD}`,
        2,
      );
    }
    if (!rawTokens(climateText).some((tok) => CLIMATE_LEXICON.has(tok))) {
      push("CLIMATE_NO_SIGNAL", "climate clue contains no token from the climate lexicon", 2);
    }
  }

  // -- tier-5 summary proxy ---------------------------------------------------
  // Overlap coefficient: the share of the giveaway's own content tokens
  // that already appeared in tiers 1-4. A genuine giveaway introduces a
  // new landmark/marker (low share); a recap reuses earlier tokens
  // (high share).
  const giveawayText = clueTexts[4];
  if (giveawayText && clueTexts.slice(0, 4).every(Boolean)) {
    const earlier = new Set();
    for (const t of clueTexts.slice(0, 4)) for (const tok of contentTokens(t)) earlier.add(tok);
    const giveawayTokens = contentTokens(giveawayText);
    if (giveawayTokens.size > 0) {
      let seen = 0;
      for (const tok of giveawayTokens) if (earlier.has(tok)) seen += 1;
      const overlap = seen / giveawayTokens.size;
      if (overlap >= LIMITS.TIER5_MAX_OVERLAP) {
        push(
          "TIER5_SUMMARY",
          `giveaway reuses ${(overlap * 100).toFixed(0)}% of its content tokens from tiers 1-4 (>= ${LIMITS.TIER5_MAX_OVERLAP * 100}%; summary suspect)`,
          5,
        );
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Rejection records (prompt §6)
// ---------------------------------------------------------------------------

/** Validate a §6 rejection record's shape. */
export function validateRejectionRecord(record) {
  const reasons = [];
  const push = (code, detail) => reasons.push({ code, detail });
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    push("SCHEMA_FIELD", "record must be an object");
    return { ok: false, reasons };
  }
  if (record.schema !== SCHEMA_ID) {
    push("SCHEMA_ID", `schema must be "${SCHEMA_ID}", got ${JSON.stringify(record.schema)}`);
  }
  if (record.status !== "rejected") {
    push("STATUS_INVALID", `status must be "rejected", got ${JSON.stringify(record.status)}`);
  }
  if (!isNonEmptyString(record.place_id)) push("SCHEMA_FIELD", "place_id must be a non-empty string");
  const rejection = record.rejection;
  if (!rejection || typeof rejection !== "object" || Array.isArray(rejection)) {
    push("SCHEMA_FIELD", "rejection must be an object {tier, tier_name, reason, missing}");
  } else {
    if (!Number.isInteger(rejection.tier) || rejection.tier < 0 || rejection.tier > 5) {
      push("SCHEMA_FIELD", `rejection.tier must be an integer 0-5, got ${JSON.stringify(rejection.tier)}`);
    } else {
      const expectedName = rejection.tier === 0 ? "set" : TIERS[rejection.tier - 1];
      if (rejection.tier_name !== expectedName) {
        push(
          "SCHEMA_FIELD",
          `rejection.tier_name must be "${expectedName}" for tier ${rejection.tier}, got ${JSON.stringify(rejection.tier_name)}`,
        );
      }
    }
    if (!isNonEmptyString(rejection.reason)) push("SCHEMA_FIELD", "rejection.reason must be a non-empty string");
    if (!isNonEmptyString(rejection.missing)) push("SCHEMA_FIELD", "rejection.missing must be a non-empty string");
  }
  return { ok: reasons.length === 0, reasons };
}

const MISSING_GUIDANCE = {
  NAME_LEAK: "a rewrite of the clue that avoids the place name, its aliases, and every derived form",
  NAME_LEAK_INDIRECT: "a rewrite of the clue with no wordplay that resolves to the place name",
  QUOTE_UNTRACEABLE: "extract sentences that verbatim support the clue's facts",
  QUOTE_TRIVIAL: "a fuller verbatim quote from the extract supporting the clue",
  SOURCE_FIELD: "complete per-clue source fields (article, url, verbatim quote)",
  SOURCE_ARTICLE_UNKNOWN: "a source citation among the supplied extracts",
  CLIMATE_REDUNDANT: "a climate fact the geography clue does not already imply",
  CLIMATE_NO_SIGNAL: "a place-specific climate mechanism, extreme, or paradox in the extract",
  TIER5_SUMMARY: "a single confirming landmark or cultural marker, not a recap of earlier clues",
  READING_LEVEL: "simpler wording at reading age ~10 (shorter sentences, plainer words)",
  CLUE_WORDS: "a clue rewrite within the 15-40 word budget",
  CLUE_SENTENCES: "a clue rewrite in 1-2 sentences",
  SENTENCE_TOO_LONG: "shorter sentences (max 25 words each)",
  CONTENT_BANNED: "a rewrite without census, coordinate, or elevation filler",
  TIER1_COORDS: "a geography clue with no coordinates or decimal numbers",
  ALIAS_UNSOURCED: "a source for the alias (extract attestation or curated record)",
};

/**
 * Convert a failed accepted-format record + validator reasons into a
 * §6 rejection record. The primary reason is the first tier-scoped
 * reason if any, else the first reason (tier 0, "set").
 */
export function toRejectionRecord(record, reasons) {
  const primary = reasons.find((r) => Number.isInteger(r.tier) && r.tier >= 1 && r.tier <= 5) ?? reasons[0];
  const tier = primary && Number.isInteger(primary.tier) ? primary.tier : 0;
  return {
    schema: SCHEMA_ID,
    status: "rejected",
    place_id: record && typeof record.place_id === "string" ? record.place_id : "",
    rejection: {
      tier,
      tier_name: tier === 0 ? "set" : TIERS[tier - 1],
      reason: reasons.map((r) => `${r.code}: ${r.detail}`).join("; "),
      missing: (primary && MISSING_GUIDANCE[primary.code]) ?? "source material or a rewrite satisfying the failed validator rule",
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const args = [...argv];
  let inputPath = null;
  const file = args.find((a) => !a.startsWith("--"));
  const inputIdx = args.indexOf("--input");
  if (inputIdx >= 0) inputPath = args[inputIdx + 1];
  if (!file) {
    console.error("Usage: node scripts/clues/validate-clues.mjs <record.json> [--input <input.json>]");
    process.exitCode = 1;
    return;
  }
  let record;
  try {
    record = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, reasons: [{ code: "SCHEMA_FIELD", detail: `cannot read record file: ${err.message}` }] }, null, 2));
    process.exitCode = 1;
    return;
  }
  let result;
  if (record && record.status === "rejected") {
    result = validateRejectionRecord(record);
  } else {
    const ctx = {};
    if (inputPath) {
      try {
        ctx.input = JSON.parse(readFileSync(inputPath, "utf8"));
      } catch (err) {
        console.log(JSON.stringify({ ok: false, reasons: [{ code: "SCHEMA_FIELD", detail: `cannot read input file: ${err.message}` }] }, null, 2));
        process.exitCode = 1;
        return;
      }
    }
    result = validateRecord(record, ctx);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
