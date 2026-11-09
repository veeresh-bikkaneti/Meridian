/**
 * journal-prefetch.ts — background prefetch of journal movies WHILE the
 * user is playing the game (lazy-load scenario 2).
 *
 * Tap-to-load stays the primary path: nothing here creates a <video>,
 * autoplays, or changes what a tap does. While a round is active, the
 * first 1–2 movies of the current journal set are warmed in the
 * background so a later tap plays instantly.
 *
 * Mechanism — plain HTTP cache, not Cache Storage: a CORS fetch of the
 * clip URL with the body drained (`arrayBuffer()`) stores the full 200
 * in the browser HTTP cache, and the tap's <video> Range requests are
 * then served from that entry. Verified 2026-11-09 by a real-server
 * probe (probe script + logs in ~/workspace/journal-prefetch-probe/):
 * CORS fetch warm, then a <video preload="none"> tap — server-side
 * clip hits stayed at 1 before AND after the tap (zero additional
 * transfers), and the video played (paused=false, currentTime 1.96 s).
 * A hidden-<video preload="auto"> warm scored the same 1→1, so the
 * fetch mechanism wins on simplicity (no DOM elements, no autoplay).
 * The probe also established the harness limit: Playwright
 * route-interception fulfills bypass the HTTP cache entirely (a second
 * fetch() hit the network), so E2E specs under interception can assert
 * that prefetch requests happen, but NOT cache reuse — reuse is proven
 * by the real-server probe, not by the intercepted suite.
 *
 * Preconditions, all verified before building: the clips answer
 * `Access-Control-Allow-Origin: *` (curl, 2026-11-09) so a CORS fetch
 * can read (and therefore cache) them, and they carry
 * `Cache-Control: max-age=600` + ETag + `Accept-Ranges: bytes`.
 *
 * Failure contract (copied from `preloadTerritory` in
 * src/game/territory.ts): prefetch never rejects, never surfaces UI,
 * no retry — a failed warm means the tap fetches cold, exactly as
 * today. Gating copies `saveDataEnabled()` in game-app.tsx: skip
 * entirely under Save-Data or a slow-2g/2g effective type, defensive
 * cast + try/catch, fail-open when the API is absent. Slow networks
 * keep the still image + text fallback.
 */
import {
  getJournalMovieManifest,
  journalMovieUrl,
  type JournalMovieManifest,
} from "./journal-movies.ts";

/** At most this many entries warmed per set (brief decision 2). */
export const JOURNAL_PREFETCH_MAX_ENTRIES = 2;
/** At most this many warms in flight at once (brief decision 5). */
export const JOURNAL_PREFETCH_MAX_CONCURRENT = 2;

const SLOW_EFFECTIVE_TYPES: ReadonlySet<string> = new Set(["slow-2g", "2g"]);

export interface JournalConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Gating check (pure, testable): false under Save-Data or a slow
 * effective type; true otherwise — including when the connection object
 * is absent or unreadable (fail-open, per saveDataEnabled()).
 */
export function isJournalPrefetchAllowed(
  connection?: JournalConnectionLike | null,
): boolean {
  try {
    if (!connection) return true;
    if (connection.saveData === true) return false;
    if (
      typeof connection.effectiveType === "string" &&
      SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Reads the live `navigator.connection`, defensively. */
export function isJournalPrefetchAllowedNow(): boolean {
  try {
    const connection = (
      globalThis.navigator as Navigator & {
        connection?: JournalConnectionLike;
      }
    ).connection;
    return isJournalPrefetchAllowed(connection ?? null);
  } catch {
    return true;
  }
}

export interface SelectJournalPrefetchOptions {
  /** The open player id — never prefetch the entry being watched. */
  playingJournalId?: string | null;
  /** Ids already warmed in this set — never warm twice. */
  warmedIds?: ReadonlySet<string>;
  limit?: number;
}

/**
 * Entry selection (pure): the first `limit` note ids of the current
 * set, in set order, skipping the playing entry and any id already
 * warmed in this set. A 1-note set (set 35) yields 0–1 ids.
 */
export function selectJournalPrefetchNoteIds(
  noteIds: readonly string[],
  options: SelectJournalPrefetchOptions = {},
): string[] {
  const limit = options.limit ?? JOURNAL_PREFETCH_MAX_ENTRIES;
  const out: string[] = [];
  for (const id of noteIds) {
    if (out.length >= limit) break;
    if (id === options.playingJournalId) continue;
    if (options.warmedIds?.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export interface JournalPrefetchEntry {
  noteId: string;
  url: string;
}

/**
 * Resolve the selected entries to warmable URLs: the manifest's movie
 * URL for each selected id, dropping ids the manifest has no movie for.
 * Pure — no I/O, so the full 106-id mapping stays unit-testable.
 */
export function resolveJournalPrefetchUrls(
  manifest: JournalMovieManifest | null,
  noteIds: readonly string[],
  options: SelectJournalPrefetchOptions = {},
): JournalPrefetchEntry[] {
  const entries: JournalPrefetchEntry[] = [];
  for (const noteId of selectJournalPrefetchNoteIds(noteIds, options)) {
    const url = journalMovieUrl(manifest, noteId);
    if (url !== null) entries.push({ noteId, url });
  }
  return entries;
}

export type JournalPrefetchFetch = (
  url: string,
  init: { mode: "cors"; credentials: "omit"; signal?: AbortSignal },
) => Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>;

/**
 * Warm one clip: CORS fetch + drain the body so the entry is fully
 * cached. Returns true only when the whole body landed; false on any
 * failure, non-OK status, or abort. Never throws.
 */
export async function warmJournalMovie(
  url: string,
  fetchImpl: JournalPrefetchFetch = globalThis.fetch as JournalPrefetchFetch,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      mode: "cors",
      credentials: "omit",
      signal,
    });
    if (!response.ok) return false;
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

export interface JournalPrefetchHandle {
  /** Abort in-flight warms and prevent queued ones from starting. */
  abort: () => void;
  /** Settles when every started warm has finished. Never rejects. */
  settled: Promise<void>;
}

export interface StartJournalPrefetchOptions {
  fetchImpl?: JournalPrefetchFetch;
  /** External abort (round end / set rotation / tab hidden). */
  signal?: AbortSignal;
  /** Called once per attempted URL, with whether the warm landed. */
  onWarmed?: (url: string, warmed: boolean) => void;
}

/**
 * Bounded runner: warms the URLs with at most
 * JOURNAL_PREFETCH_MAX_CONCURRENT in flight, one AbortController per
 * in-flight fetch, aborts silent. Never rejects, never retries.
 */
export function startJournalPrefetch(
  urls: readonly string[],
  options: StartJournalPrefetchOptions = {},
): JournalPrefetchHandle {
  const fetchImpl =
    options.fetchImpl ?? (globalThis.fetch as JournalPrefetchFetch);
  const controllers = new Set<AbortController>();
  let aborted = false;
  const abort = (): void => {
    if (aborted) return;
    aborted = true;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      aborted = true;
    } else {
      options.signal.addEventListener("abort", abort, { once: true });
    }
  }

  let next = 0;
  async function worker(): Promise<void> {
    while (!aborted) {
      const index = next++;
      if (index >= urls.length) return;
      const url = urls[index]!;
      const controller = new AbortController();
      if (aborted) return;
      controllers.add(controller);
      let warmed = false;
      try {
        warmed = await warmJournalMovie(url, fetchImpl, controller.signal);
      } finally {
        controllers.delete(controller);
      }
      if (aborted) return;
      try {
        options.onWarmed?.(url, warmed);
      } catch {
        // A throwing observer must never break the runner.
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(JOURNAL_PREFETCH_MAX_CONCURRENT, urls.length) },
    () => worker(),
  );
  const settled = Promise.all(workers).then(() => undefined);
  return { abort, settled };
}

/**
 * Resolve the current set's warmable entries from the memoized
 * manifest (fetching it on first call — the same lazy load the tap
 * path uses, so this also warms the manifest cache as a side effect).
 * Returns [] when the manifest is unavailable.
 */
export async function resolveJournalPrefetchEntries(
  noteIds: readonly string[],
  options: SelectJournalPrefetchOptions = {},
): Promise<JournalPrefetchEntry[]> {
  const manifest = await getJournalMovieManifest().catch(() => null);
  if (manifest === null) return [];
  return resolveJournalPrefetchUrls(manifest, noteIds, options);
}
