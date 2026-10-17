/**
 * home-journal.ts — pure rotation logic for the Journal ("What the land
 * remembers", docs/journal-spec.md §3–§6), ported from the v2 set engine
 * (src/game/journal.ts on feat/homepage-premium-v5) onto the merged
 * dataset in ./home-journal.data.ts.
 *
 * The dataset is static and bundled (generated from the catalog).
 * Rotation is derived from the wall-clock epoch — every visitor sees the
 * same set in the same 2-hour window, no server state. The pure
 * functions here never read Date.now() inside; the current time is
 * always passed in. The auto-switch wiring the home component runs is
 * factored into `createJournalRotation` below so spec §8's fake-timer
 * unit tests exercise the actual production mechanism.
 */
import {
  JOURNAL_NOTES,
  JOURNAL_SETS,
  type JournalNote,
  type JournalSetData,
} from "./home-journal.data.ts";
import { assetBase } from "./storyteller-lines.ts";

/** One journal window: 2 hours. Full cycle = 36 sets × 2h = 72 hours. */
export const JOURNAL_WINDOW_MS = 7_200_000;

export type { JournalNote, JournalSetData };

/** Public asset URL for a journal note's storybook drawing — the same
 *  assetBase() seam the storyteller audio URLs use, never a hardcoded
 *  deploy path. */
export function journalImageUrl(image: string): string {
  return `${assetBase()}${image}`;
}

/** A set with its notes resolved, in set order. */
export interface JournalSet {
  /** 0-based position in the cycle (footer shows index + 1). */
  index: number;
  /** Shared geography label, or "Field Notes" for mixed remainder sets. */
  geography: string;
  /** True for the mixed-geography remainder sets (spec §3). */
  mixed: boolean;
  notes: JournalNote[];
}

const NOTES_BY_ID: ReadonlyMap<string, JournalNote> = new Map(
  JOURNAL_NOTES.map((note) => [note.id, note]),
);

export function journalNoteCount(): number {
  return JOURNAL_NOTES.length;
}

export function journalSetCount(): number {
  return JOURNAL_SETS.length;
}

/** All sets in rotation order, notes resolved. */
export function journalSets(): JournalSet[] {
  return JOURNAL_SETS.map((set, index) => resolveSet(set, index));
}

function resolveSet(set: JournalSetData, index: number): JournalSet {
  return {
    index,
    geography: set.geography,
    mixed: set.mixed,
    notes: set.noteIds
      .map((id) => NOTES_BY_ID.get(id))
      .filter((note): note is JournalNote => note !== undefined),
  };
}

/**
 * §4 confidence rubric, computed mechanically from the citation href's
 * host: .gov / .edu → verified; any other recorded source → cited.
 * Keep in sync with `confidenceForHref` in
 * scripts/build-journal-dataset.mjs — the unit tests pin both.
 */
export function confidenceForHref(href: string): { tier: "verified" | "cited"; basis: string } {
  let host = "";
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host.endsWith(".gov") || host.endsWith(".edu")) {
    return { tier: "verified", basis: "Government or university source" };
  }
  return { tier: "cited", basis: "Named source recorded in the catalog" };
}

/** The confidence line as displayed under a note (spec §5, verbatim forms). */
export function confidenceText(note: JournalNote): string {
  return note.confidence.tier === "verified"
    ? "Confidence: Verified — government or university source."
    : "Confidence: Cited — named source recorded in the catalog.";
}

/**
 * Index of the set showing at `timeMs` (epoch ms):
 * floor(timeMs / JOURNAL_WINDOW_MS) mod setCount. Deterministic — the
 * same instant yields the same index on any client. Returns -1 when the
 * dataset is empty (spec §7: no current set).
 */
export function journalSetIndexAt(timeMs: number): number {
  const count = JOURNAL_SETS.length;
  if (count === 0) return -1;
  const window = Math.floor(timeMs / JOURNAL_WINDOW_MS);
  return ((window % count) + count) % count;
}

/** The set showing at `timeMs`, or null when the dataset is empty (§7). */
export function journalSetAt(timeMs: number): JournalSet | null {
  const index = journalSetIndexAt(timeMs);
  if (index < 0) return null;
  return resolveSet(JOURNAL_SETS[index]!, index);
}

/** The set at an explicit cycle index (wraps), or null when empty. */
export function journalSetByIndex(index: number): JournalSet | null {
  const count = JOURNAL_SETS.length;
  if (count === 0) return null;
  const wrapped = ((index % count) + count) % count;
  return resolveSet(JOURNAL_SETS[wrapped]!, wrapped);
}

/** Epoch ms at which the window containing `timeMs` ends / the next begins. */
export function nextWindowStart(timeMs: number): number {
  return (Math.floor(timeMs / JOURNAL_WINDOW_MS) + 1) * JOURNAL_WINDOW_MS;
}

/**
 * "h:mm" countdown to the next window (spec §5 footer). Rounds up to the
 * next whole minute so a fresh window reads "2:00", never "1:60"/"0:00"
 * while time remains.
 */
export function nextEntryCountdown(timeMs: number): string {
  const remainingMs = Math.max(0, nextWindowStart(timeMs) - timeMs);
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

/**
 * Deferral rule (spec §6, inline-host form): a newly computed set is
 * applied only when neither blocker holds — focus is not inside the
 * home Journal card, and focus is not inside the inline journal
 * section. Content is never swapped under a reader.
 */
export function shouldApplySetChange(blockers: {
  focusInsideCard: boolean;
  focusInsideSection: boolean;
}): boolean {
  return !blockers.focusInsideCard && !blockers.focusInsideSection;
}

// ---------------------------------------------------------------------------
// Auto-switch wiring (spec §3/§6, §8 fake-timer unit tests)
//
// The mechanism the home component runs, factored out of the component
// so it is unit-testable without a DOM: a boundary timeout scheduled at
// the next window start, a 30 s safety interval (survives timer
// throttling), and recompute() — which the component calls on
// visibilitychange (tab visible again) and on focusin. A recomputed
// index is applied immediately unless a §6 blocker holds, in which case
// it stays pending and lands on the first recompute after the blocker
// clears (e.g. the focusin fired when focus leaves the card/section).
// ---------------------------------------------------------------------------

/** Timer host the rotation schedules on; injectable for fake-timer tests. */
export interface JournalTimerHost {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

const systemTimers: JournalTimerHost = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) =>
    globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

export interface JournalRotation {
  /** Index of the set currently applied. */
  getCurrentIndex: () => number;
  /** Index computed but deferred under a §6 blocker, or null. */
  getPendingIndex: () => number | null;
  /** Recompute the current window's index and apply or defer it (§6). */
  recompute: () => void;
  /** Start the boundary timeout + 30 s safety interval. Idempotent. */
  start: () => void;
  /** Stop all timers. */
  stop: () => void;
}

export function createJournalRotation(options: {
  /** Called whenever a new set index is applied. */
  onApply: (index: number) => void;
  /** The §6 blockers, probed fresh at every recompute. */
  blockers: () => { focusInsideCard: boolean; focusInsideSection: boolean };
  /** Clock; defaults to Date.now. */
  now?: () => number;
  /** Timer host; defaults to the global timers. */
  timers?: JournalTimerHost;
  /** Starting index; defaults to the current window's index. */
  initialIndex?: number;
}): JournalRotation {
  const now = options.now ?? (() => Date.now());
  const timers = options.timers ?? systemTimers;
  let currentIndex = options.initialIndex ?? journalSetIndexAt(now());
  let pendingIndex: number | null = null;
  let timeoutHandle: unknown = null;
  let intervalHandle: unknown = null;
  let running = false;

  const apply = (index: number) => {
    currentIndex = index;
    pendingIndex = null;
    options.onApply(index);
  };

  const recompute = () => {
    const index = journalSetIndexAt(now());
    if (index === currentIndex) {
      pendingIndex = null;
      return;
    }
    if (shouldApplySetChange(options.blockers())) {
      apply(index);
    } else {
      // Deferred: applied on a later recompute once the blocker clears.
      pendingIndex = index;
    }
  };

  const scheduleBoundary = () => {
    const delay = Math.max(0, nextWindowStart(now()) - now()) + 50;
    timeoutHandle = timers.setTimeout(() => {
      if (!running) return;
      recompute();
      scheduleBoundary();
    }, delay);
  };

  const start = () => {
    if (running) return;
    running = true;
    scheduleBoundary();
    intervalHandle = timers.setInterval(recompute, 30_000);
  };

  const stop = () => {
    running = false;
    if (timeoutHandle !== null) timers.clearTimeout(timeoutHandle);
    if (intervalHandle !== null) timers.clearInterval(intervalHandle);
    timeoutHandle = null;
    intervalHandle = null;
  };

  return {
    getCurrentIndex: () => currentIndex,
    getPendingIndex: () => pendingIndex,
    recompute,
    start,
    stop,
  };
}
