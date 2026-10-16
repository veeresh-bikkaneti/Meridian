/**
 * journal.ts — pure rotation logic for the Journal ("What the land
 * remembers", docs/journal-spec.md §3–§6).
 *
 * The dataset is static and bundled (journal-data.ts, generated from the
 * catalog). Rotation is derived from the wall-clock epoch — every visitor
 * sees the same set in the same 2-hour window, no server state. All
 * functions here are pure: the current time is always passed in, never
 * read from Date.now() inside.
 */
import {
  JOURNAL_NOTES,
  JOURNAL_SETS,
  type JournalNote,
  type JournalSetData,
} from "./journal-data.ts";

/** One journal window: 2 hours. Full cycle = 36 sets × 2h = 72 hours. */
export const WINDOW_MS = 7_200_000;

export type { JournalNote, JournalSetData };

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
  JOURNAL_NOTES.map((note) => [note.placeId, note]),
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
 * floor(timeMs / WINDOW_MS) mod setCount. Deterministic — the same
 * instant yields the same index on any client. Returns -1 when the
 * dataset is empty (spec §7: no current set).
 */
export function journalSetIndexAt(timeMs: number): number {
  const count = JOURNAL_SETS.length;
  if (count === 0) return -1;
  const window = Math.floor(timeMs / WINDOW_MS);
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
  return (Math.floor(timeMs / WINDOW_MS) + 1) * WINDOW_MS;
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
 * Deferral rule (spec §6): a newly computed set is applied only when
 * neither blocker holds — the journal view is not open, and focus is not
 * inside the home Journal card. Content is never swapped under a reader.
 */
export function shouldApplySetChange(blockers: {
  overlayOpen: boolean;
  focusInsideCard: boolean;
}): boolean {
  return !blockers.overlayOpen && !blockers.focusInsideCard;
}
