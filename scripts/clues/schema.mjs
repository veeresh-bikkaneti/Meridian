/**
 * GeoDetective clue-set — shared schema constants (Phase 2, prompt v1).
 *
 * The production record format is prompt v1 §10 (the generation prompt
 * adopted verbatim at scripts/clues/generation-prompt.md, locked by
 * Veeresh 2026-10-04):
 *
 *   {
 *     "schema": "meridian.loop.clues.v1",
 *     "status": "accepted",
 *     "place_id": "gn-1275339",
 *     "answer": {
 *       "name": "Mumbai", "aliases": ["Bombay"], "country": "India",
 *       "subdivision": "Maharashtra", "lat": 19.076, "lon": 72.8777,
 *       "difficulty": 2            // guessability, integer 1-5 (prompt §8)
 *     },
 *     "clues": [                   // exactly 5, ladder order
 *       { "tier": 1, "tier_name": "geography", "text": "…",
 *         "narrowing": "…",
 *         "source": { "article": "Mumbai", "url": "https://…",
 *                     "quote": "verbatim span of the supplied extract" } },
 *       … tiers 2-5: climate, history, hook, giveaway
 *     ]
 *   }
 *
 * Rejected sets use the §6 rejection record:
 *   { "schema": "meridian.loop.clues.v1", "status": "rejected",
 *     "place_id": "gn-…",
 *     "rejection": { "tier": 2, "tier_name": "climate",
 *                    "reason": "…", "missing": "…" } }
 *
 * The published per-day file (public/loop/clues/{index}.json) is a
 * DIFFERENT, game-side shape (LoopClueFile on feat/meridian-loop):
 *   { v: 1, placeId: "geonames:…", target: { lon, lat },
 *     clues: [5 strings], source: { label: "Wikipedia", href } }
 * Assembly (compose-clues.mjs) strips the answer identity into it.
 *
 * This module supersedes the Phase 1 provisional schema (LoopClueFile +
 * additive clueSources / difficulty-enum / aliases), which prompt v1
 * replaced before any production generation occurred.
 */

/** Schema identifier required on every production record (prompt §10). */
export const SCHEMA_ID = "meridian.loop.clues.v1";

/** Tier names in ladder order; clues[i].tier_name must equal TIERS[i]. */
export const TIERS = ["geography", "climate", "history", "hook", "giveaway"];

/**
 * Mechanical limits enforced by the validator.
 *
 * - Clue words 15-40 and 1-2 sentences per clue: prompt §3 (stands as
 *   drafted, §12 ruling #1).
 * - MAX_SENTENCE_WORDS 25: mechanical support for the LOCKED reading
 *   target (prompt §7, reading age ~10 — "short sentences; no
 *   subordinate-clause pileups").
 * - MAX_FK_GRADE 6.0: Flesch-Kincaid proxy cap for the LOCKED reading
 *   age ~10 target. FK grade 5 ≈ age 10-11; the cap carries one grade
 *   of headroom because FK's syllable counting systematically
 *   over-grades this domain's unavoidable polysyllabic geography
 *   vocabulary (peninsula, Mediterranean, archipelago) and proper
 *   nouns. Phase 1 evidence: hand-written kid-directed seed clues
 *   scored FK 9-12.5, so 6.0 remains far stricter than the seeds.
 *   The cap and its rejection counts are reported in the validation
 *   report so Veeresh can recalibrate with numbers.
 * - CLIMATE_MAX_JACCARD: climate-vs-geography content-token overlap
 *   proxy for the prompt §2 non-redundancy hard rule (Phase 1 proxy,
 *   retained).
 * - TIER5_MAX_OVERLAP: overlap coefficient of the giveaway clue's
 *   content tokens against tiers 1-4 (share of its tokens already
 *   seen); a giveaway that mostly repeats earlier tokens is a summary
 *   suspect (prompt §2: "tier 5 is a giveaway, not a summary").
 * - MIN_QUOTE_CHARS: a per-clue source quote shorter than this (after
 *   whitespace collapsing) is too trivial to audit the clue against.
 */
export const LIMITS = {
  MIN_CLUE_WORDS: 15,
  MAX_CLUE_WORDS: 40,
  MIN_CLUE_SENTENCES: 1,
  MAX_CLUE_SENTENCES: 2,
  MAX_SENTENCE_WORDS: 25,
  MAX_FK_GRADE: 6.0,
  CLIMATE_MAX_JACCARD: 0.5,
  TIER5_MAX_OVERLAP: 0.6,
  MIN_QUOTE_CHARS: 24,
};

/** Difficulty is an integer guessability score (prompt §8). */
export function isValidDifficulty(d) {
  return Number.isInteger(d) && d >= 1 && d <= 5;
}

/**
 * Lowercase, NFD diacritics stripped, punctuation removed, spaces
 * collapsed. Exact algorithm reused from scripts/build-loop.mjs
 * (feat/meridian-loop); used for token-level work (climate overlap,
 * token-only leak terms).
 */
export function normalizeName(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Diacritic fold for the LOCKED leak rule (prompt §4): lowercase, NFD,
 * strip combining marks, map every run of non-[a-z0-9] to a single
 * space, collapse, trim. Leak matching is a plain substring search of
 * the folded term inside the folded clue text — punctuation and
 * diacritics cannot hide a name, and a term embedded inside a longer
 * word ("paris" in "parisian") still matches.
 */
export function foldText(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
