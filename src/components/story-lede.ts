/**
 * Story lede splitting for the miss card.
 *
 * The miss card's 2-line educational subscript carries the story's first
 * sentence (the lede); the remaining body follows below the subscript. This
 * pure module owns that split so the no-duplicated-lede contract is unit
 * testable without a DOM/React environment.
 */

const ABBREVIATIONS = new Set([
  "st", "dr", "mr", "mrs", "ms", "mt", "ave", "blvd", "rd", "ln", "ct",
  "co", "inc", "ltd", "jr", "sr", "no", "fig", "vs", "etc", "approx",
]);

/**
 * Split a story into its lede (first sentence) and the remaining body.
 * Skips terminators that are part of abbreviations ("St."), initials
 * ("J."), or decimals ("3.5") — a split requires end-of-string or
 * whitespace followed by an uppercase letter/digit (start of a new sentence).
 */
export function splitLede(text: string): [lede: string, rest: string] {
  const trimmed = text.trim();
  const re = /[.!?]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const end = m.index + m[0].length;
    const before = trimmed.slice(0, m.index);
    const word = before.match(/[A-Za-z]+$/)?.[0] ?? "";
    const after = trimmed.slice(end);
    const prevChar = m.index > 0 ? trimmed[m.index - 1] : "";
    // Decimal: digit on both sides of the dot ("3.5").
    if (/\d/.test(prevChar) && /^\d/.test(after)) continue;
    // Abbreviation ("St.", "Mt.", "Dr.").
    if (ABBREVIATIONS.has(word.toLowerCase())) continue;
    // Initial ("J. Smith").
    if (word.length === 1 && /[A-Z]/.test(word)) continue;
    // Sentence boundary: end of string, or whitespace + uppercase/digit.
    if (after === "" || /^\s+["“(]?[A-Z0-9]/.test(after)) {
      return [trimmed.slice(0, end).trim(), after.trim()];
    }
  }
  return [trimmed, ""];
}
