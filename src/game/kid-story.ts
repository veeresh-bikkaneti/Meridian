/**
 * Kid story version for band 5-7 (WI-14): sentence-prefix shortening of a
 * place's own reviewed story text — shortening only, never new text.
 *
 * Sentence rules mirror src/components/story-lede.ts. Duplicated
 * deliberately: src/game never imports src/components (layering), and
 * this module must stay import-free for the card hot path. If the
 * abbreviation list ever changes, change both.
 */

const ABBREVIATIONS = new Set([
  "st", "dr", "mr", "mrs", "ms", "mt", "ave", "blvd", "rd", "ln", "ct",
  "co", "inc", "ltd", "jr", "sr", "no", "fig", "vs", "etc", "approx",
]);

/**
 * Split text into sentences. Skips terminators that are part of
 * abbreviations ("St."), initials ("J."), or decimals ("3.5") — a split
 * requires end-of-string or whitespace followed by an uppercase
 * letter/digit (start of a new sentence).
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const sentences: string[] = [];
  const re = /[.!?]+/g;
  let start = 0;
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
      sentences.push(trimmed.slice(start, end).trim());
      start = end;
    }
  }
  const rest = trimmed.slice(start).trim();
  if (rest.length > 0) sentences.push(rest);
  return sentences;
}

/** Minimum length the kid version aims for before it stops taking sentences. */
export const KID_TARGET_MIN_CHARS = 50;

/**
 * The band 5-7 version of a reviewed story: whole sentences from the
 * start of the story, taken until the accumulated text reaches
 * KID_TARGET_MIN_CHARS — but always leaving at least one sentence
 * untaken, so the result is strictly shorter whenever the story has
 * 2+ sentences. Introduces no characters except the single joining
 * spaces.
 */
export function kidStoryVersion(story: string): string {
  const sentences = splitSentences(story);
  if (sentences.length <= 1) return story.trim();
  let taken = 1;
  let accumulated = sentences[0];
  while (accumulated.length < KID_TARGET_MIN_CHARS && taken < sentences.length - 1) {
    accumulated += " " + sentences[taken];
    taken += 1;
  }
  return accumulated;
}
