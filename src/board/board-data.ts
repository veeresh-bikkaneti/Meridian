/**
 * Live scrum board — pure data layer (no React, no three.js, node-testable).
 *
 * The page renders from the snapshot first, then overlays live GitHub PR
 * state fetched from the public REST API with no auth. This module owns:
 *  - the status rule,
 *  - the 10-minute localStorage cache + ETag handling,
 *  - the fallback behaviour on 403 / 429 / network errors (never a retry loop).
 */

export type StoryStatus = "not-started" | "in-progress" | "done";

export interface SnapshotStory {
  lane: string;
  title: string;
  status: StoryStatus;
  waitsOn: string;
  owner: string | null;
  prs: number[];
  inferred: boolean;
}

export interface SnapshotLane {
  name: string;
  note: string;
}

export type DonePathItem =
  | { type: "stage"; label: string }
  | { type: "gate"; title: string; description: string; live: boolean };

export interface SnapshotData {
  asOf: string;
  main: string;
  next: string[];
  lanes: SnapshotLane[];
  stories: SnapshotStory[];
  donePath: DonePathItem[];
}

/** The slice of a GitHub PR the board needs. Titles are display text only. */
export interface GithubPr {
  number: number;
  state: "open" | "closed";
  merged: boolean;
  title: string;
}

export const STATUS_LABEL: Record<StoryStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  done: "Done",
};

export const GITHUB_PULLS_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls?state=all&per_page=100&sort=updated";

export const PR_URL_BASE = "https://github.com/veeresh-bikkaneti/Meridian/pull/";

/**
 * Status rule (owner's brief):
 *  - a story with PRs is Done when ALL its PRs are merged,
 *  - In progress when ANY of its PRs is open,
 *  - otherwise it keeps its snapshot status.
 * Stories without PRs keep snapshot status. A PR that is not in the live
 * payload cannot prove "all merged", so a partially-known set also keeps
 * the snapshot status (unless an open PR already proves In progress).
 */
export function deriveStatus(story: SnapshotStory, prsByNumber: ReadonlyMap<number, GithubPr>): StoryStatus {
  if (story.prs.length === 0) return story.status;
  const known = story.prs.map((n) => prsByNumber.get(n)).filter((p): p is GithubPr => Boolean(p));
  if (known.length === 0) return story.status;
  if (known.some((p) => p.state === "open")) return "in-progress";
  if (known.length === story.prs.length && known.every((p) => p.merged)) return "done";
  return story.status;
}

/** A story after the live overlay: derived status + live PR titles by number. */
export interface LiveStory extends SnapshotStory {
  prTitles: Record<number, string>;
}

export function applyLiveData(stories: readonly SnapshotStory[], prs: readonly GithubPr[]): LiveStory[] {
  const byNumber = new Map(prs.map((p) => [p.number, p]));
  return stories.map((story) => {
    const prTitles: Record<number, string> = {};
    for (const n of story.prs) {
      const pr = byNumber.get(n);
      if (pr) prTitles[n] = pr.title;
    }
    return { ...story, status: deriveStatus(story, byNumber), prTitles };
  });
}

/** Parse the GitHub pulls payload defensively; unknown shapes yield []. */
export function parseGithubPrs(payload: unknown): GithubPr[] {
  if (!Array.isArray(payload)) return [];
  const out: GithubPr[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.number !== "number" || (o.state !== "open" && o.state !== "closed")) continue;
    out.push({
      number: o.number,
      state: o.state,
      merged: typeof o.merged_at === "string" && o.merged_at.length > 0,
      title: typeof o.title === "string" ? o.title : "",
    });
  }
  return out;
}

// --- Cache (localStorage, 10 minutes, ETag) --------------------------------

export const CACHE_KEY = "meridian-board-prs:v1";
export const CACHE_TTL_MS = 10 * 60_000;

export interface BoardCache {
  etag: string | null;
  fetchedAt: number;
  prs: GithubPr[];
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(storage: KeyValueStorage | null | undefined): KeyValueStorage | null {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readCache(storage?: KeyValueStorage | null, now: number = Date.now()): BoardCache | null {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardCache>;
    if (typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.prs)) return null;
    if (now - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return {
      etag: typeof parsed.etag === "string" ? parsed.etag : null,
      fetchedAt: parsed.fetchedAt,
      prs: parsed.prs as GithubPr[],
    };
  } catch {
    return null;
  }
}

export function writeCache(cache: BoardCache, storage?: KeyValueStorage | null): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota / private mode: caching is best-effort, never fatal.
  }
}

// --- Live fetch --------------------------------------------------------------

export type LiveSource = "live" | "cache" | "snapshot";

export interface LiveResult {
  prs: GithubPr[];
  source: LiveSource;
  /** Time of the last good fetch (epoch ms), or null when only the snapshot exists. */
  fetchedAt: number | null;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * One fetch attempt — never a retry loop.
 *  - Fresh cache (< TTL) wins without a network call.
 *  - Otherwise a conditional request is sent with the cached ETag; a 304
 *    reuses the cached payload and refreshes its timestamp.
 *  - On 403 / 429 / any other failure or a network error, the cached data
 *    (if any) or the snapshot is kept and the source says so.
 */
export async function fetchLivePrs(options: {
  fetchFn?: FetchFn;
  storage?: KeyValueStorage | null;
  now?: number;
  url?: string;
} = {}): Promise<LiveResult> {
  const now = options.now ?? Date.now();
  const fetchFn = options.fetchFn ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const cached = readCache(options.storage, now);
  if (cached) return { prs: cached.prs, source: "cache", fetchedAt: cached.fetchedAt };

  // Expired cache is still useful as a fallback + ETag source, even though
  // readCache() above treats it as stale for freshness purposes.
  let stale: BoardCache | null = null;
  const store = safeStorage(options.storage);
  if (store) {
    try {
      const raw = store.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BoardCache>;
        if (typeof parsed.fetchedAt === "number" && Array.isArray(parsed.prs)) {
          stale = {
            etag: typeof parsed.etag === "string" ? parsed.etag : null,
            fetchedAt: parsed.fetchedAt,
            prs: parsed.prs as GithubPr[],
          };
        }
      }
    } catch {
      stale = null;
    }
  }

  try {
    const headers: Record<string, string> = { accept: "application/vnd.github+json" };
    if (stale?.etag) headers["if-none-match"] = stale.etag;
    const res = await fetchFn(options.url ?? GITHUB_PULLS_URL, { headers });
    if (res.status === 304 && stale) {
      writeCache({ ...stale, fetchedAt: now }, options.storage);
      return { prs: stale.prs, source: "live", fetchedAt: now };
    }
    if (!res.ok) {
      return stale
        ? { prs: stale.prs, source: "cache", fetchedAt: stale.fetchedAt }
        : { prs: [], source: "snapshot", fetchedAt: null };
    }
    const prs = parseGithubPrs(await res.json());
    const etag = typeof res.headers?.get === "function" ? res.headers.get("etag") : null;
    writeCache({ etag, fetchedAt: now, prs }, options.storage);
    return { prs, source: "live", fetchedAt: now };
  } catch {
    return stale
      ? { prs: stale.prs, source: "cache", fetchedAt: stale.fetchedAt }
      : { prs: [], source: "snapshot", fetchedAt: null };
  }
}

/** Group stories by lane, preserving snapshot lane order. */
export function groupByLane<T extends { lane: string }>(stories: readonly T[], lanes: readonly SnapshotLane[]): { lane: SnapshotLane; stories: T[] }[] {
  return lanes.map((lane) => ({ lane, stories: stories.filter((s) => s.lane === lane.name) }));
}

/** Group stories into the three scrum columns, preserving snapshot order. */
export function groupByStatus(stories: readonly LiveStory[]): Record<StoryStatus, LiveStory[]> {
  const out: Record<StoryStatus, LiveStory[]> = { "not-started": [], "in-progress": [], done: [] };
  for (const s of stories) out[s.status].push(s);
  return out;
}
