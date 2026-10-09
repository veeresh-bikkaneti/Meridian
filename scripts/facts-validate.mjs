/**
 * facts-validate.mjs — relational no-fabrication gate for the Meridian
 * blurb pipeline's rewrite stage, where a tiny local LLM rewrites sourced
 * facts into kid-friendly sentences.
 *
 * An adversarial review proved that word-presence checks alone cannot stop a
 * rephraser from corrupting facts ("Explorer Lewis named the town after
 * himself" passes a presence check while inverting the relation), so this
 * validator checks *relations*, not just invented words:
 *
 *  (a) content-word presence — every content word of the rewrite appears in
 *      the source (reuses `contentWords` from enrich-wikipedia.mjs);
 *  (b) named_after relational check — the person must be the OBJECT of the
 *      naming predicate, never its subject/agent;
 *  (c) hedging preservation — dropping "probably" is fabrication by deletion;
 *  (d) date-predicate binding — the year stays attached to its predicate
 *      class ("mentioned in 1234" must never become "founded in 1234");
 *  (e) banned patterns — coords, elevation, population/census, measurements
 *      (reuses BANNED_PATTERNS from enrich-wikipedia.mjs);
 *  (f) length + terminal punctuation — 20..240 chars, ends with . / ! / ?;
 *  (+) smuggled scope words — "not"/"only"/"until" etc. added by the rewrite
 *      flip meaning while dodging the length>3 content-word filter.
 *  (g) kid-safety screen — age-inappropriate content for the 5–13 audience.
 *      Rungs 1–2 (Wikidata/wiki-text) had no kid-safety gate before the
 *      pilot; this runs inside validateFact so every future pipeline run
 *      is screened before a fact can ship. Conservative by design: the
 *      247 human-approved pilot facts produce zero hits (locked by test).
 *
 * API: validateFact({ factType, person?, year?, sentence }, rewrittenSentence)
 *      => string[]  (violation codes; empty array = valid)
 *
 * Node stdlib only. No network. Pure functions — safe to import anywhere.
 */

import { contentWords, BANNED_PATTERNS } from "./enrich-wikipedia.mjs";

export const REWRITE_MIN_LEN = 20;
export const REWRITE_MAX_LEN = 240;

/** Lowercase alphanumeric tokens, punctuation stripped. */
export function wordTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function tokenCounts(tokens) {
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

// ---------------------------------------------------------------------------
// (f) length + terminal punctuation
// ---------------------------------------------------------------------------

export function checkLength(sentence) {
  const violations = [];
  if (typeof sentence !== "string") return ["invalid-rewrite"];
  if (sentence.length < REWRITE_MIN_LEN) violations.push("too-short");
  if (sentence.length > REWRITE_MAX_LEN) violations.push("too-long");
  if (!/[.!?]$/.test(sentence.trim())) violations.push("no-terminal-punctuation");
  return violations;
}

// ---------------------------------------------------------------------------
// (e) banned patterns — coords, elevation, population/census, measurements.
// ---------------------------------------------------------------------------

/** General measurements ("10 km", "3 miles", "5 ft") — the imported
 *  BANNED_PATTERNS only covers m/ft in an elevation context. */
export const MEASUREMENT_RE =
  /\b\d[\d,]*\s*-?\s*(kilometers?|kilometres?|km|miles?|mi|feet|ft|meters?|metres?|m)\b/i;

export function checkBanned(sentence) {
  for (const re of [...BANNED_PATTERNS, MEASUREMENT_RE]) {
    // Same violation shape as validateHistory in enrich-wikipedia.mjs so
    // pipeline tooling can treat both gates uniformly.
    if (re.test(sentence)) return [`banned-pattern ${re.source.slice(0, 40)}`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// (a) content-word presence — the rewrite may only reuse source words.
// ---------------------------------------------------------------------------

export function checkContentWords(rewritten, source) {
  const sourceWords = new Set(contentWords(source ?? ""));
  const missing = contentWords(rewritten).filter((w) => !sourceWords.has(w));
  return missing.length > 0 ? [`fabricated words: ${missing.slice(0, 6).join(", ")}`] : [];
}

// ---------------------------------------------------------------------------
// (+) smuggled scope words — short function words that flip meaning.
// "not" is only 3 chars, so the content-word filter (length > 3) never sees
// it: "was named after Lewis" -> "was not named after Lewis" must fail.
// Flag a flip-word whose count GREW vs the source (dropping one is harmless).
// ---------------------------------------------------------------------------

export const SCOPE_FLIP_WORDS = new Set([
  "not", "no", "never", "none", "nobody", "nothing", "neither", "nor",
  "without", "hardly", "barely", "scarcely", "only", "merely", "until",
  "unless", "except",
]);

export function checkScopeWords(rewritten, source) {
  const violations = [];
  const rwCounts = tokenCounts(wordTokens(rewritten));
  const srcCounts = tokenCounts(wordTokens(source));
  for (const w of SCOPE_FLIP_WORDS) {
    if ((rwCounts.get(w) ?? 0) > (srcCounts.get(w) ?? 0)) {
      violations.push(`smuggled-scope-word: ${w}`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// (b) named_after relational check.
// The person must appear as the OBJECT of a naming predicate, never as its
// subject/agent. Reject inversions like:
//   source "The town was named after explorer Lewis"
//   -> "Explorer Lewis named the town after himself"
// Heuristic per naming verb: if the token right before it is a passive
// auxiliary ("was named", "it was named for"), the person cannot be the
// subject — appositives like "Lewis, the explorer it was named for" pass.
// Otherwise, a person token within 4 tokens before the verb (stopping at
// clause boundaries) is read as the subject -> violation.
// ---------------------------------------------------------------------------

export const NAMING_VERBS = new Set([
  "name", "names", "named", "naming",
  "call", "calls", "called", "calling",
  "christen", "christens", "christened", "christening",
  "dub", "dubs", "dubbed", "dubbing",
  "rename", "renames", "renamed", "renaming",
  "title", "titles", "titled", "titling",
]);

const PASSIVE_AUX = new Set(["was", "were", "is", "are", "am", "be", "been", "being"]);

// Words that end the subject-search clause when walking back from the verb.
const CLAUSE_STOPS = new Set([
  "who", "whom", "whose", "which", "that", "and", "but", "or",
  "because", "when", "while", "where", "although", "though", "if", "as",
]);

const SUBJECT_WINDOW = 4;

export function checkNamedAfterInversion(rewritten, person) {
  const personTokens = new Set(wordTokens(person));
  if (personTokens.size === 0) return [];
  const tokens = wordTokens(rewritten);
  for (let v = 0; v < tokens.length; v++) {
    if (!NAMING_VERBS.has(tokens[v])) continue;
    // Passive ("was named", "it was named for") — the person cannot be the
    // subject of this verb; appositive/relative constructions pass here.
    if (v > 0 && PASSIVE_AUX.has(tokens[v - 1])) continue;
    // Active voice: a person token just before the verb is its subject.
    for (let i = v - 1; i >= Math.max(0, v - SUBJECT_WINDOW); i--) {
      if (CLAUSE_STOPS.has(tokens[i])) break;
      if (personTokens.has(tokens[i])) return ["named-after-inversion"];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// (c) hedging preservation — dropping a hedge is fabrication by deletion.
// If the source hedges ("probably founded in 1640"), the rewrite must hedge
// too (any hedge from the set counts).
// ---------------------------------------------------------------------------

const HEDGES = [
  "probably", "likely", "possibly", "maybe", "reportedly",
  "believed to be", "thought to", "may have been", "might have been",
  "tradition holds", "legend holds", "according to legend",
];
const HEDGE_RES = HEDGES.map(
  (h) => new RegExp(`\\b${h.replace(/ /g, "\\s+")}\\b`, "i"),
);

const hasHedge = (text) => HEDGE_RES.some((re) => re.test(text ?? ""));

export function checkHedging(source, rewritten) {
  if (hasHedge(source) && !hasHedge(rewritten)) return ["dropped-hedge"];
  return [];
}

// ---------------------------------------------------------------------------
// (d) date-predicate binding — the year stays attached to its predicate class.
// "first mentioned in 1234" must never become "founded in 1234".
// Class A (foundation) verbs are mutually substitutable ONLY when the source
// used one of them; class B (attestation) must never upgrade to class A.
// The predicate is the nearest class verb to the year token in each sentence.
// ---------------------------------------------------------------------------

const FOUNDATION_PREFIXES = [
  "founded", "founding", // bare "found" excluded: "gold was found" is discovery
  "establish", "incorporat", "settl",
  "built", "build", "open",
  "began", "begun", "start", "launch",
];
const ATTESTATION_PREFIXES = [
  "mention", "attest", "record", "document", "dat", "known",
];

function predicateClass(token) {
  if (token !== "found" && FOUNDATION_PREFIXES.some((p) => token.startsWith(p))) {
    return "foundation";
  }
  if (ATTESTATION_PREFIXES.some((p) => token.startsWith(p))) return "attestation";
  return null;
}

/** Nearest predicate class to the year token: up to 6 tokens before, then
 *  up to 4 after. Null when the year carries no class predicate. */
function classNearYear(tokens, yearIdx) {
  for (let d = 1; d <= 6; d++) {
    const i = yearIdx - d;
    if (i < 0) break;
    const c = predicateClass(tokens[i]);
    if (c) return c;
  }
  for (let d = 1; d <= 4; d++) {
    const i = yearIdx + d;
    if (i >= tokens.length) break;
    const c = predicateClass(tokens[i]);
    if (c) return c;
  }
  return null;
}

export function checkDateBinding(source, rewritten, year) {
  if (year === undefined || year === null || year === "") return [];
  const y = String(year).toLowerCase();
  const srcTokens = wordTokens(source);
  const srcIdx = srcTokens.indexOf(y);
  if (srcIdx === -1) return []; // year not in the source: nothing to bind
  const srcClass = classNearYear(srcTokens, srcIdx);
  if (!srcClass) return []; // source year has no predicate: no constraint
  const rwTokens = wordTokens(rewritten);
  const rwIdx = rwTokens.indexOf(y);
  if (rwIdx === -1) return ["dropped-year"];
  const rwClass = classNearYear(rwTokens, rwIdx);
  if (!rwClass) return ["dropped-date-predicate"];
  if (rwClass !== srcClass) return ["date-predicate-drift"];
  return [];
}

// ---------------------------------------------------------------------------
// (g) kid-safety screen — age-inappropriate content for the 5–13 audience.
//
// Conservative allowlist-adjacent blocklist: only unambiguous categories
// (sexual/adult content, graphic atrocity violence). Ordinary historical
// violence ("was killed in battle", "assassinated") is NOT flagged —
// that's the curator's and human review's call, not a regex's. Calibrated
// to zero hits on the 247 human-approved pilot facts (locked by test).
// ---------------------------------------------------------------------------

const KID_UNSAFE_RES = [
  /\bbrothel\b/i,
  /\bprostitut/i,
  /\bporn/i,
  /\badult entertainment\b/i,
  /\bstrip club\b/i,
  /\bred-?light district\b/i,
  /\bmassacre\b/i,
  /\bgenocide\b/i,
  /\btorture\b/i,
  /\bmutilat/i,
  /\bdecapitat/i,
];

/** Returns ["kid-unsafe: <pattern>"] on the first hit, else []. */
export function checkKidSafe(sentence) {
  const text = String(sentence ?? "");
  for (const re of KID_UNSAFE_RES) {
    if (re.test(text)) return [`kid-unsafe: ${re.source.slice(0, 40)}`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------

/**
 * Validate an LLM-rewritten fact sentence against its sourced fact.
 * @param {{factType: string, person?: string, year?: number|string, sentence: string}} fact
 * @param {string} rewrittenSentence
 * @returns {string[]} violation codes; empty = valid.
 */
export function validateFact(fact, rewrittenSentence) {
  if (!fact || typeof fact !== "object") return ["invalid-fact"];
  if (typeof fact.sentence !== "string" || fact.sentence.trim() === "") {
    return ["invalid-source"];
  }
  if (typeof rewrittenSentence !== "string" || rewrittenSentence.trim() === "") {
    return ["invalid-rewrite"];
  }
  const source = fact.sentence;
  const violations = [
    ...checkLength(rewrittenSentence),
    ...checkBanned(rewrittenSentence),
    ...checkKidSafe(rewrittenSentence),
    ...checkContentWords(rewrittenSentence, source),
    ...checkScopeWords(rewrittenSentence, source),
    ...checkHedging(source, rewrittenSentence),
    ...checkDateBinding(source, rewrittenSentence, fact.year),
  ];
  if (String(fact.factType ?? "").toLowerCase() === "named_after") {
    violations.push(...checkNamedAfterInversion(rewrittenSentence, fact.person));
  }
  return violations;
}
