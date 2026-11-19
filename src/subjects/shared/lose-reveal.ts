/**
 * L1 lose path pacing (owner decision, 2026-11-19): on a case's
 * entry question, the FIRST wrong answer keeps the plain
 * "Not quite" feedback and the player tries again; only the
 * SECOND DISTINCT wrong answer reveals the solved summary
 * ("The answer is X — here's how."). Repeating the same wrong
 * answer does not bring the reveal closer.
 *
 * This module is the pure counting rule behind that pacing, kept
 * free of React so the unit suites can pin it directly (this repo
 * has no DOM test infra). SubjectCase owns one key set per case,
 * feeds it through `recordDistinctWrong`, and clears it when the
 * case changes.
 */

/** How many distinct wrong answers on the entry question reveal
 * the solved summary (owner decision, 2026-11-19: the reveal
 * lands on the second wrong answer, never the first). */
export const LOSE_REVEAL_AFTER_WRONG = 2;

/** The one key every unparseable typed answer shares: mistyped
 * text counts as a single wrong answer, however it is spelled. */
export const UNPARSEABLE_WRONG_KEY = "typed:unparseable";

/**
 * The distinct-wrong key for a typed (number-mode) answer: its
 * parsed numeric value when it parses — so "06" and "6" are the
 * same wrong answer — and the shared sentinel when it does not.
 * A pick's key is simply its choice string, so picks need no
 * helper.
 */
export function typedWrongKey(value: number | null): string {
  return value === null ? UNPARSEABLE_WRONG_KEY : `typed:${value}`;
}

/**
 * Record one wrong answer's key in the current case's set of
 * distinct wrongs. Returns true exactly when this answer makes
 * the count reach LOSE_REVEAL_AFTER_WRONG — the moment the
 * solved summary should be revealed.
 */
export function recordDistinctWrong(seen: Set<string>, key: string): boolean {
  seen.add(key);
  return seen.size >= LOSE_REVEAL_AFTER_WRONG;
}
