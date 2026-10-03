/**
 * GeoDetective clue-set — shared schema constants.
 *
 * PRODUCTION SCHEMA (LoopClueFile + additive production fields)
 * ---------------------------------------------------------------
 * The game-side contract (origin/feat/meridian-loop:src/game/loop/types.ts)
 * is:
 *
 *   LoopClueFile = {
 *     v: 1,
 *     placeId: string,
 *     target: { lon: number, lat: number },
 *     clues: [string, string, string, string, string],
 *       // positional: [geography, climate, history, hook, giveaway]
 *       // The file never contains the place name.
 *     source: { label: string, href: string },
 *   }
 *
 * A PRODUCTION clue set keeps every LoopClueFile field identical in name
 * and type, and adds exactly these additive fields:
 *
 *   "clueSources": array of exactly 5 objects
 *     { snippet: string, extractId: string }
 *     index-aligned with `clues` (clueSources[i] supports clues[i]).
 *     `snippet` is a verbatim span of the source extract identified by
 *     `extractId`; the validator checks it appears (whitespace-normalized,
 *     case-sensitive) in the supplied extract text.
 *   "difficulty": one of DIFFICULTIES ("easy" | "medium" | "hard").
 *   "aliases": array of strings — alternate names / forms of the place,
 *     recorded on the set and used in leak checking (a clue must not
 *     contain the place name, any alias, or any banned term, even as a
 *     fragment embedded in another word — see validate-clues.mjs).
 *
 * NOTE: The additive fields (clueSources / difficulty / aliases) are
 * additive only — they do not rename, retype, or remove any LoopClueFile
 * field — and are pending Veeresh/Chitti confirmation.
 */

/** Positional tier names for clues[0..4]. */
export const TIERS = ["geography", "climate", "history", "hook", "giveaway"];

/** Mechanical limits enforced by the validator. */
export const LIMITS = {
  MAX_CLUE_WORDS: 40,
  MAX_SENTENCE_WORDS: 30,
  MAX_FK_GRADE: 8,
  CLIMATE_MAX_JACCARD: 0.5,
};

export const DIFFICULTIES = ["easy", "medium", "hard"];

/**
 * Lowercase, NFD diacritics stripped, punctuation removed, spaces collapsed.
 * Exact algorithm reused from scripts/build-loop.mjs (feat/meridian-loop):
 * lowercase -> NFD -> strip U+0300–U+036F -> replace [^a-z0-9 ] with
 * space -> collapse spaces -> trim.
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
