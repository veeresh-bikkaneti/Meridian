/**
 * WebVTT caption text, for the clip fallback (no movie is rendered yet).
 *
 * Pure: takes the .vtt source as a string so unit tests can run under
 * plain Node. The raw file loading lives in caption-files.ts (Vite
 * ?raw), which tests never import.
 */

/** Cue text only: header, NOTE blocks, cue numbers, timestamps and
 * inline tags are dropped; the cue lines run together in order. */
export function cueText(vtt: string): string {
  const out: string[] = [];
  let inNote = false;
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      inNote = false;
      continue;
    }
    if (line === "WEBVTT" || line.startsWith("WEBVTT ")) continue;
    if (/^NOTE(\s|$)/.test(line)) {
      inNote = true;
      continue;
    }
    if (inNote) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.includes("-->")) continue;
    out.push(line.replace(/<[^>]+>/g, "").trim());
  }
  return out.filter((part) => part.length > 0).join(" ");
}
