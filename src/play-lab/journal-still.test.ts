import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  captionFromVtt,
  isJournalStillClip,
  JOURNAL_STILL_CLIP_IDS,
  narrationUrlForSlug,
  stillSlug,
  stillUrlForSlug,
  videoUrlForFile,
} from "./journal-still.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const journalDir = path.join(repoRoot, "docs/scaling/journals/world-wars");
const clips = JSON.parse(fs.readFileSync(path.join(journalDir, "clips.json"), "utf8")) as {
  clips: Array<{ id: string; clip: string; narration: string; file: string; place: { name: string } }>;
  cuts: Array<{ id: string }>;
};

test("still registry is only the two kept world-wars clips", () => {
  assert.deepEqual([...JOURNAL_STILL_CLIP_IDS], [
    "world-wars:school-morning",
    "world-wars:quiet-hour",
  ]);
  for (const cut of clips.cuts) {
    assert.equal(isJournalStillClip(cut.id), false);
    assert.equal(isJournalStillClip(`world-wars:${cut.id}`), false);
  }
});

test("caption text matches the clip narration character for character", () => {
  for (const id of JOURNAL_STILL_CLIP_IDS) {
    const clip = clips.clips.find((row) => row.id === id);
    assert.ok(clip, id);
    const vtt = fs.readFileSync(path.join(journalDir, "captions", `${clip.clip}.vtt`), "utf8");
    assert.equal(captionFromVtt(vtt), clip.narration);
    assert.equal(stillSlug(id), clip.clip);
    assert.equal(stillUrlForSlug(clip.clip), `/images/journals/world-wars/${clip.clip}.webp`);
    assert.equal(narrationUrlForSlug(clip.clip), `/audio/journals/world-wars/${clip.clip}.mp3`);
    assert.equal(videoUrlForFile(clip.file), `/${clip.file.slice("public/".length)}`);
    assert.ok(clip.place.name.length > 0);
    assert.equal(fs.existsSync(path.join(repoRoot, "public", stillUrlForSlug(clip.clip).slice(1))), true);
  }
});
