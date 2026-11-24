/**
 * Build-board live check. GitHub is the source of truth. The
 * browser calls the public API directly — no Worker, no KV, no
 * token — and makes exactly two requests per refresh:
 *
 *  1. GET /pulls?state=all&sort=updated&direction=desc&per_page=100
 *  2. GET /branches?per_page=100
 *
 * There is no by-number lookup and no page walking. A non-array
 * payload, a 403, a 429, or a network failure fails the whole
 * check and the view keeps kanban.json. Overlapping callers share
 * one in-flight pair. A 5-minute session cache (key v4) makes a
 * repeat free. Focus and visibility re-check only after that
 * cache expires. There is no interval. A network error is retried
 * once; an HTTP status is not.
 */
import { resolveSession } from "../game/storage-slot.ts";
import { getJson, getRaw } from "../platform/transport/browser-transport.ts";
import {
  TransportError,
  type SchemaLike,
} from "../platform/transport/transport.ts";
import {
  loadSnapshot,
  type PullInfo,
  type Snapshot,
} from "./kanban-data.ts";

/* ------------------------------------------------------------------ */
/* The per-deploy public snapshot                                      */
/* ------------------------------------------------------------------ */

/**
 * The URL of the snapshot the build published for this deploy:
 * public/build-board.json, written by scripts/board/publish-
 * kanban.mjs during prebuild and copied into the deploy by vite.
 * The base mirrors src/board/board-data.ts — the app deploys
 * under import.meta.env.BASE_URL ("/Meridian/" on Pages); under
 * the node test runner import.meta.env is undefined and the
 * server root stands in.
 */
export function buildBoardUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  return `${base}build-board.json`;
}

/** The v2 envelope as a transport schema: loadSnapshot is the parse. */
const snapshotSchema: SchemaLike<Snapshot> = { parse: (input) => loadSnapshot(input) };

/**
 * Fetch the per-deploy snapshot through the transport port and
 * validate it as a v2 envelope. ANY failure — offline, a non-200
 * status, a body that is not a valid snapshot — resolves null,
 * and the caller keeps the bundled kanban.json: a deploy whose
 * public file is missing or stale-shaped must never blank the
 * board. The live GitHub overlay applies on top of whichever
 * snapshot this returns (or the bundled one).
 */
export async function loadPublicSnapshot(
  options: { url?: string } = {},
): Promise<Snapshot | null> {
  try {
    return await getJson(options.url ?? buildBoardUrl(), snapshotSchema, { retries: 0 });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const GITHUB_REPO_API = "https://api.github.com/repos/veeresh-bikkaneti/Meridian";
export const GITHUB_BRANCHES_URL = `${GITHUB_REPO_API}/branches?per_page=100`;
export const GITHUB_RECENT_PULLS_URL =
  `${GITHUB_REPO_API}/pulls?state=all&sort=updated&direction=desc&per_page=100`;

/* ------------------------------------------------------------------ */
/* GitHub payloads (defensive parsing, live-feed's shapes)             */
/* ------------------------------------------------------------------ */

/**
 * Parse ONE pull payload (the pulls/{n} shape) into the slice
 * applyOverlay reads. Returns null on anything malformed — the
 * fetch sequence treats an unparseable needed pull as a failed
 * check, never as a guess.
 */
export function parseGithubPull(
  payload: unknown,
): { number: number; info: PullInfo } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const o = payload as Record<string, unknown>;
  if (typeof o.number !== "number" || (o.state !== "open" && o.state !== "closed")) {
    return null;
  }
  const head = o.head;
  const headRef =
    typeof head === "object" && head !== null && typeof (head as { ref?: unknown }).ref === "string"
      ? (head as { ref: string }).ref
      : undefined;
  const info: PullInfo = {
    state: o.state,
    draft: o.draft === true,
    merged: typeof o.merged_at === "string" && o.merged_at.length > 0,
  };
  if (typeof o.title === "string") info.title = o.title;
  if (headRef !== undefined) info.headRef = headRef;
  const labels = parseLabelNames(o.labels);
  if (labels !== undefined) info.labels = labels;
  return { number: o.number, info };
}

/** Label names from a pulls payload. Strings or `{ name }` objects. Absent when `labels` is not an array. */
export function parseLabelNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      names.push(item);
      continue;
    }
    if (typeof item === "object" && item !== null && typeof (item as { name?: unknown }).name === "string") {
      const name = (item as { name: string }).name;
      if (name.length > 0) names.push(name);
    }
  }
  return names;
}

/** Parse the pulls LIST payload into the same slice, keyed by number. */
export function parseGithubPulls(payload: unknown): Map<number, PullInfo> {
  const out = new Map<number, PullInfo>();
  if (!Array.isArray(payload)) return out;
  for (const item of payload) {
    const parsed = parseGithubPull(item);
    if (parsed) out.set(parsed.number, parsed.info);
  }
  return out;
}

/** Parse the GitHub branches payload into the set of branch names. */
export function parseGithubBranches(payload: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(payload)) return out;
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name === "string" && o.name.length > 0) out.add(o.name);
  }
  return out;
}



/* ------------------------------------------------------------------ */
/* Session cache (sessionStorage, 5 minutes)                           */
/* ------------------------------------------------------------------ */

export const KANBAN_LIVE_CACHE_KEY = "meridian-kanban-live:v4";
export const KANBAN_LIVE_CACHE_TTL_MS = 5 * 60_000;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(storage: KeyValueStorage | null | undefined): KeyValueStorage | null {
  if (storage) return storage;
  try {
    return resolveSession() ?? null;
  } catch {
    return null;
  }
}

export interface KanbanLiveState {
  pulls: ReadonlyMap<number, PullInfo>;
  branches: ReadonlySet<string>;
  fetchedAt: number;
}

interface LiveCache {
  fetchedAt: number;
  pulls: [number, PullInfo][];
  branches: string[];
}

function isPullInfo(value: unknown): value is PullInfo {
  if (!value || typeof value !== "object") return false;
  const p = value as PullInfo;
  if (
    !(
      (p.state === "open" || p.state === "closed") &&
      typeof p.draft === "boolean" &&
      typeof p.merged === "boolean"
    )
  ) {
    return false;
  }
  if (p.title !== undefined && typeof p.title !== "string") return false;
  if (p.headRef !== undefined && typeof p.headRef !== "string") return false;
  if (
    p.labels !== undefined &&
    !(Array.isArray(p.labels) && p.labels.every((label) => typeof label === "string"))
  ) {
    return false;
  }
  return true;
}

function readLiveCache(
  storage: KeyValueStorage | null | undefined,
  now: number,
): KanbanLiveState | null {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(KANBAN_LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveCache>;
    if (typeof parsed.fetchedAt !== "number" || now - parsed.fetchedAt >= KANBAN_LIVE_CACHE_TTL_MS) {
      return null;
    }
    if (!Array.isArray(parsed.pulls) || !Array.isArray(parsed.branches)) return null;
    for (const entry of parsed.pulls) {
      if (!Array.isArray(entry) || typeof entry[0] !== "number" || !isPullInfo(entry[1])) {
        return null;
      }
    }
    if (!parsed.branches.every((b) => typeof b === "string")) return null;
    return {
      pulls: new Map(parsed.pulls),
      branches: new Set(parsed.branches),
      fetchedAt: parsed.fetchedAt,
    };
  } catch {
    return null;
  }
}

function writeLiveCache(storage: KeyValueStorage | null | undefined, state: KanbanLiveState): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    const cache: LiveCache = {
      fetchedAt: state.fetchedAt,
      pulls: [...state.pulls.entries()],
      branches: [...state.branches],
    };
    store.setItem(KANBAN_LIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private mode: caching is best-effort, never fatal.
  }
}

/**
 * Focus and visibility refresh. Hidden never refetches. A missing
 * cache refetches. A cache younger than the TTL does not.
 */
export function shouldRefetchKanbanLive(input: {
  event: "focus" | "visible" | "hidden";
  cacheFetchedAt: number | null;
  now: number;
}): boolean {
  if (input.event === "hidden") return false;
  if (input.cacheFetchedAt === null) return true;
  return input.now - input.cacheFetchedAt >= KANBAN_LIVE_CACHE_TTL_MS;
}

/* ------------------------------------------------------------------ */
/* The fetch sequence — exactly two calls                              */
/* ------------------------------------------------------------------ */

/**
 * One fetch through the transport port. getRaw never throws for a
 * failure status and is asked for no retries of its own, so a
 * network or timeout failure is retried exactly once here, an HTTP
 * status never is, and a body that is not JSON fails without retry.
 */
async function fetchViaPort(url: string): Promise<unknown> {
  const headers = { accept: "application/vnd.github+json" };
  let outcome: Awaited<ReturnType<typeof getRaw>>;
  try {
    outcome = await getRaw(url, { headers, retries: 0 });
  } catch (err) {
    if (err instanceof TransportError && (err.kind === "network" || err.kind === "timeout")) {
      outcome = await getRaw(url, { headers, retries: 0 });
    } else {
      throw err;
    }
  }
  if (!outcome.ok) throw new Error(`GitHub returned ${outcome.status} for ${url}`);
  return outcome.json;
}

export interface FetchKanbanLiveOptions {
  storage?: KeyValueStorage | null;
  now?: number;
  recentPullsUrl?: string;
  branchesUrl?: string;
}

let inflight: Promise<KanbanLiveState | null> | null = null;

/**
 * The live check: the recent pulls page and the branches page,
 * or null. A non-array payload, a 403, a 429, or a network
 * failure fails the whole check. Nothing else is requested.
 * Overlapping callers share one in-flight pair of requests.
 */
export async function fetchKanbanLive(
  options: FetchKanbanLiveOptions = {},
): Promise<KanbanLiveState | null> {
  const now = options.now ?? Date.now();
  const cached = readLiveCache(options.storage, now);
  if (cached) return cached;
  if (inflight) return inflight;

  const pending = (async (): Promise<KanbanLiveState | null> => {
    try {
      const recentPayload = await fetchViaPort(options.recentPullsUrl ?? GITHUB_RECENT_PULLS_URL);
      if (!Array.isArray(recentPayload)) return null;
      const pulls = parseGithubPulls(recentPayload);

      const branchesPayload = await fetchViaPort(options.branchesUrl ?? GITHUB_BRANCHES_URL);
      if (!Array.isArray(branchesPayload)) return null;

      const state: KanbanLiveState = {
        pulls,
        branches: parseGithubBranches(branchesPayload),
        fetchedAt: now,
      };
      writeLiveCache(options.storage, state);
      return state;
    } catch {
      return null;
    }
  })().finally(() => {
    if (inflight === pending) inflight = null;
  });
  inflight = pending;
  return pending;
}

export type KanbanRefresh =
  | { action: "skip" }
  | { action: "live"; state: KanbanLiveState }
  | { action: "fallback" };

/**
 * Mount always checks GitHub (the session cache may answer with
 * zero calls). Focus and visibility check only after the cache
 * expires. Hidden does nothing.
 */
export async function refreshKanbanLive(
  options: FetchKanbanLiveOptions & {
    event: "mount" | "focus" | "visible" | "hidden";
  },
): Promise<KanbanRefresh> {
  const now = options.now ?? Date.now();
  if (options.event !== "mount") {
    const cached = readLiveCache(options.storage, now);
    if (
      !shouldRefetchKanbanLive({
        event: options.event,
        cacheFetchedAt: cached?.fetchedAt ?? null,
        now,
      })
    ) {
      return { action: "skip" };
    }
  }
  const state = await fetchKanbanLive({ ...options, now });
  if (!state) return { action: "fallback" };
  return { action: "live", state };
}

/**
 * Load the live check. Concurrent callers share the in-flight
 * promise. Once it settles, a later call may run again — the
 * session cache keeps that free until the TTL expires.
 */
export function loadKanbanLive(
  options: FetchKanbanLiveOptions = {},
): Promise<KanbanLiveState | null> {
  return fetchKanbanLive(options);
}
