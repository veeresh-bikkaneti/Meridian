import { JOURNAL_NOTES, type JournalNote } from "./home-journal.data.ts";
import { assetBase } from "./storyteller-lines.ts";

/** How long one set of notes stays on the journal. */
export const JOURNAL_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Notes shown together. */
export const JOURNAL_PAGE = 3;

export function journalWindow(now: number): number {
  return Math.floor(now / JOURNAL_WINDOW_MS);
}

/** Public asset URL for a journal note's storybook drawing — the same
 *  assetBase() seam the storyteller audio URLs use, never a hardcoded
 *  deploy path. */
export function journalImageUrl(image: string): string {
  return `${assetBase()}${image}`;
}

/** The three notes for this 2-hour window. Same clock, same notes. */
export function notesForWindow(now: number): {
  notes: JournalNote[];
  nextAt: number;
} {
  const count = JOURNAL_NOTES.length;
  const slot = journalWindow(now);
  const start = (slot * JOURNAL_PAGE) % count;
  const notes: JournalNote[] = [];
  for (let i = 0; i < JOURNAL_PAGE; i++) notes.push(JOURNAL_NOTES[(start + i) % count]);
  return { notes, nextAt: (slot + 1) * JOURNAL_WINDOW_MS };
}
