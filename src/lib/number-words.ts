/**
 * Number words (Round 2, bug 10 residue): the one source for a
 * small count spelled as a word — "Six guesses" in the GeoDetective
 * intro, the Home card's guess count, anywhere copy says a count
 * out loud. Before this helper the intro hardcoded "Five" (wrong
 * for the 7–10 band's cap of 6) and the Home card kept its own
 * two-entry table; both now derive from the same cap the counter
 * uses (`dealConfig.guessCap`), so the word can never drift from
 * the number the game actually deals.
 *
 * Covers every cap the deal config can produce (5 and 6 by band
 * today; a resumed case can carry its dealing band's cap) with
 * room to spare; anything outside the table falls back to digits
 * rather than a wrong word.
 */
const NUMBER_WORDS: readonly string[] = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];

/** The word for a small count ("Six"), or the digits for anything outside the table. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
