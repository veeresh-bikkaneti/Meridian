import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import { serveBuiltArtifact } from "./helpers";
import { stubJournalMediaFixedClips } from "./journal-player.helpers";
import {
  FIXED_ENTRIES,
  OLD_TEXTS,
  assertFixedEntry,
} from "./journal-player.facts.data";

/**
 * Journal player E2E — the 5 Historian-blocked facts, desktop 1280x800.
 *
 * Text head a7191e3e corrected cue 2 of alamo, cadillac, joslyn, niagara,
 * homestead in public/videos/captions/*.vtt + journal-transcripts.json;
 * audio is the rebuilt mp4s on meridian-media fix/journal-facts-5
 * (@ 70b2e95), fulfilled locally per entry (see
 * stubJournalMediaFixedClips — Chromium in this VM cannot reach
 * github.io, and the live Pages site still serves the OLD clips). The
 * video src stays the REAL meridian-media URL; only the bytes are local.
 * Each test asserts the corrected caption is active inside its cue
 * window, the same line highlights in the transcript panel, and the old
 * wrong wording appears nowhere.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaFixedClips(page);
});

test("facts source: corrected lines in VTT + JSON, old wordings nowhere", async () => {
  const transcripts = JSON.parse(readFileSync("public/videos/journal-transcripts.json", "utf8")) as {
    transcripts: Record<string, { cues: { start: number; end: number; text: string }[] }>;
  };
  for (const entry of FIXED_ENTRIES) {
    const vtt = readFileSync(`public/videos/captions/${entry.id}.vtt`, "utf8");
    const cues = transcripts.transcripts[entry.id]!.cues;
    expect(cues[1], `${entry.id} cue 2 in JSON`).toEqual(entry.cue);
    expect(vtt, `${entry.id} corrected line in VTT`).toContain(entry.cue.text);
    const vttCue2 = vtt.split("\n\n")[2] ?? "";
    expect(vttCue2, `${entry.id} VTT cue-2 window`).toContain(
      `${String(Math.floor(entry.cue.start / 60)).padStart(2, "0")}:${(entry.cue.start % 60).toFixed(3).padStart(6, "0")}`,
    );
    for (const old of OLD_TEXTS) {
      expect(vtt, `${entry.id} VTT free of ${JSON.stringify(old)}`).not.toContain(old);
      expect(
        JSON.stringify(cues),
        `${entry.id} JSON cues free of ${JSON.stringify(old)}`,
      ).not.toContain(old);
    }
  }
  console.log("facts source: 5/5 VTT + JSON corrected, old wordings absent");
});

for (const entry of FIXED_ENTRIES) {
  test(`facts desktop: ${entry.id} plays its corrected line`, async ({ page }) => {
    await assertFixedEntry(page, entry);
  });
}
