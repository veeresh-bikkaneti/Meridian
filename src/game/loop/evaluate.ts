import { distanceKm, initialBearing, octantOf } from "../geo.ts";
import { resolvePin } from "../reverse-geocode.ts";
import type { LoopGuess, LoopNameEntry } from "./types.ts";
import { normalizeLoopName } from "./normalize.ts";
import { unpackNameIndex } from "./names-codec.ts";

// Pure logic behind the GeoDetective guess input (Worker 3). Kept in a plain
// TS module so it is unit-testable without a DOM/React; guess-input.tsx is
// the thin interactive combobox shell around these helpers.

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw place-name query the same way the build-time index does.
 * Single source of truth: ./normalize.ts (shared with scripts/build-loop.mjs).
 */
export { normalizeLoopName };

/**
 * Human-readable label for an index entry, e.g. "Springfield, Illinois, US".
 * The index only stores the normalized name, so words are title-cased back.
 */
export function displayLoopName(entry: LoopNameEntry): string {
  const name = entry.n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return entry.r ? `${name}, ${entry.r}` : name;
}

/**
 * Synthetic guess entry for a map tap that lands on no labeled place.
 *
 * Owner directive 2026-10-12: a tap is a tap — a wrong or unlabeled spot is
 * a legitimate guess, never rejected. The entry carries the tap's exact
 * coordinates; the name is the containing region in the same language the
 * reveal pins already use ("Your pin: Nebraska"), resolved synchronously
 * via resolvePin (never throws, country-only when admin-1 chunks aren't
 * loaded, "Open Water" for ocean). The id is unique per ~11 m cell so a
 * repeat tap on the same wilderness is caught by the duplicate-guess check
 * instead of burning a second guess.
 */
export function unlabeledSpotEntry(lon: number, lat: number): LoopNameEntry {
  const pin = resolvePin(lat, lon);
  const name = pin?.admin1 ?? pin?.country ?? "open water";
  const region = pin?.admin1 && pin?.country ? pin.country : "";
  return {
    n: normalizeLoopName(name),
    id: `tap:${lon.toFixed(4)},${lat.toFixed(4)}`,
    lon,
    lat,
    r: region,
    p: 0,
  };
}

// ---------------------------------------------------------------------------
// Suggestion ranking
// ---------------------------------------------------------------------------

export const LOOP_SUGGESTION_LIMIT = 8;

/**
 * How well the normalized name matches the query words:
 * 0 = exact (whole name equals the whole query), 1 = a query word starts a
 * name word ("pica" -> "pica grande"), 2 = a query word is a name substring
 * ("pica" inside "espica"), 3 = no query word in the name (region-only hit).
 */
function nameMatchTier(name: string, query: string, words: string[]): number {
  if (name === query) return 0;
  const atBoundary = (w: string): boolean => {
    let idx = name.indexOf(w);
    while (idx >= 0) {
      if (idx === 0 || name[idx - 1] === " ") return true;
      idx = name.indexOf(w, idx + 1);
    }
    return false;
  };
  if (words.some(atBoundary)) return 1;
  if (words.some((w) => name.includes(w))) return 2;
  return 3;
}

export interface RankedLoopSuggestions {
  /** Top-`limit` entries, best match first. */
  suggestions: LoopNameEntry[];
  /** All matches, before the cap — drives the "N of M — keep typing" hint. */
  total: number;
}

/**
 * Per-entry "name + normalized region" haystack, cached weakly.
 *
 * The typeahead scans all ~119k entries per query; without this cache every
 * scan re-ran the region normalizer (lowercase + transliteration regex + NFD
 * strip + punctuation/whitespace regexes) on every entry — the dominant cost
 * of the scan (measured 80–207 ms/keystroke against the real index, enough
 * to freeze the GeoDetective screen on a phone). Entries are treated as
 * immutable once loaded, so the cached string can never go stale.
 */
const haystackCache = new WeakMap<LoopNameEntry, string>();

function haystackFor(entry: LoopNameEntry): string {
  let haystack = haystackCache.get(entry);
  if (haystack === undefined) {
    haystack = `${entry.n} ${normalizeLoopName(entry.r)}`;
    haystackCache.set(entry, haystack);
  }
  return haystack;
}

/**
 * Rank index entries against a raw query. Every query word must appear
 * somewhere in the combined "name + region" text, so "paris texas" and
 * "springfield nebraska" resolve; exact-name and word-boundary name matches
 * rank above substring noise (so "pica" surfaces Pica, Chile first).
 * Dedupes by id (aliases of the same place collapse), caps at `limit`,
 * and returns the pre-cap total alongside.
 */
export function rankLoopSuggestions(
  entries: LoopNameEntry[],
  query: string,
  limit: number = LOOP_SUGGESTION_LIMIT,
): RankedLoopSuggestions {
  const q = normalizeLoopName(query);
  if (!q) return { suggestions: [], total: 0 };
  const words = q.split(" ");
  // Match first, dedupe second — but dedupe keeps the BEST name match per
  // id: the index holds aliases per place id ("big apple" before "new york
  // city"), and a region-only alias match must never swallow the canonical
  // name when the canonical name matches better.
  const best = new Map<string, { entry: LoopNameEntry; tier: number }>();
  for (const entry of entries) {
    const haystack = haystackFor(entry);
    if (!words.every((w) => haystack.includes(w))) continue;
    const tier = nameMatchTier(entry.n, q, words);
    const prev = best.get(entry.id);
    if (!prev || tier < prev.tier) best.set(entry.id, { entry, tier });
  }
  const ranked = [...best.values()];
  ranked.sort((a, b) => a.tier - b.tier || b.entry.p - a.entry.p);
  return {
    suggestions: ranked.slice(0, limit).map((r) => r.entry),
    total: ranked.length,
  };
}

// ---------------------------------------------------------------------------
// Lazy name index
// ---------------------------------------------------------------------------

/** Minimal fetch shape the index loader needs (injectable for tests). */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * URL of the lazy name index. Relative to the app's base so it works both
 * in dev ("/") and on GitHub Pages ("/Meridian/").
 */
export function loopNamesUrl(): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base}loop/names.v2.json`;
}

let indexPromise: Promise<LoopNameEntry[]> | null = null;

/**
 * Lazy-load public/loop/names.v2.json (packed columns, see names-codec.ts) —
 * never in the main bundle. The first
 * call hits the network; later calls reuse the in-flight/resolved promise.
 * A failed load clears the cache so the next focus can retry.
 */
export function fetchLoopIndex(fetchImpl: FetchLike = fetch): Promise<LoopNameEntry[]> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const res = await fetchImpl(loopNamesUrl());
      if (!res.ok) throw new Error(`loop names index: HTTP ${res.status}`);
      return unpackNameIndex(await res.json());
    })();
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/** Test-only: drop the cached index promise so a fresh fetch can be mocked. */
export function clearLoopIndexCache(): void {
  indexPromise = null;
}

// ---------------------------------------------------------------------------
// Guess evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate one constrained guess against the day's target. Returns the
 * LoopGuess fields except `name` (the caller owns display naming).
 * `warmer` compares against the previous guess's distance; null for the
 * first guess. Unknown/duplicate guesses are rejected by the caller —
 * see isDuplicateGuess.
 *
 * This is the single evaluation implementation: engine.buildLoopGuess
 * delegates here so distance/octant/warmer can never drift between the
 * input surface and the state machine.
 */
export function evaluateGuess(
  entry: { id: string; lon: number; lat: number },
  target: { lon: number; lat: number },
  prevDistKm: number | null,
): Omit<LoopGuess, "name"> {
  const guessLonLat: [number, number] = [entry.lon, entry.lat];
  const targetLonLat: [number, number] = [target.lon, target.lat];
  const distKm = distanceKm(guessLonLat, targetLonLat);
  const bearing = initialBearing(guessLonLat, targetLonLat);
  return {
    placeId: entry.id,
    distKm,
    // Coincident points have no bearing (null): the guess is on the target
    // (distKm 0, a win by exact id), so the direction is moot — "north" is
    // the arbitrary but stable placeholder.
    octant: bearing === null ? "north" : octantOf(bearing),
    warmer: prevDistKm === null ? null : distKm < prevDistKm,
  };
}

/** True when `placeId` was already guessed this day (Worker 2 uses this to reject duplicates). */
export function isDuplicateGuess(placeId: string, guesses: LoopGuess[]): boolean {
  return guesses.some((g) => g.placeId === placeId);
}
