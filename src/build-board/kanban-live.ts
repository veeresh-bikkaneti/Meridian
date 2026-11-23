/**
 * Build-board live overlay — the runtime GitHub check, mirroring
 * src/board/live-feed.ts's discipline (the snapshot stays the
 * fallback; the overlay upgrades it only when the check completes
 * whole):
 *
 *  - Round 2 looks PRs up BY NUMBER. The overlay only ever needs
 *    the `closes` PRs of subtasks that aren't already Done in
 *    the snapshot (today exactly one: #571). Up to 10 needed
 *    numbers are fetched one by one (GET /pulls/{n}); past that,
 *    the check pages pulls?state=all&per_page=100&page=N and
 *    stops as soon as every needed number has been seen. The
 *    round-1 read (the latest 100 pulls) is gone — it never saw
 *    older PRs at all.
 *  - Branches come from ONE GET /branches?per_page=100 call.
 *    The transport port's RawResponse exposes only { ok, status,
 *    json } — no headers — so the `Link: rel="next"` header
 *    cannot be followed and `x-ratelimit-remaining` cannot be
 *    read. The port is not edited for this (the round-2 brief
 *    forbids it); the branch list is a single page, and the
 *    rate-limit defence is the status codes alone: any 403/429
 *    fails the whole check, on top of the small call budget
 *    (at most 11 calls) and the 5-minute session cache below.
 *  - Any failure — a non-200 status, offline, a body that is
 *    not the expected shape — fails the WHOLE check: the
 *    function resolves null and the view keeps the snapshot
 *    under its "snapshot from <date>" stamp. A partial overlay
 *    is never applied, so the board can never show a half-live
 *    picture.
 *  - The parsed states feed kanban-data's applyOverlay
 *    unchanged, so the snapshot rules and the live rules are
 *    one rule.
 *
 * Discipline (live-feed's, kept): one fetch sequence per page
 * load (repeat calls share it), a session cache so reloads and
 * view switches do not re-burn the unauthenticated rate budget
 * (60 requests an hour per IP), no polling, and at most one
 * retry — of a network error, never of an HTTP status. The
 * cache TTL is 5 minutes, not live-feed's 10: the brief for
 * this board sets 5 (a deliberate deviation, recorded in
 * docs/branch-status/feat-build-kanban.md) — build state moves
 * faster than the parent board's story states.
 */
import { resolveSession } from "../game/storage-slot.ts";
import { getJson, getRaw } from "../platform/transport/browser-transport.ts";
import {
  TransportError,
  type SchemaLike,
} from "../platform/transport/transport.ts";
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  loadSnapshot,
  type PullInfo,
  type Snapshot,
  type Subtask,
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

/** At most this many needed PRs are looked up one by one. */
export const MAX_BY_NUMBER_LOOKUPS = 10;
/** The paginated path never reads more pages than this. */
export const MAX_LIST_PAGES = 10;

const pullUrl = (n: number) => `${GITHUB_REPO_API}/pulls/${n}`;
const pullsListUrl = (page: number) =>
  `${GITHUB_REPO_API}/pulls?state=all&per_page=100&page=${page}`;

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
  return {
    number: o.number,
    info: {
      state: o.state,
      draft: o.draft === true,
      merged: typeof o.merged_at === "string" && o.merged_at.length > 0,
    },
  };
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

/**
 * The PR numbers the live check must look up: the `closes` PRs
 * of subtasks not already Done in the snapshot. `ref` PRs are
 * context and are never fetched. Sorted, de-duplicated.
 */
export function collectClosesPullNumbers(subtasks: readonly Subtask[]): number[] {
  const out = new Set<number>();
  for (const sub of subtasks) {
    if (sub.col === "Done") continue;
    for (const pr of sub.prs) {
      if (pr.role === "closes") out.add(pr.number);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* Session cache (sessionStorage, 5 minutes — see the header note)     */
/* ------------------------------------------------------------------ */

export const KANBAN_LIVE_CACHE_KEY = "meridian-kanban-live:v2";
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
  needed: number[];
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
  needed: readonly number[],
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
    // A cache written for a different lookup set proves nothing
    // about this one.
    if (
      !Array.isArray(parsed.needed) ||
      parsed.needed.length !== needed.length ||
      !parsed.needed.every((n, i) => n === needed[i])
    ) {
      return null;
    }
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
  needed: readonly number[],
): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    const cache: LiveCache = {
      fetchedAt: state.fetchedAt,
      needed: [...needed],
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

let bundledSubtasks: Subtask[] | null = null;
function defaultSubtasks(): Subtask[] {
  bundledSubtasks ??= loadSnapshot(snapshotJson).subtasks;
  return bundledSubtasks;
}

/**
 * The live check: the pull states the overlay needs, plus the
 * repo's branch names — or an honest null. Every needed pull
 * must be read and the branches payload must be the expected
 * array; anything less is not a live check at all, and the
 * caller keeps the snapshot.
 */
export async function fetchKanbanLive(options: {
  subtasks?: readonly Subtask[];
  needed?: readonly number[];
  storage?: KeyValueStorage | null;
  now?: number;
  pullUrlFor?: (n: number) => string;
  pullsListUrlFor?: (page: number) => string;
  branchesUrl?: string;
} = {}): Promise<KanbanLiveState | null> {
  const now = options.now ?? Date.now();
  const needed = options.needed ?? collectClosesPullNumbers(options.subtasks ?? defaultSubtasks());

  const cached = readLiveCache(options.storage, now, needed);
  if (cached) return cached;

  try {
    const pulls = new Map<number, PullInfo>();
    if (needed.length > 0 && needed.length <= MAX_BY_NUMBER_LOOKUPS) {
      const urlFor = options.pullUrlFor ?? pullUrl;
      for (const n of needed) {
        const parsed = parseGithubPull(await fetchViaPort(urlFor(n)));
        if (!parsed) throw new Error(`GitHub pull ${n} had an unexpected shape`);
        pulls.set(parsed.number, parsed.info);
      }
    } else if (needed.length > MAX_BY_NUMBER_LOOKUPS) {
      const urlFor = options.pullsListUrlFor ?? pullsListUrl;
      for (let page = 1; page <= MAX_LIST_PAGES; page++) {
        const payload = await fetchViaPort(urlFor(page));
        if (!Array.isArray(payload)) return null;
        for (const [n, info] of parseGithubPulls(payload)) {
          if (needed.includes(n)) pulls.set(n, info);
        }
        if (needed.every((n) => pulls.has(n)) || payload.length < 100) break;
      }
    }

    const branchesPayload = await fetchViaPort(options.branchesUrl ?? GITHUB_BRANCHES_URL);
    if (!Array.isArray(branchesPayload)) return null;

    const state: KanbanLiveState = {
      pulls,
      branches: parseGithubBranches(branchesPayload),
      fetchedAt: now,
    };
    writeLiveCache(options.storage, state, needed);
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
 * calls share the one in-flight (or settled) check — view
 * switches and re-renders never refetch.
 */
export function loadKanbanLive(
  options: { storage?: KeyValueStorage | null; now?: number } = {},
): Promise<KanbanLiveState | null> {
  if (inflight) return inflight;
  inflight = fetchKanbanLive(options);
  return inflight;
}
