/**
 * Build-board live check. GitHub is the source of truth. The
 * browser calls the public API directly — no Worker, no KV, no
 * token — in two tiers, inside a fixed request budget (the
 * unauthenticated limit is 60 requests per hour per IP, shared
 * by every viewer behind that IP):
 *
 *  Fast tier, every refresh (3 calls): the newest pulls page,
 *  the branches page, and the open `bug` issues page. The pulls
 *  sort is `updated` desc, so any PR whose state changed since
 *  the last refresh is on page 1.
 *  Deep tier, rarely (at most 4 calls per hour): pulls pages
 *  2..5, cached 60 minutes in localStorage and shared across
 *  tabs, merged by PR number with the fast tier winning.
 *  Together they cover 500 PRs; the ledger's oldest `closes`
 *  PR is #543, so every ledger PR is covered today.
 *
 * A non-array payload, a 403, a 429, or a network failure on
 * the pulls or branches call fails the whole check and the
 * view keeps kanban.json. The issues call is the one
 * exception: its failure leaves the board live with the bug
 * list marked unavailable. A failed deep page keeps the
 * previous cached deep pages and does not fail the check.
 * Overlapping callers share one in-flight sequence. A
 * 5-minute session cache (key v6) makes a repeat free. Focus
 * and visibility re-check only after that cache expires.
 * There is no interval yet: the poller lands in a later
 * commit. A network error is retried once; an HTTP status is
 * not.
 */
import { resolveLocal, resolveSession } from "../game/storage-slot.ts";
import { getJson, getRaw } from "../platform/transport/browser-transport.ts";
import {
  TransportError,
  type SchemaLike,
} from "../platform/transport/transport.ts";
import {
  issueHtmlUrl,
  loadSnapshot,
  type IssueInfo,
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
export const GITHUB_ISSUES_URL =
  `${GITHUB_REPO_API}/issues?labels=bug&state=open&per_page=100`;

/** The pulls list URL for one deep-tier page (pages 2..5). */
export function githubPullsPageUrl(page: number): string {
  return `${GITHUB_RECENT_PULLS_URL}&page=${page}`;
}

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

/**
 * Parse one issues LIST row into an IssueInfo. Rows carrying a
 * `pull_request` key are pulls, not issues, and are skipped.
 */
export function parseGithubIssue(row: unknown): { number: number; info: IssueInfo } | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  if ("pull_request" in o) return null;
  if (typeof o.number !== "number") return null;
  if (typeof o.title !== "string") return null;
  const info: IssueInfo = {
    number: o.number,
    title: o.title,
    htmlUrl: issueHtmlUrl(o.number, o.html_url),
  };
  const labels = parseLabelNames(o.labels);
  if (labels !== undefined) info.labels = labels;
  return { number: o.number, info };
}

/** Parse the issues LIST payload into IssueInfos, keyed by number. Pull rows are skipped. */
export function parseGithubIssues(payload: unknown): Map<number, IssueInfo> {
  const out = new Map<number, IssueInfo>();
  if (!Array.isArray(payload)) return out;
  for (const item of payload) {
    const parsed = parseGithubIssue(item);
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

export const KANBAN_LIVE_CACHE_KEY = "meridian-kanban-live:v6";
export const KANBAN_LIVE_CACHE_TTL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* Deep-tier cache (localStorage, 60 minutes, shared across tabs)      */
/* ------------------------------------------------------------------ */

/** Deep pages cache key. The shape is versioned separately: v1. */
export const KANBAN_DEEP_CACHE_KEY = "meridian-kanban-live:deep:v1";
export const KANBAN_DEEP_CACHE_TTL_MS = 60 * 60_000;
/** Deep tier reads pulls pages 2..this cap: 500 PRs with page 1. */
export const KANBAN_DEEP_PAGE_CAP = 5;

interface DeepCache {
  fetchedAt: number;
  pulls: [number, PullInfo][];
}

function safeDeepStorage(
  storage: KeyValueStorage | null | undefined,
): KeyValueStorage | null {
  if (storage) return storage;
  try {
    return resolveLocal() ?? null;
  } catch {
    return null;
  }
}

function readDeepCache(
  storage: KeyValueStorage | null | undefined,
): { fetchedAt: number; pulls: Map<number, PullInfo> } | null {
  const store = safeDeepStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(KANBAN_DEEP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeepCache>;
    if (typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.pulls)) return null;
    for (const entry of parsed.pulls) {
      if (!Array.isArray(entry) || typeof entry[0] !== "number" || !isPullInfo(entry[1])) {
        return null;
      }
    }
    return { fetchedAt: parsed.fetchedAt, pulls: new Map(parsed.pulls) };
  } catch {
    return null;
  }
}

function writeDeepCache(
  storage: KeyValueStorage | null | undefined,
  fetchedAt: number,
  pulls: ReadonlyMap<number, PullInfo>,
): void {
  const store = safeDeepStorage(storage);
  if (!store) return;
  try {
    const cache: DeepCache = { fetchedAt, pulls: [...pulls.entries()] };
    store.setItem(KANBAN_DEEP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private mode: caching is best-effort, never fatal.
  }
}

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
  issues: ReadonlyMap<number, IssueInfo>;
  /** The issues call failed: the board is live, the bug list is not. */
  issuesUnavailable: boolean;
  fetchedAt: number;
}

interface LiveCache {
  fetchedAt: number;
  pulls: [number, PullInfo][];
  branches: string[];
  issues: [number, IssueInfo][];
  issuesUnavailable: boolean;
}

function isIssueInfo(value: unknown): value is IssueInfo {
  if (!value || typeof value !== "object") return false;
  const p = value as IssueInfo;
  if (typeof p.number !== "number") return false;
  if (typeof p.title !== "string") return false;
  if (typeof p.htmlUrl !== "string") return false;
  if (
    p.labels !== undefined &&
    !(Array.isArray(p.labels) && p.labels.every((label) => typeof label === "string"))
  ) {
    return false;
  }
  return true;
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
    if (!Array.isArray(parsed.issues)) return null;
    for (const entry of parsed.issues) {
      if (!Array.isArray(entry) || typeof entry[0] !== "number" || !isIssueInfo(entry[1])) {
        return null;
      }
    }
    if (typeof parsed.issuesUnavailable !== "boolean") return null;
    return {
      pulls: new Map(parsed.pulls),
      branches: new Set(parsed.branches),
      issues: new Map(parsed.issues),
      issuesUnavailable: parsed.issuesUnavailable,
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
      issues: [...state.issues.entries()],
      issuesUnavailable: state.issuesUnavailable,
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
/* The fetch sequence — fast tier every refresh, deep tier rarely     */
/* ------------------------------------------------------------------ */

/** An HTTP status from GitHub, carrying the status for the rate-limit signal. */
class GithubHttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`GitHub returned ${status} for ${url}`);
    this.name = "GithubHttpError";
    this.status = status;
  }
}

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
  if (!outcome.ok) throw new GithubHttpError(outcome.status, url);
  return outcome.json;
}

export interface FetchKanbanLiveOptions {
  storage?: KeyValueStorage | null;
  /** Deep-tier cache storage; localStorage when omitted. */
  deepStorage?: KeyValueStorage | null;
  now?: number;
  recentPullsUrl?: string;
  branchesUrl?: string;
  issuesUrl?: string;
}

/** The detailed outcome of one fetch sequence, for the rate-limit signal. */
type KanbanFetchOutcome =
  | { kind: "live"; state: KanbanLiveState }
  | { kind: "rateLimited" }
  | { kind: "failed" };

let inflight: Promise<KanbanFetchOutcome> | null = null;

/**
 * Deep-tier pages 2..cap, merged by PR number. Pages stop early
 * on a short page. Any failure — a bad status, a non-array
 * payload, a network error after its retry — returns null and
 * the caller keeps the previous cached deep pages: a failed
 * deep page never fails the check.
 */
async function fetchDeepPages(
  options: FetchKanbanLiveOptions,
): Promise<Map<number, PullInfo> | null> {
  const merged = new Map<number, PullInfo>();
  for (let page = 2; page <= KANBAN_DEEP_PAGE_CAP; page++) {
    let payload: unknown;
    try {
      payload = await fetchViaPort(githubPullsPageUrl(page));
    } catch {
      return null;
    }
    if (!Array.isArray(payload)) return null;
    for (const [number, info] of parseGithubPulls(payload)) {
      merged.set(number, info);
    }
    if (payload.length < 100) break;
  }
  return merged;
}

/**
 * The deep rows to merge into this refresh: the fresh cache when
 * it is fresh, else a re-fetch that replaces the cache on
 * success and keeps the previous rows (even stale) on failure,
 * so the next refresh retries.
 */
async function deepPullsForRefresh(
  options: FetchKanbanLiveOptions,
  now: number,
): Promise<Map<number, PullInfo>> {
  const entry = readDeepCache(options.deepStorage);
  if (entry !== null && now - entry.fetchedAt < KANBAN_DEEP_CACHE_TTL_MS) {
    return entry.pulls;
  }
  const refreshed = await fetchDeepPages(options);
  if (refreshed !== null) {
    writeDeepCache(options.deepStorage, now, refreshed);
    return refreshed;
  }
  return entry?.pulls ?? new Map();
}

/**
 * The open `bug` issues, or an empty map with `unavailable`
 * when the call fails in any way. The issues call never fails
 * the check: the board renders live and the note line says the
 * bug list is unavailable.
 */
async function fetchIssues(
  options: FetchKanbanLiveOptions,
): Promise<{ issues: Map<number, IssueInfo>; unavailable: boolean }> {
  try {
    const payload = await fetchViaPort(options.issuesUrl ?? GITHUB_ISSUES_URL);
    if (!Array.isArray(payload)) return { issues: new Map(), unavailable: true };
    return { issues: parseGithubIssues(payload), unavailable: false };
  } catch {
    return { issues: new Map(), unavailable: true };
  }
}

/**
 * The live check, in two tiers: the fast tier (the newest pulls
 * page, the branches page, and the open `bug` issues page) must
 * succeed on pulls and branches or the whole check fails; the
 * deep tier (older pulls pages) only runs when page 1 is full
 * — a short first page means there is nothing older — and its
 * failures keep the previous deep rows. Overlapping callers
 * share one in-flight sequence.
 */
async function fetchKanbanLiveOutcome(
  options: FetchKanbanLiveOptions,
): Promise<KanbanFetchOutcome> {
  const now = options.now ?? Date.now();
  const cached = readLiveCache(options.storage, now);
  if (cached) return { kind: "live", state: cached };
  if (inflight) return inflight;

  const pending = (async (): Promise<KanbanFetchOutcome> => {
    try {
      const recentPayload = await fetchViaPort(options.recentPullsUrl ?? GITHUB_RECENT_PULLS_URL);
      if (!Array.isArray(recentPayload)) return { kind: "failed" };
      const fastPulls = parseGithubPulls(recentPayload);

      const branchesPayload = await fetchViaPort(options.branchesUrl ?? GITHUB_BRANCHES_URL);
      if (!Array.isArray(branchesPayload)) return { kind: "failed" };

      const { issues, unavailable: issuesUnavailable } = await fetchIssues(options);

      let pulls = fastPulls;
      if (recentPayload.length >= 100) {
        const deep = await deepPullsForRefresh(options, now);
        pulls = new Map([...deep, ...fastPulls]);
      }

      const state: KanbanLiveState = {
        pulls,
        branches: parseGithubBranches(branchesPayload),
        issues,
        issuesUnavailable,
        fetchedAt: now,
      };
      writeLiveCache(options.storage, state);
      return { kind: "live", state };
    } catch (err) {
      if (
        err instanceof GithubHttpError &&
        (err.status === 403 || err.status === 429)
      ) {
        return { kind: "rateLimited" };
      }
      return { kind: "failed" };
    }
  })().finally(() => {
    if (inflight === pending) inflight = null;
  });
  inflight = pending;
  return pending;
}

/**
 * The live check: the merged pulls, branches and open `bug`
 * issues, or null. A non-array payload, a 403, a 429, or a
 * network failure on pulls or branches fails the whole check;
 * an issues failure leaves the state live with the bug list
 * marked unavailable.
 */
export async function fetchKanbanLive(
  options: FetchKanbanLiveOptions = {},
): Promise<KanbanLiveState | null> {
  const outcome = await fetchKanbanLiveOutcome(options);
  return outcome.kind === "live" ? outcome.state : null;
}

export type KanbanRefresh =
  | { action: "skip" }
  | { action: "live"; state: KanbanLiveState }
  | { action: "fallback"; rateLimited?: boolean };

/**
 * Mount always checks GitHub (the session cache may answer with
 * zero calls). Focus and visibility check only after the cache
 * expires. Hidden does nothing. A 403/429 on the fast tier
 * reports `rateLimited` so the poller can back off.
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
  const outcome = await fetchKanbanLiveOutcome({ ...options, now });
  if (outcome.kind === "live") return { action: "live", state: outcome.state };
  if (outcome.kind === "rateLimited") return { action: "fallback", rateLimited: true };
  return { action: "fallback" };
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
