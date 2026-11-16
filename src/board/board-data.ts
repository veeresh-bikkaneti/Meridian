/**
 * Board v3 — app data layer (React-facing).
 *
 * The board reads ONE published status file (spec §6, Option A):
 * `board-status.json`, produced inside the repo by
 * scripts/board/publish-status.mjs from the private curation file.
 * No PR number, story id, task or task count exists in the published
 * shape (status-core.ts) — and none is ever rendered.
 *
 * On top of the snapshot sits the live feed (live-feed.ts, owner
 * ruling 2026-11-16): the publisher also emits board-links.json —
 * the record-number machinery the browser needs to recompute
 * statuses from live GitHub state. The snapshot renders first and
 * remains the fallback whenever the live check cannot prove full
 * coverage; the header labels which one is on screen.
 *
 * If the published file cannot be fetched, the board falls back to
 * the bundled copy (board-status-fallback.json, identical format,
 * source: "manual") and DISCLOSES that it is showing the bundled copy.
 */
import fallbackJson from "./board-status-fallback.json" with { type: "json" };
import linksFallbackJson from "./board-links-fallback.json" with { type: "json" };
import {
  STATUS_WORD,
  type BoardStatus,
  type PublishedBoard,
  type PublishedStory,
} from "./status-core.ts";
import { isBoardLinks, type BoardLinks } from "./live-feed.ts";

export { STATUS_WORD };
export type { BoardStatus, PublishedBoard, PublishedStory };
export type { BoardLinks };

export const FALLBACK_BOARD = fallbackJson as unknown as PublishedBoard;
export const FALLBACK_LINKS = linksFallbackJson as unknown as BoardLinks;

export interface LoadedBoard {
  board: PublishedBoard;
  /** "generated" = the published file; "manual" = the bundled copy. */
  source: "generated" | "manual";
  /** True when the shown file is over 24 hours old. */
  stale: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isStale(updatedAt: string, now: number): boolean {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return true;
  return now - t > DAY_MS;
}

/** Shape guard: a malformed published file falls back, never renders raw. */
export function isPublishedBoard(value: unknown): value is PublishedBoard {
  if (!value || typeof value !== "object") return false;
  const b = value as PublishedBoard;
  return (
    b.version === 3 &&
    Array.isArray(b.epics) &&
    Array.isArray(b.bonds) &&
    typeof b.counts?.total === "number" &&
    typeof b.updatedAt === "string"
  );
}

export async function loadBoardStatus(
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<LoadedBoard> {
  try {
    // import.meta.env exists under Vite; under the node test runner it
    // is undefined — fall back to the server root there.
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const res = await fetchImpl(`${base}board-status.json`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      if (isPublishedBoard(data)) {
        return { board: data, source: data.source, stale: isStale(data.updatedAt, now) };
      }
    }
  } catch {
    // Network failure → bundled copy, disclosed below.
  }
  return { board: FALLBACK_BOARD, source: "manual", stale: isStale(FALLBACK_BOARD.updatedAt, now) };
}

/**
 * The live feed's links file, fetched like the status file and
 * falling back to the bundled copy. Links are invisible machinery
 * (record numbers for the recompute), so a fallback here needs no
 * disclosure of its own — the header's live/snapshot labelling is
 * driven by whether the GitHub check completes, never by which
 * links copy loaded.
 */
export async function loadBoardLinks(
  fetchImpl: typeof fetch = fetch,
): Promise<BoardLinks> {
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const res = await fetchImpl(`${base}board-links.json`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      if (isBoardLinks(data)) return data;
    }
  } catch {
    // Network failure → bundled copy.
  }
  return FALLBACK_LINKS;
}

/** "Updated Nov 15, 2026, 7:02 AM" — the snapshot's honest stamp. */
export function formatUpdated(updatedAt: string): string {
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "a little while ago";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* ------------------------------------------------------------------ */
/* One shared selection store (§3): {featureId, storySlug} mirrored    */
/* to the URL. Both views read and write through these helpers only.   */
/* ------------------------------------------------------------------ */

export interface BoardSelection {
  featureId: string | null;
  storySlug: string | null;
}

export function parseSelection(search: string): BoardSelection {
  const params = new URLSearchParams(search);
  return { featureId: params.get("feature"), storySlug: params.get("story") };
}

export function selectionSearch(sel: BoardSelection, view?: string): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (sel.featureId) params.set("feature", sel.featureId);
  if (sel.storySlug) params.set("story", sel.storySlug);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function findStory(
  board: PublishedBoard,
  slug: string,
): { story: PublishedStory; featureId: string; featureName: string; epicName: string } | null {
  for (const epic of board.epics)
    for (const feature of epic.features)
      for (const story of feature.stories)
        if (story.slug === slug)
          return { story, featureId: feature.id, featureName: feature.name, epicName: epic.name };
  return null;
}

/** The frontier: the first story on the whole trail that is being worked on. */
export function frontierSlug(board: PublishedBoard): string | null {
  for (const epic of board.epics)
    for (const feature of epic.features)
      for (const story of feature.stories) if (story.status === "in-progress") return story.slug;
  return null;
}

/* ------------------------------------------------------------------ */
/* Honest celebration (§2): a feature closed since the last visit.     */
/* localStorage remembers which features were already seen closed;     */
/* the toast fires at most once per visit and never on a first visit.  */
/* ------------------------------------------------------------------ */

const SEEN_KEY = "meridian-board-v3-seen-closed";

export function readSeenClosed(storage: Storage | null): Set<string> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SEEN_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return null;
  }
}

export function writeSeenClosed(storage: Storage | null, ids: ReadonlySet<string>): void {
  if (!storage) return;
  try {
    storage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // Private mode etc. — the toast simply won't persist its memory.
  }
}

/** Features closed now that were not in the seen set (empty on first visit). */
export function newlyClosedFeatures(board: PublishedBoard, seen: Set<string> | null): string[] {
  if (seen === null) return [];
  const out: string[] = [];
  for (const epic of board.epics)
    for (const feature of epic.features)
      if (feature.total > 0 && feature.done === feature.total && !seen.has(feature.id))
        out.push(feature.name);
  return out;
}

export function allClosedFeatureIds(board: PublishedBoard): Set<string> {
  const out = new Set<string>();
  for (const epic of board.epics)
    for (const feature of epic.features)
      if (feature.total > 0 && feature.done === feature.total) out.add(feature.id);
  return out;
}
