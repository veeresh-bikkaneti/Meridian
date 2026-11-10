/**
 * journal-transcripts.ts — the narration transcripts for the Journal
 * player ("What the land remembers").
 *
 * The transcripts file (public/videos/journal-transcripts.json) maps
 * every recovered journal note id to its narration cues, and each entry
 * has a matching WebVTT file at public/videos/captions/<id>.vtt with
 * identical cues. Only recovered entries are present — an entry absent
 * from the file has no transcript, and the player must not offer one.
 *
 * Like the movie manifest, the file is loaded lazily — only when a kid
 * taps a picture — and never bundled. The player fetches it alongside
 * the manifest on open; the CC button and the "Story text" panel appear
 * only for entries present in it.
 */
import { assetBase } from "./storyteller-lines.ts";

export interface JournalTranscriptCue {
  start: number;
  end: number;
  text: string;
}

export interface JournalTranscript {
  cues: JournalTranscriptCue[];
  source?: string;
}

export interface JournalTranscriptsFile {
  version: number;
  transcripts: Record<string, JournalTranscript>;
}

export const JOURNAL_TRANSCRIPTS_PATH = "videos/journal-transcripts.json";

/** Public URL of the transcripts file (same assetBase seam as images/audio). */
export function journalTranscriptsUrl(): string {
  return `${assetBase()}${JOURNAL_TRANSCRIPTS_PATH}`;
}

/** Public URL of one entry's WebVTT captions file. Pure — no I/O. */
export function captionUrl(noteId: string): string {
  return `${assetBase()}videos/captions/${noteId}.vtt`;
}

/**
 * The cue spoken at `time` seconds, or null when no cue covers it —
 * including the voice-free gap between lines, where the narration is
 * silent and no line is highlighted. Pure — no I/O.
 */
export function activeCue(
  cues: JournalTranscriptCue[],
  time: number,
): JournalTranscriptCue | null {
  if (!Number.isFinite(time) || time < 0) return null;
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) return cue;
  }
  return null;
}

/** The transcript for a note id, or null when the file has none for it. Pure — no I/O. */
export function journalTranscriptFor(
  file: JournalTranscriptsFile | null,
  noteId: string,
): JournalTranscript | null {
  if (file === null) return null;
  const entry = file.transcripts[noteId];
  if (!entry || !Array.isArray(entry.cues)) return null;
  return entry;
}

function isValidCue(value: unknown): value is JournalTranscriptCue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const cue = value as Record<string, unknown>;
  return (
    typeof cue.start === "number" &&
    Number.isFinite(cue.start) &&
    cue.start >= 0 &&
    typeof cue.end === "number" &&
    Number.isFinite(cue.end) &&
    cue.end > cue.start &&
    typeof cue.text === "string" &&
    cue.text.length > 0
  );
}

/**
 * Defensive shape check: the captions worker guarantees the shape, but
 * the player must never crash on a bad fetch — it degrades to "no
 * transcript" instead. Returns null for anything that is not a usable
 * file. A single malformed entry is dropped, not fatal: one bad entry
 * must not hide every other entry's captions.
 */
export function parseJournalTranscripts(value: unknown): JournalTranscriptsFile | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number") return null;
  if (typeof v.transcripts !== "object" || v.transcripts === null || Array.isArray(v.transcripts)) {
    return null;
  }
  const transcripts: Record<string, JournalTranscript> = {};
  for (const [id, entry] of Object.entries(v.transcripts as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const cues = (entry as Record<string, unknown>).cues;
    if (!Array.isArray(cues) || !cues.every(isValidCue)) continue;
    transcripts[id] = entry as JournalTranscript;
  }
  return { version: v.version, transcripts };
}

export type JournalTranscriptsFetch = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/**
 * Fetch + validate the transcripts file. Returns null on any failure
 * (network, HTTP error, unparseable body, wrong shape) — the caller
 * hides the CC and Story text buttons, never a crash, and the movie
 * still plays.
 */
export async function loadJournalTranscripts(
  fetchImpl: JournalTranscriptsFetch = globalThis.fetch,
): Promise<JournalTranscriptsFile | null> {
  try {
    const response = await fetchImpl(journalTranscriptsUrl());
    if (!response.ok) return null;
    return parseJournalTranscripts(await response.json());
  } catch {
    return null;
  }
}

/**
 * Memoized loader: the transcripts file is fetched at most once per
 * page load, and only after the first tap. Opening a second entry
 * reuses it.
 */
let cachedTranscripts: Promise<JournalTranscriptsFile | null> | null = null;

export function getJournalTranscripts(
  fetchImpl?: JournalTranscriptsFetch,
): Promise<JournalTranscriptsFile | null> {
  if (cachedTranscripts === null) {
    cachedTranscripts = loadJournalTranscripts(fetchImpl);
  }
  return cachedTranscripts;
}

/**
 * Drop the memoized transcripts so the next getJournalTranscripts()
 * fetches again. The player's "Try again" path resets this alongside
 * the manifest: a failed first fetch would otherwise be cached for
 * the whole page load and no retry could ever succeed.
 */
export function resetJournalTranscriptsCache(): void {
  cachedTranscripts = null;
}
