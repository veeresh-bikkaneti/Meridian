/**
 * The single shared place-name normalizer for the GeoDetective guess index.
 *
 * Used by BOTH the build-time pipeline (`scripts/build-loop.mjs`, which
 * writes the normalized `n` field of `public/loop/names.json`) and the
 * runtime typeahead (`src/game/loop/evaluate.ts`, which normalizes the
 * player's query). One source of truth — the two sides must never drift
 * again (2026-10-05: a duplicated normalizer made Białystok and Hınıs
 * unfindable because build and runtime disagreed on punctuation and on
 * non-decomposable letters like ł/ı).
 *
 * Rules: lowercase → transliterate non-decomposable letters → NFD-strip
 * diacritics → punctuation becomes a space → collapse whitespace → trim.
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  "ł": "l",
  "ı": "i",
  "ø": "o",
  "œ": "oe",
  "æ": "ae",
  "ß": "ss",
  "ẞ": "ss",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "ħ": "h",
  "ŋ": "n",
};

export function normalizeLoopName(raw: string): string {
  const transliterated = raw
    .toLowerCase()
    .replace(
      /[łıøœæðßẞđðþħŋ]/g,
      (c) => TRANSLITERATIONS[c] ?? c,
    );
  return transliterated
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
