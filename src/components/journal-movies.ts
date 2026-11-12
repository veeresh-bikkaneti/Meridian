/**
 * journal-movies.ts — the movie manifest for the Journal player
 * ("What the land remembers").
 *
 * The manifest (public/videos/journal-manifest.json, validated at build
 * time by scripts/validate-journal-manifest.mjs) maps every journal note
 * id to its movie file on the meridian-media repo. The player loads the
 * manifest lazily — only when a kid taps a picture — and never bundles
 * it: the mapping is fetched, the movies stream from the media repo.
 * Nothing is fetched before the first tap.
 */
import { assetBase } from "./storyteller-lines.ts";

export interface JournalMovieEntry {
  duration: number;
  file: string;
  note: string;
  verified: string;
  voice: string;
}

export interface JournalMovieManifest {
  baseUrl: string;
  movies: Record<string, JournalMovieEntry>;
  note: string;
  version: number;
}

export const JOURNAL_MANIFEST_PATH = "videos/journal-manifest.json";

/**
 * The only baseUrl a manifest may carry — pinned by the build validator
 * (scripts/validate-journal-manifest.mjs BASE_URL). The runtime re-pins
 * it here so a swapped or stale manifest cannot redirect clip URLs
 * elsewhere; anything else is not a usable manifest.
 */
export const JOURNAL_MOVIE_BASE_URL =
  "https://veeresh-bikkaneti.github.io/meridian-media/journal/";

/** Public URL of the manifest file (same assetBase seam as images/audio). */
export function journalManifestUrl(): string {
  return `${assetBase()}${JOURNAL_MANIFEST_PATH}`;
}

/**
 * The movie URL for a note id, or null when the manifest has no movie
 * for it. Pure — no I/O, so the full 106-id mapping is unit-testable.
 */
export function journalMovieUrl(
  manifest: JournalMovieManifest | null,
  noteId: string,
): string | null {
  if (manifest === null) return null;
  const entry = manifest.movies[noteId];
  if (!entry || typeof entry.file !== "string" || entry.file.length === 0) {
    return null;
  }
  return `${manifest.baseUrl}${entry.file}`;
}

/**
 * Defensive shape check: the build validator guarantees the shape, but
 * the player must never crash on a bad fetch — it degrades to "movie
 * not ready" instead. Returns null for anything that is not a usable
 * manifest.
 */
export function parseJournalMovieManifest(value: unknown): JournalMovieManifest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (v.baseUrl !== JOURNAL_MOVIE_BASE_URL) return null;
  if (typeof v.movies !== "object" || v.movies === null || Array.isArray(v.movies)) {
    return null;
  }
  if (typeof v.version !== "number") return null;
  return value as JournalMovieManifest;
}

export type JournalManifestFetch = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/**
 * Fetch + validate the manifest. Returns null on any failure (network,
 * HTTP error, unparseable body, wrong shape) — the caller degrades to
 * the still picture with a message, never a crash.
 */
export async function loadJournalMovieManifest(
  fetchImpl: JournalManifestFetch = globalThis.fetch,
): Promise<JournalMovieManifest | null> {
  try {
    const response = await fetchImpl(journalManifestUrl());
    if (!response.ok) return null;
    return parseJournalMovieManifest(await response.json());
  } catch {
    return null;
  }
}

/**
 * Memoized loader: the manifest is fetched at most once per page load,
 * and only after the first tap. Opening a second entry reuses it —
 * still no movie bytes until that entry's own tap.
 */
let cachedManifest: Promise<JournalMovieManifest | null> | null = null;

export function getJournalMovieManifest(
  fetchImpl?: JournalManifestFetch,
): Promise<JournalMovieManifest | null> {
  if (cachedManifest === null) {
    cachedManifest = loadJournalMovieManifest(fetchImpl);
  }
  return cachedManifest;
}

/**
 * Drop the memoized manifest so the next getJournalMovieManifest()
 * fetches again. The player's "Try again" path: a failed first fetch
 * (e.g. an HTTP 500) would otherwise be cached for the whole page load
 * and no retry could ever succeed.
 */
export function resetJournalMovieManifestCache(): void {
  cachedManifest = null;
}
