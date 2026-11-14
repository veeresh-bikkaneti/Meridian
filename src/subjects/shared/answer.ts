/**
 * Shared answer shape for every subject (contract I2).
 *
 * The curated rows carry no answer field, so each subject keeps its own
 * answers module keyed by item id, with every entry in this shape: one
 * question, its correct choice, and a one-line derivation shown after a
 * correct answer and listed in the PR for educator review. Numeric
 * answers also carry their value so unit tests can recompute them from
 * the derivation inputs.
 *
 * Two optional fields extend the shape without changing existing
 * entries: `kind: "number"` asks the player to type a number instead
 * of picking (older kids, where three choices give the answer away),
 * and `followUp` asks one more quick question after a correct answer
 * (the journals' "after the clip" check). An entry with neither field
 * behaves exactly as before.
 */
export type AnswerEntry = {
  /** The one question asked, with its numbers (numbers live here and in
   * the answer, never in story copy). */
  prompt: string;
  choices: string[];
  correct: string;
  /** One-line derivation, shown after a correct answer and listed in
   * the PR for educator review. */
  derivation: string;
  /** Numeric value of the correct answer, when the answer is a number. */
  value?: number;
  /** How the player answers: pick one of `choices` (the default), or
   * type a number. For "number", `value` is required, `choices` may be
   * empty, and `correct` is the display string. */
  kind?: "choice" | "number";
  /** One follow-up question, asked after a correct answer and before
   * the result. One level only: a follow-up has no follow-up of its
   * own — the case never asks a third question. */
  followUp?: AnswerEntry;
};

/** A subject's answer lookup: the entry for an item, or null. */
export type AnswerFor = (itemId: string) => AnswerEntry | null;

/**
 * Parse a typed number the way the number card does: commas and
 * spaces are ignored ("1,081" = 1081). A leading or trailing
 * decimal point is fine (".5" = 0.5, "5." = 5). Returns null for
 * anything that is not one plain decimal number.
 */
export function parseTypedNumber(raw: string): number | null {
  // Spaces are ignored anywhere ("1 081" = 1081); commas must be
  // proper thousands separators ("1,2,3" and "3,5" are not numbers).
  const cleaned = raw.replace(/\s/g, "");
  if (!/^-?((\d{1,3}(,\d{3})+|\d+)(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** The case's question phase: the entry, its follow-up, or the result. */
export type CasePhase = "main" | "followUp" | "done";

/**
 * Advance the phase after an answer. A wrong answer stays put; a
 * correct main answer with a follow-up goes to it, and a correct
 * follow-up always ends the case — a follow-up never has a follow-up
 * of its own, even if one is written on it.
 */
export function advanceCasePhase(
  entry: AnswerEntry,
  phase: CasePhase,
  correct: boolean,
): CasePhase {
  if (!correct) return phase;
  if (phase === "main" && entry.followUp) return "followUp";
  return "done";
}
