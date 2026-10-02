import { distanceKm, initialBearing, octantOf } from "../geo.ts";
import type { LoopGuess, LoopNameEntry } from "./types.ts";

// Pure logic behind the Daily Loop guess input (Worker 3). Kept in a plain
// TS module so it is unit-testable without a DOM/React; guess-input.tsx is
// the thin interactive combobox shell around these helpers.

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw place-name query the same way the build-time index does:
 * lowercase, NFD-strip diacritics, drop punctuation/symbols, collapse
 * whitespace. Deliberately duplicated here (not imported from Worker 1's
 * data pipeline) so the input surface owns its copy.
 */
export function normalizeLoopName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Human-readable label for an index entry, e.g. "Springfield, Illinois, US".
 * The index only stores the normalized name, so words are title-cased back.
 */
export function displayLoopName(entry: LoopNameEntry): string {
  const name = entry.n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return entry.r ? `${name}, ${entry.r}` : name;
}

// ---------------------------------------------------------------------------
// Suggestion ranking
// ---------------------------------------------------------------------------

export const LOOP_SUGGESTION_LIMIT = 8;

/**
 * Rank index entries against a raw query: substring match on the normalized
 * name (`entry.n`), highest population first, deduplicated by id, capped at
 * `limit` (default 8). Returns [] for a blank query.
 */
export function rankLoopSuggestions(
  entries: LoopNameEntry[],
  query: string,
  limit: number = LOOP_SUGGESTION_LIMIT,
): LoopNameEntry[] {
  const q = normalizeLoopName(query);
  if (!q) return [];
  const seen = new Set<string>();
  const matches: LoopNameEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (entry.n.includes(q)) matches.push(entry);
  }
  matches.sort((a, b) => b.p - a.p);
  return matches.slice(0, limit);
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
  return `${base}loop/names.json`;
}

function isLoopNameEntry(value: unknown): value is LoopNameEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.n === "string" &&
    typeof v.id === "string" &&
    typeof v.lon === "number" &&
    typeof v.lat === "number" &&
    typeof v.r === "string" &&
    typeof v.p === "number"
  );
}

let indexPromise: Promise<LoopNameEntry[]> | null = null;

/**
 * Lazy-load public/loop/names.json — never in the main bundle. The first
 * call hits the network; later calls reuse the in-flight/resolved promise.
 * A failed load clears the cache so the next focus can retry.
 */
export function fetchLoopIndex(fetchImpl: FetchLike = fetch): Promise<LoopNameEntry[]> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const res = await fetchImpl(loopNamesUrl());
      if (!res.ok) throw new Error(`loop names index: HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!Array.isArray(data) || !data.every(isLoopNameEntry)) {
        throw new Error("loop names index: unexpected shape");
      }
      return data;
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
 */
export function evaluateGuess(
  entry: LoopNameEntry,
  target: { lon: number; lat: number },
  prevDistKm: number | null,
): Omit<LoopGuess, "name"> {
  const guessLonLat: [number, number] = [entry.lon, entry.lat];
  const targetLonLat: [number, number] = [target.lon, target.lat];
  const distKm = distanceKm(guessLonLat, targetLonLat);
  return {
    placeId: entry.id,
    distKm,
    octant: octantOf(initialBearing(guessLonLat, targetLonLat)),
    warmer: prevDistKm === null ? null : distKm < prevDistKm,
  };
}

/** True when `placeId` was already guessed this day (Worker 2 uses this to reject duplicates). */
export function isDuplicateGuess(placeId: string, guesses: LoopGuess[]): boolean {
  return guesses.some((g) => g.placeId === placeId);
}
