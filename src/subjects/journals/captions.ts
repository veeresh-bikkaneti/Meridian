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
  // Blocks are separated by blank lines. Headers (WEBVTT, NOTE) are
  // recognised only at the start of a block, and cue text is whatever
  // follows the block's timing line, so a payload such as "1973" or
  // "NOTE …" is kept.
  for (const block of vtt.split(/\r?\n[ \t]*\r?\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const first = lines[0];
    if (first === undefined) continue;
    if (first === "WEBVTT" || first.startsWith("WEBVTT ")) continue;
    if (/^NOTE(\s|$)/.test(first)) continue;
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing === -1) continue;
    for (const line of lines.slice(timing + 1)) {
      out.push(line.replace(/<[^>]+>/g, "").trim());
    }
  }
  return out.filter((part) => part.length > 0).join(" ");
}
