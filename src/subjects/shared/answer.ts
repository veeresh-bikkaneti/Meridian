/**
 * Shared answer shape for every subject (contract I2).
 *
 * The curated rows carry no answer field, so each subject keeps its own
 * answers module keyed by item id, with every entry in this shape: one
 * multiple-choice question, its correct choice, and a one-line
 * derivation shown after a correct answer and listed in the PR for
 * educator review. Numeric answers also carry their value so unit
 * tests can recompute them from the derivation inputs.
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
};

/** A subject's answer lookup: the entry for an item, or null. */
export type AnswerFor = (itemId: string) => AnswerEntry | null;
