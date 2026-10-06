/**
 * The GeoDetective's E2E seam: `?loop-puzzle=<index>` pins the puzzle the
 * screen deals, so tests can play a deterministic mystery without burning
 * deck state. Returns null when the param is absent or malformed — the
 * seam is inert otherwise and production play always deals from the deck.
 *
 * Validation: the param must match /^\d+$/; the caller additionally checks
 * `< manifest.size`. Non-numeric, negative, or out-of-range values never
 * error — they are ignored. The retired `?loop-date=` day-pinning param is
 * not parsed at all.
 */
const LOOP_PUZZLE_PARAM = "loop-puzzle";
const INDEX_RE = /^\d+$/;

export function loopPuzzleFromSearch(search: string): number | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get(LOOP_PUZZLE_PARAM);
  } catch {
    return null;
  }
  if (!raw || !INDEX_RE.test(raw)) return null;
  const index = Number(raw);
  return Number.isSafeInteger(index) ? index : null;
}
