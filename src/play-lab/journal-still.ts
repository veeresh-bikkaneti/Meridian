export const JOURNAL_STILL_CLIP_IDS = [
  "world-wars:school-morning",
  "world-wars:quiet-hour",
] as const;

export type JournalStillClipId = (typeof JOURNAL_STILL_CLIP_IDS)[number];

const STILL_SLUG: Record<JournalStillClipId, string> = {
  "world-wars:school-morning": "school-morning",
  "world-wars:quiet-hour": "quiet-hour",
};

export function isJournalStillClip(id: string): id is JournalStillClipId {
  return (JOURNAL_STILL_CLIP_IDS as readonly string[]).includes(id);
}

export function captionFromVtt(vtt: string): string {
  const cues: string[] = [];
  for (const line of vtt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("WEBVTT")) continue;
    if (trimmed.startsWith("NOTE")) continue;
    if (trimmed.includes("-->")) continue;
    cues.push(trimmed);
  }
  return cues.join(" ");
}

export function stillUrlForSlug(slug: string): string {
  return `/images/journals/world-wars/${slug}.webp`;
}

export function narrationUrlForSlug(slug: string): string {
  return `/audio/journals/world-wars/${slug}.mp3`;
}

export function videoUrlForFile(file: string): string {
  const prefix = "public/";
  return file.startsWith(prefix) ? `/${file.slice(prefix.length)}` : `/${file}`;
}

export function stillSlug(id: JournalStillClipId): string {
  return STILL_SLUG[id];
}
