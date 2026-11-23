/**
 * Build-board live overlay — the runtime GitHub check, mirroring
 * src/board/live-feed.ts's discipline (the snapshot stays the
 * fallback; the overlay upgrades it only when the check completes
 * whole):
 *
 *  - On board load the page fetches the repo's public pulls and
 *    branches from api.github.com — unauthenticated, no tokens —
 *    ONE call each, no pagination: the overlay's rules need only
 *    each card's own PR state and whether its branch exists, and
 *    per_page=100 covers both lists today.
 *  - Any failure — a non-200 status (a 403 is the unauthenticated
 *    rate limit answering), offline, a body that is not the
 *    expected array — fails the WHOLE check: the function resolves
 *    null and the view keeps the snapshot under its
 *    "snapshot from <date>" stamp. A partial overlay is never
 *    applied, so the board can never show a half-live picture.
 *  - The parsed states feed kanban-data's applyOverlay unchanged,
 *    so the snapshot rules and the live rules are one rule.
 *
 * Discipline (live-feed's, kept): one fetch sequence per page load
 * (repeat calls share it), a session cache so reloads and view
 * switches do not re-burn the unauthenticated rate budget, no
 * polling, and at most one retry — of a network error, never of an
 * HTTP status. The cache TTL is 5 minutes, not live-feed's 10: the
 * brief for this board sets 5 (a deliberate deviation, recorded in
 * docs/branch-status/feat-build-kanban.md) — build state moves
 * faster than the parent board's story states.
 */
import { resolveSession } from "../game/storage-slot.ts";
import { getRaw } from "../platform/transport/browser-transport.ts";
import { TransportError } from "../platform/transport/transport.ts";
import type { PullInfo } from "./kanban-data.ts";

/* ------------------------------------------------------------------ */
/* GitHub payloads (defensive parsing, live-feed's shapes)             */
/* ------------------------------------------------------------------ */

export const GITHUB_PULLS_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls?state=all&per_page=100";
export const GITHUB_BRANCHES_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/branches?per_page=100";

/**
 * Parse the GitHub pulls payload into the slice applyOverlay reads,
 * keyed by PR number. Malformed entries are skipped; a non-array
 * payload yields an empty map (the fetch sequence rejects non-array
 * payloads before ever calling this — see fetchKanbanLive).
 */
export function parseGithubPulls(payload: unknown): Map<number, PullInfo> {
  const out = new Map<number, PullInfo>();
  if (!Array.isArray(payload)) return out;
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.number !== "number" || (o.state !== "open" && o.state !== "closed")) continue;
    out.set(o.number, {
      state: o.state,
      draft: o.draft === true,
      merged: typeof o.merged_at === "string" && o.merged_at.length > 0,
    });
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
/* Session cache (sessionStorage, 5 minutes — see the header note)     */
/* ------------------------------------------------------------------ */

export const KANBAN_LIVE_CACHE_KEY = "meridian-kanban-live:v1";
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
  return (
    (p.state === "open" || p.state === "closed") &&
    typeof p.draft === "boolean" &&
    typeof p.merged === "boolean"
  );
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
    if (typeof parsed.fetchedAt !== "number" || now - parsed.fetchedAt > KANBAN_LIVE_CACHE_TTL_MS)
      return null;
    if (!Array.isArray(parsed.pulls) || !Array.isArray(parsed.branches)) return null;
    for (const entry of parsed.pulls) {
      if (!Array.isArray(entry) || typeof entry[0] !== "number" || !isPullInfo(entry[1]))
        return null;
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

function writeLiveCache(
  storage: KeyValueStorage | null | undefined,
  state: KanbanLiveState,
): void {
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
    // Quota / private mode: caching is best-effort, never fatal.
  }
}

/* ------------------------------------------------------------------ */
/* The fetch sequence                                                  */
/* ------------------------------------------------------------------ */

/**
 * One fetch through the transport port (live-feed's fetchPageViaPort,
 * kept line for line in discipline): getRaw never throws for a
 * failure status and is asked for no retries of its own, so a
 * network/timeout failure is retried exactly once here, an HTTP
 * status never is, and a body that is not JSON fails without retry.
 * Throws on failure; the caller falls back whole.
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

/**
 * The live check: the repo's pull states and branch names, or an
 * honest null. Both calls must complete and both payloads must be
 * the expected arrays — anything less is not a live check at all,
 * and the caller keeps the snapshot.
 */
export async function fetchKanbanLive(options: {
  storage?: KeyValueStorage | null;
  now?: number;
  pullsUrl?: string;
  branchesUrl?: string;
} = {}): Promise<KanbanLiveState | null> {
  const now = options.now ?? Date.now();

  const cached = readLiveCache(options.storage, now);
  if (cached) return cached;

  try {
    const pullsPayload = await fetchViaPort(options.pullsUrl ?? GITHUB_PULLS_URL);
    const branchesPayload = await fetchViaPort(options.branchesUrl ?? GITHUB_BRANCHES_URL);
    if (!Array.isArray(pullsPayload) || !Array.isArray(branchesPayload)) return null;
    const state: KanbanLiveState = {
      pulls: parseGithubPulls(pullsPayload),
      branches: parseGithubBranches(branchesPayload),
      fetchedAt: now,
    };
    writeLiveCache(options.storage, state);
    return state;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* One sequence per page load                                          */
/* ------------------------------------------------------------------ */

let inflight: Promise<KanbanLiveState | null> | null = null;

/**
 * Load the live overlay state over the bundled snapshot. Repeat
 * calls share the one in-flight (or settled) check — view switches
 * and re-renders never refetch.
 */
export function loadKanbanLive(
  options: { storage?: KeyValueStorage | null; now?: number } = {},
): Promise<KanbanLiveState | null> {
  if (inflight) return inflight;
  inflight = fetchKanbanLive(options);
  return inflight;
}
