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

/** Live state of one PR: GitHub's open/closed, with merged split out. */
export type PrLiveState = "open" | "merged" | "closed";

/** A story after the live overlay: derived status + live PR titles/states by number. */
export interface LiveStory extends SnapshotStory {
  prTitles: Record<number, string>;
  prStates: Record<number, PrLiveState>;
}

export function applyLiveData(stories: readonly SnapshotStory[], prs: readonly GithubPr[]): LiveStory[] {
  const byNumber = new Map(prs.map((p) => [p.number, p]));
  return stories.map((story) => {
    const prTitles: Record<number, string> = {};
    const prStates: Record<number, PrLiveState> = {};
    for (const n of story.prs) {
      const pr = byNumber.get(n);
      if (pr) {
        prTitles[n] = pr.title;
        prStates[n] = pr.state === "open" ? "open" : pr.merged ? "merged" : "closed";
      }
    }
    return { ...story, status: deriveStatus(story, byNumber), prTitles, prStates };
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

/**
 * The ONLY story-to-story dependency data that exists: a story's
 * `waitsOn` prose sometimes names an explicit PR ("PR 431 first",
 * "PR 430 merged"). A PR number maps back to a story through that
 * story's `prs` array — the same mapping the live overlay uses.
 */
export interface DependencyEdge {
  /** Index (snapshot order) of the story that must land first. */
  from: number;
  /** Index of the story doing the waiting. */
  to: number;
  /** The PR number the waiting story's `waitsOn` explicitly names. */
  viaPr: number;
}

export function buildDependencyEdges(stories: readonly SnapshotStory[]): DependencyEdge[] {
  const owners = new Map<number, number[]>();
  stories.forEach((story, i) => {
    for (const n of story.prs) owners.set(n, [...(owners.get(n) ?? []), i]);
  });
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();
  stories.forEach((story, to) => {
    const named = new Set([...story.waitsOn.matchAll(/\bPR\s+(\d+)\b/g)].map((m) => Number(m[1])));
    for (const viaPr of [...named].sort((a, b) => a - b)) {
      for (const from of owners.get(viaPr) ?? []) {
        const key = `${from}->${to}:${viaPr}`;
        if (from === to || seen.has(key)) continue;
        seen.add(key);
        edges.push({ from, to, viaPr });
      }
    }
  });
  return edges.sort((a, b) => a.to - b.to || a.from - b.from || a.viaPr - b.viaPr);
}

/** Longest chain of prerequisites behind each story (0 = waits on no story). */
export function dependencyDepths(
  stories: readonly SnapshotStory[],
  edges: readonly DependencyEdge[] = buildDependencyEdges(stories),
): number[] {
  const prereqs = new Map<number, number[]>();
  for (const e of edges) prereqs.set(e.to, [...(prereqs.get(e.to) ?? []), e.from]);
  const depths = new Array<number>(stories.length).fill(0);
  const visiting = new Set<number>();
  const depthOf = (i: number): number => {
    if (depths[i] > 0 || visiting.has(i)) return depths[i];
    visiting.add(i);
    const behind = prereqs.get(i) ?? [];
    if (behind.length > 0) depths[i] = Math.max(...behind.map((p) => depthOf(p) + 1));
    visiting.delete(i);
    return depths[i];
  };
  stories.forEach((_, i) => depthOf(i));
  return depths;
}

export interface StoryMapLayout {
  /** Dependency depth (see dependencyDepths). */
  depth: number;
  /** Slot within the story's lane after ordering, 0-based. */
  slot: number;
}

/**
 * Order stories inside each lane so dependency chains read left to
 * right: shallower depth first, then status (done, in progress, not
 * started), then snapshot order. Returns one layout per story, aligned
 * with the input order.
 */
export function storyMapLayouts(
  stories: readonly SnapshotStory[],
  lanes: readonly SnapshotLane[],
): StoryMapLayout[] {
  const depths = dependencyDepths(stories);
  const statusRank: Record<StoryStatus, number> = { done: 0, "in-progress": 1, "not-started": 2 };
  const out = new Array<StoryMapLayout>(stories.length);
  for (const lane of lanes) {
    const inLane = stories
      .map((story, i) => ({ story, i }))
      .filter(({ story }) => story.lane === lane.name)
      .sort(
        (a, b) =>
          depths[a.i] - depths[b.i] ||
          statusRank[a.story.status] - statusRank[b.story.status] ||
          a.i - b.i,
      );
    inLane.forEach(({ i }, slot) => {
      out[i] = { depth: depths[i], slot };
    });
  }
  stories.forEach((_, i) => {
    if (!out[i]) out[i] = { depth: depths[i], slot: 0 };
  });
  return out;
}

// --- Issues + PR map (/board/issues) ----------------------------------------

export const GITHUB_ISSUES_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/issues?state=all&per_page=100&sort=updated";

export const ISSUE_URL_BASE = "https://github.com/veeresh-bikkaneti/Meridian/issues/";

/** The slice of a GitHub issue the map page needs (never a PR). */
export interface GithubIssue {
  number: number;
  state: "open" | "closed";
  title: string;
  url: string;
}

function githubUrl(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("https://github.com/veeresh-bikkaneti/Meridian/")
    ? value
    : fallback;
}

/**
 * Parse the GitHub issues payload defensively. That endpoint also
 * returns PRs (items carrying a `pull_request` key) — those are NOT
 * issues and are dropped here; PRs come from the pulls payload.
 */
export function parseGithubIssues(payload: unknown): GithubIssue[] {
  if (!Array.isArray(payload)) return [];
  const out: GithubIssue[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.number !== "number" || (o.state !== "open" && o.state !== "closed")) continue;
    if ("pull_request" in o) continue;
    out.push({
      number: o.number,
      state: o.state,
      title: typeof o.title === "string" ? o.title : "",
      url: githubUrl(o.html_url, `${ISSUE_URL_BASE}${o.number}`),
    });
  }
  return out;
}

/**
 * Issue numbers a story explicitly names as `issue(s) <n>` in its title
 * or `waitsOn`. This is the only issue mapping the snapshot supports —
 * there is no `issues` field on a story.
 */
export function explicitIssueNumbers(story: SnapshotStory): number[] {
  const text = `${story.title} ${story.waitsOn}`;
  const out = new Set<number>();
  for (const m of text.matchAll(/\bissues?\s+((?:\d+\s*(?:,|and)\s*)*\d+)/gi)) {
    for (const n of m[1].matchAll(/\d+/g)) out.add(Number(n[0]));
  }
  return [...out].sort((a, b) => a - b);
}

export type StoryWorkItem =
  | { kind: "pr"; number: number; title: string; state: "open" | "closed"; merged: boolean; url: string }
  | { kind: "issue"; number: number; title: string; state: "open" | "closed"; url: string };

export interface StoryWorkGroup {
  story: SnapshotStory;
  items: StoryWorkItem[];
}

/**
 * Group live PRs + issues under the stories they belong to.
 *  - A PR belongs to every story whose `prs` lists its number (the
 *    board's existing mapping, unchanged).
 *  - An issue belongs to every story that explicitly names it
 *    (`explicitIssueNumbers`).
 * Anything matching no story lands in `unmapped` — never forced.
 * Groups follow snapshot story order and only include stories that
 * have at least one item.
 */
export function mapWorkToStories(
  stories: readonly SnapshotStory[],
  prs: readonly GithubPr[],
  issues: readonly GithubIssue[],
): { groups: StoryWorkGroup[]; unmapped: StoryWorkItem[] } {
  const issueOwners = new Map<number, number[]>();
  stories.forEach((story, i) => {
    for (const n of explicitIssueNumbers(story)) {
      issueOwners.set(n, [...(issueOwners.get(n) ?? []), i]);
    }
  });
  const byStory = new Map<number, StoryWorkItem[]>();
  const unmapped: StoryWorkItem[] = [];
  const place = (owners: number[] | undefined, item: StoryWorkItem) => {
    if (!owners || owners.length === 0) {
      unmapped.push(item);
      return;
    }
    for (const i of owners) byStory.set(i, [...(byStory.get(i) ?? []), item]);
  };
  for (const pr of prs) {
    const owners: number[] = [];
    stories.forEach((story, i) => {
      if (story.prs.includes(pr.number)) owners.push(i);
    });
    place(owners.length > 0 ? owners : undefined, {
      kind: "pr",
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      url: `${PR_URL_BASE}${pr.number}`,
    });
  }
  for (const issue of issues) {
    place(issueOwners.get(issue.number), {
      kind: "issue",
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.url,
    });
  }
  const groups = stories
    .map((story, i) => ({ story, items: byStory.get(i) ?? [] }))
    .filter((g) => g.items.length > 0);
  return { groups, unmapped };
}

// --- Issues fetch (same pattern as fetchLivePrs, own cache key) -------------

export const ISSUES_CACHE_KEY = "meridian-board-issues:v1";

export interface IssuesCache {
  etag: string | null;
  fetchedAt: number;
  issues: GithubIssue[];
}

export interface IssuesResult {
  issues: GithubIssue[];
  source: LiveSource;
  fetchedAt: number | null;
}

function readIssuesCache(storage: KeyValueStorage | null, now: number, freshOnly: boolean): IssuesCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ISSUES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IssuesCache>;
    if (typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.issues)) return null;
    if (freshOnly && now - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return {
      etag: typeof parsed.etag === "string" ? parsed.etag : null,
      fetchedAt: parsed.fetchedAt,
      issues: parsed.issues as GithubIssue[],
    };
  } catch {
    return null;
  }
}

/** One fetch attempt, ETag + 10-minute cache — mirrors fetchLivePrs. */
export async function fetchLiveIssues(options: {
  fetchFn?: FetchFn;
  storage?: KeyValueStorage | null;
  now?: number;
  url?: string;
} = {}): Promise<IssuesResult> {
  const now = options.now ?? Date.now();
  const fetchFn = options.fetchFn ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const store = safeStorage(options.storage);
  const cached = readIssuesCache(store, now, true);
  if (cached) return { issues: cached.issues, source: "cache", fetchedAt: cached.fetchedAt };
  const stale = readIssuesCache(store, now, false);
  try {
    const headers: Record<string, string> = { accept: "application/vnd.github+json" };
    if (stale?.etag) headers["if-none-match"] = stale.etag;
    const res = await fetchFn(options.url ?? GITHUB_ISSUES_URL, { headers });
    if (res.status === 304 && stale) {
      if (store) {
        try {
          store.setItem(ISSUES_CACHE_KEY, JSON.stringify({ ...stale, fetchedAt: now }));
        } catch {
          // best-effort cache, never fatal
        }
      }
      return { issues: stale.issues, source: "live", fetchedAt: now };
    }
    if (!res.ok) {
      return stale
        ? { issues: stale.issues, source: "cache", fetchedAt: stale.fetchedAt }
        : { issues: [], source: "snapshot", fetchedAt: null };
    }
    const issues = parseGithubIssues(await res.json());
    const etag = typeof res.headers?.get === "function" ? res.headers.get("etag") : null;
    if (store) {
      try {
        store.setItem(ISSUES_CACHE_KEY, JSON.stringify({ etag, fetchedAt: now, issues }));
      } catch {
        // best-effort cache, never fatal
      }
    }
    return { issues, source: "live", fetchedAt: now };
  } catch {
    return stale
      ? { issues: stale.issues, source: "cache", fetchedAt: stale.fetchedAt }
      : { issues: [], source: "snapshot", fetchedAt: null };
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

export interface HeaderMetrics {
  notStarted: number;
  inProgress: number;
  done: number;
  openPrs: number;
  blocked: number;
}

/**
 * The five /board header metrics, all computed from the stories as shown
 * (snapshot + live overlay):
 *  - status counts come from each story's (derived) status;
 *  - openPrs is the number of DISTINCT PR numbers linked from any story
 *    whose live state is "open" — a PR no live payload has seen (e.g. a
 *    snapshot-only render) carries no state and is never counted open;
 *  - blocked counts stories that are not done and wait, via
 *    buildDependencyEdges (edge.from = prerequisite, edge.to = waiter),
 *    on a story that is not done. Waiting on a done story is not blocked,
 *    and a done story is never blocked.
 */
export function headerMetrics(stories: readonly LiveStory[]): HeaderMetrics {
  const out: HeaderMetrics = { notStarted: 0, inProgress: 0, done: 0, openPrs: 0, blocked: 0 };
  const openPrs = new Set<number>();
  for (const s of stories) {
    if (s.status === "not-started") out.notStarted += 1;
    else if (s.status === "in-progress") out.inProgress += 1;
    else out.done += 1;
    for (const n of s.prs) {
      if (s.prStates?.[n] === "open") openPrs.add(n);
    }
  }
  out.openPrs = openPrs.size;
  const blocked = new Set<number>();
  for (const e of buildDependencyEdges(stories)) {
    if (stories[e.to].status !== "done" && stories[e.from].status !== "done") blocked.add(e.to);
  }
  out.blocked = blocked.size;
  return out;
}
