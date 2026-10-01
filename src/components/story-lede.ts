/**
 * Story lede splitting for the miss card.
 *
 * The miss card's 2-line educational subscript carries the story's first
 * sentence (the lede); the remaining body follows below the subscript. This
 * pure module owns that split so the no-duplicated-lede contract is unit
 * testable without a DOM/React environment.
 */

/** Split a story into its lede (first sentence) and the remaining body. */
export function splitLede(text: string): [lede: string, rest: string] {
  const match = text.match(/^[^.!?]+[.!?]/);
  if (!match) return [text.trim(), ""];
  return [match[0].trim(), text.slice(match[0].length).trim()];
}
