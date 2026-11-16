/**
 * Board live feed — the runtime GitHub check (owner ruling,
 * 2026-11-16: "getting the live feed was the biggest requirement we
 * had"). Board v2 shipped this overlay; the v3 redesign removed it
 * with the published-file contract; the owner has restored it, on top
 * of that contract — the published file stays the snapshot and the
 * fallback, the feed upgrades it when it can prove itself.
 *
 * How it works:
 *  - The publisher emits board-links.json beside the status file:
 *    per story, the work-record numbers and the few carried fields
 *    the status rule needs (see scripts/board/publish-status.mjs).
 *    Links are machinery, never rendered — no PR number, title or id
 *    from GitHub ever reaches the page's words.
 *  - On board load the page fetches the repo's public pulls (and, for
 *    any linked record that is not a pull request, its issues) from
 *    api.github.com — unauthenticated, no tokens — PAGINATING until
 *    every linked record is covered. Board v2's centrepiece defect
 *    was a one-page fetch that silently covered none of the linked
 *    records under a "Live" label; here a check that cannot cover
 *    every record is not a live check at all: the board keeps the
 *    snapshot and the header says so.
 *  - With full coverage, statuses are recomputed by the very same
 *    pure rule that built the published file (status-core's
 *    buildPublished), so counts, life pills, the frontier line and
 *    the blocked derivation all move together, in player words.
 *
 * Discipline: one fetch sequence per page load (repeat calls share
 * it), a session cache (10 minutes, the v2 TTL) so reloads and view
 * switches do not re-burn the unauthenticated rate budget, no
 * polling, and at most one retry — of a network error, never of an
 * HTTP status. Behind the boardLiveFeed kill switch (flags.ts).
 */
import {
  buildPublished,
  type BoardStatus,
  type Curation,
  type PublishedBoard,
  type RecordState,
} from "./status-core.ts";

/* ------------------------------------------------------------------ */
/* Links file (published beside the status file)                       */
/* ------------------------------------------------------------------ */

export interface BoardLinkTask {
  phase: string;
  record?: number;
}

export interface BoardLinkStory {
  records: number[];
  carried: BoardStatus;
  phase?: string;
  lineOverride?: string;
  tasks?: BoardLinkTask[];
}

export interface BoardLinks {
  version: 1;
  stories: Record<string, BoardLinkStory>;
}

const STATUSES: readonly string[] = ["not-started", "in-progress", "done"];

export function isBoardLinks(value: unknown): value is BoardLinks {
  if (!value || typeof value !== "object") return false;
  const b = value as BoardLinks;
  if (b.version !== 1 || !b.stories || typeof b.stories !== "object") return false;
  return Object.values(b.stories).every(
    (s) =>
      s &&
      Array.isArray(s.records) &&
      s.records.every((n) => Number.isInteger(n) && n > 0) &&
      STATUSES.includes(s.carried) &&
      (s.tasks === undefined ||
        (Array.isArray(s.tasks) &&
          s.tasks.every(
            (t) =>
              t &&
              typeof t.phase === "string" &&
              (t.record === undefined || (Number.isInteger(t.record) && t.record > 0)),
          ))),
  );
}

/** Every record number the live check must cover, sorted, unique. */
export function wantedRecords(links: BoardLinks): number[] {
  const out = new Set<number>();
  for (const story of Object.values(links.stories)) {
    for (const n of story.records) out.add(n);
    for (const t of story.tasks ?? []) if (t.record !== undefined) out.add(t.record);
  }
  return [...out].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* GitHub payloads (defensive parsing, the v2 shapes)                  */
/* ------------------------------------------------------------------ */

export const GITHUB_PULLS_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls?state=all&per_page=100&sort=updated";
export const GITHUB_ISSUES_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/issues?state=all&per_page=100&sort=updated";

/** The pulls/issues endpoints are requested with per_page=100. */
export const LIVE_PAGE_SIZE = 100;

/**
 * Pagination cap (the v2 value). The overlay pages until every
 * wanted number is covered, a short page ends the list, or this cap
 * is hit — hitting the cap uncovered is a failed check, never a
 * partial "live".
 */
export const MAX_LIVE_PAGES = 6;

export interface GithubPr {
  number: number;
  state: "open" | "closed";
  merged: boolean;
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
    });
  }
  return out;
}

export interface GithubIssue {
  number: number;
  state: "open" | "closed";
}

/**
 * Parse the GitHub issues payload. The issues endpoint also lists
 * pull requests (items carrying a `pull_request` key); those are the
 * pulls pass's business and are skipped here.
 */
export function parseGithubIssues(payload: unknown): GithubIssue[] {
  if (!Array.isArray(payload)) return [];
  const out: GithubIssue[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.number !== "number" || (o.state !== "open" && o.state !== "closed")) continue;
    if ("pull_request" in o) continue;
    out.push({ number: o.number, state: o.state });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Session cache (sessionStorage, 10 minutes — the v2 TTL)             */
/* ------------------------------------------------------------------ */

export const LIVE_CACHE_KEY = "meridian-board-live:v1";
export const LIVE_CACHE_TTL_MS = 10 * 60_000;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(storage: KeyValueStorage | null | undefined): KeyValueStorage | null {
  if (storage) return storage;
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

interface LiveCache {
  fetchedAt: number;
  wanted: number[];
  states: Record<string, RecordState>;
}

function readLiveCache(
  storage: KeyValueStorage | null | undefined,
  wanted: readonly number[],
  now: number,
): LiveCache | null {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveCache>;
    if (typeof parsed.fetchedAt !== "number" || now - parsed.fetchedAt > LIVE_CACHE_TTL_MS)
      return null;
    if (!Array.isArray(parsed.wanted) || !parsed.states || typeof parsed.states !== "object")
      return null;
    // A cache entry answers only the exact wanted set it was fetched
    // for — a republished links file must never be served stale states.
    if (JSON.stringify(parsed.wanted) !== JSON.stringify([...wanted])) return null;
    for (const n of wanted) {
      const s = parsed.states[String(n)];
      if (!s || typeof s.merged !== "boolean" || typeof s.open !== "boolean") return null;
    }
    return parsed as LiveCache;
  } catch {
    return null;
  }
}

function writeLiveCache(
  storage: KeyValueStorage | null | undefined,
  cache: LiveCache,
): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(LIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota / private mode: caching is best-effort, never fatal.
  }
}

/* ------------------------------------------------------------------ */
/* The fetch sequence                                                  */
/* ------------------------------------------------------------------ */

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type LiveFeedResult =
  | {
      kind: "live";
      states: ReadonlyMap<number, RecordState>;
      covered: number;
      wanted: number;
      fromCache: boolean;
    }
  | { kind: "unavailable"; covered: number; wanted: number };

function pagedUrl(base: string, page: number): string {
  return page <= 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${page}`;
}

/**
 * One page fetch: a network error is retried exactly once; an HTTP
 * error status is never retried (a 403 is the rate limit answering —
 * asking again immediately is how budgets die). Throws on failure;
 * the caller falls back whole.
 */
async function fetchPage(fetchFn: FetchFn, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { accept: "application/vnd.github+json" } });
  } catch {
    res = await fetchFn(url, { headers: { accept: "application/vnd.github+json" } });
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${url}`);
  return res.json();
}

/**
 * Page one endpoint into `seen` until every number in `missing` has
 * been seen, the list ends (a short page), or the cap is hit. Pages
 * are de-duplicated by the caller's Map (sort=updated can overlap
 * pages when the list shifts mid-fetch).
 */
async function collectPages<T extends { number: number }>(
  fetchFn: FetchFn,
  base: string,
  parse: (payload: unknown) => T[],
  missing: ReadonlySet<number>,
  seen: Map<number, T>,
): Promise<void> {
  let page = 1;
  for (;;) {
    const payload = await fetchPage(fetchFn, pagedUrl(base, page));
    const rawCount = Array.isArray(payload) ? payload.length : 0;
    for (const item of parse(payload)) if (!seen.has(item.number)) seen.set(item.number, item);
    let covered = true;
    for (const n of missing) if (!seen.has(n)) covered = false;
    if (covered || rawCount < LIVE_PAGE_SIZE || page >= MAX_LIVE_PAGES) return;
    page += 1;
  }
}

/**
 * The live check: pull states for every wanted record, or an honest
 * failure. Pull requests first (every current linked record is one);
 * the issues pass runs only for numbers the pulls list never showed,
 * so a fully-covered check costs the pulls pages alone.
 */
export async function fetchLiveStates(options: {
  wanted: readonly number[];
  fetchFn?: FetchFn;
  storage?: KeyValueStorage | null;
  now?: number;
  pullsUrl?: string;
  issuesUrl?: string;
}): Promise<LiveFeedResult> {
  const wanted = [...options.wanted];
  const wantedSet = new Set(wanted);
  const now = options.now ?? Date.now();
  const fetchFn =
    options.fetchFn ?? ((u: string, i?: RequestInit) => fetch(u, i));

  const cached = readLiveCache(options.storage, wanted, now);
  if (cached) {
    return {
      kind: "live",
      states: new Map(
        wanted.map((n) => [n, cached.states[String(n)]] as [number, RecordState]),
      ),
      covered: wanted.length,
      wanted: wanted.length,
      fromCache: true,
    };
  }

  const states = new Map<number, RecordState>();
  try {
    const prs = new Map<number, GithubPr>();
    await collectPages(fetchFn, options.pullsUrl ?? GITHUB_PULLS_URL, parseGithubPrs, wantedSet, prs);
    for (const [n, pr] of prs)
      states.set(n, { merged: pr.merged, open: pr.state === "open" });

    const missing = wanted.filter((n) => !states.has(n));
    if (missing.length > 0) {
      const issues = new Map<number, GithubIssue>();
      await collectPages(
        fetchFn,
        options.issuesUrl ?? GITHUB_ISSUES_URL,
        parseGithubIssues,
        new Set(missing),
        issues,
      );
      for (const n of missing) {
        const issue = issues.get(n);
        if (issue) states.set(n, { merged: false, open: issue.state === "open" });
      }
    }
  } catch {
    const covered = wanted.filter((n) => states.has(n)).length;
    return { kind: "unavailable", covered, wanted: wanted.length };
  }

  const covered = wanted.filter((n) => states.has(n)).length;
  if (covered < wanted.length) return { kind: "unavailable", covered, wanted: wanted.length };

  writeLiveCache(options.storage, {
    fetchedAt: now,
    wanted,
    states: Object.fromEntries(wanted.map((n) => [String(n), states.get(n)!])),
  });
  return { kind: "live", states, covered, wanted: wanted.length, fromCache: false };
}

/* ------------------------------------------------------------------ */
/* The recompute — the publisher's own rule, fed live states           */
/* ------------------------------------------------------------------ */

/**
 * Rebuild the published board from the snapshot's own words plus the
 * links machinery, with live record states in place of the captured
 * ones. buildPublished is the publisher's rule, so a live board and
 * a published board can never drift apart in shape or wording: fed
 * the captured states, this reproduces the published file exactly.
 */
export function applyLiveBoard(
  board: PublishedBoard,
  links: BoardLinks,
  states: ReadonlyMap<number, RecordState>,
): PublishedBoard {
  const curation: Curation = {
    epics: board.epics.map((epic) => ({
      id: epic.id,
      name: epic.name,
      color: epic.color,
      features: epic.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        promise: feature.promise,
        anim: feature.anim,
        stories: feature.stories.map((story) => {
          const link = links.stories[story.slug];
          return {
            sourceId: story.slug,
            slug: story.slug,
            title: story.title,
            records: link?.records ?? [],
            carriedStatus: link?.carried ?? story.status,
            ...(link?.phase ? { phase: link.phase } : {}),
            ...(link?.lineOverride ? { lineOverride: link.lineOverride } : {}),
            ...(link?.tasks
              ? {
                  tasks: link.tasks.map((t) => ({
                    // Task titles are private and never published;
                    // the status rule reads only phase + record.
                    title: "",
                    phase: t.phase,
                    ...(t.record !== undefined ? { record: t.record } : {}),
                  })),
                }
              : {}),
          };
        }),
      })),
    })),
    waits: board.bonds.map((b) => ({ from: b.fromSlug, to: b.toSlug })),
  };
  return buildPublished(curation, states, { source: board.source, updatedAt: board.updatedAt });
}

/* ------------------------------------------------------------------ */
/* One sequence per page load                                          */
/* ------------------------------------------------------------------ */

export type LiveBoardResult =
  | { kind: "live"; board: PublishedBoard; covered: number; wanted: number }
  | { kind: "unavailable"; covered: number; wanted: number };

let inflight: { key: string; promise: Promise<LiveBoardResult> } | null = null;

/**
 * Load the live board over a loaded snapshot. Repeat calls with the
 * same snapshot + links share the one in-flight (or settled) check —
 * view switches and re-renders never refetch.
 */
export function loadLiveBoard(
  board: PublishedBoard,
  links: BoardLinks,
  options: {
    fetchFn?: FetchFn;
    storage?: KeyValueStorage | null;
    now?: number;
    pullsUrl?: string;
    issuesUrl?: string;
  } = {},
): Promise<LiveBoardResult> {
  const wanted = wantedRecords(links);
  const key = `${board.updatedAt}|${wanted.join(",")}`;
  if (inflight && inflight.key === key) return inflight.promise;
  const promise = (async (): Promise<LiveBoardResult> => {
    const result = await fetchLiveStates({ ...options, wanted });
    if (result.kind !== "live") return result;
    return {
      kind: "live",
      board: applyLiveBoard(board, links, result.states),
      covered: result.covered,
      wanted: result.wanted,
    };
  })();
  inflight = { key, promise };
  return promise;
}
