import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isSplitManifestRel, readManifest, strayAudioFiles, writeManifest } from "./audio-manifest.mjs";
import { buildSplit, slimEntry, verifySplit, writeSplit } from "./split-audio-manifest.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function entry(file, voice, text) {
  return {
    text,
    textHash: "abc",
    voice,
    speed: 100,
    gainDb: 0,
    file,
    measuredHz: 90,
    measuredWpm: 140,
    durationSec: 2,
    status: "ok",
  };
}

test("slimEntry keeps file and voice and drops the hash record", () => {
  const full = entry("case-7/clue-1.mp3", "voice-w", "A clue.");
  assert.deepEqual(slimEntry(full), { file: "case-7/clue-1.mp3", voice: "voice-w" });
  assert.equal(slimEntry(null), null);
  assert.equal(slimEntry({ voice: "voice-w" }), null);
});

test("writeSplit writes slim shards and does not rewrite the monolith", () => {
  const root = mkdtempSync(join(tmpdir(), "split-manifest-"));
  mkdirSync(join(root, "public/audio/detective"), { recursive: true });
  const manifest = {
    v: 1,
    voices: { holmes: "voice-h", watson: "voice-w" },
    fixed: { "ack-1": entry("fixed/ack-1.mp3", "voice-h", "Yes.") },
    cases: {
      "7": {
        clues: [entry("case-7/clue-1.mp3", "voice-w", "A clue."), null],
        answer: entry("case-7/answer.mp3", "voice-h", "The answer was Testville."),
      },
    },
    names: { "42": entry("names/42.mp3", "voice-h", "Testville.") },
  };
  writeManifest(root, manifest);
  const before = readFileSync(join(root, "public/audio/detective/manifest.json"), "utf8");
  const decks = [{ id: "core", from: 0, to: 6, count: 7 }];
  writeSplit(root, manifest, decks);
  assert.equal(readFileSync(join(root, "public/audio/detective/manifest.json"), "utf8"), before);

  const index = JSON.parse(readFileSync(join(root, "public/audio/detective/split/index.json"), "utf8"));
  assert.equal(index.split, 1);
  assert.equal(index.fixed["ack-1"].file, "fixed/ack-1.mp3");
  assert.equal(index.fixed["ack-1"].text, undefined);
  assert.deepEqual(index.decks, decks);

  const caseFile = JSON.parse(readFileSync(join(root, "public/audio/detective/split/cases/7.json"), "utf8"));
  assert.deepEqual(caseFile.clues[0], { file: "case-7/clue-1.mp3", voice: "voice-w" });
  assert.equal(caseFile.clues[1], null);
  assert.equal(caseFile.answer.file, "case-7/answer.mp3");

  const names = JSON.parse(readFileSync(join(root, "public/audio/detective/split/names.json"), "utf8"));
  assert.deepEqual(names["42"], { file: "names/42.mp3", voice: "voice-h" });

  assert.equal(verifySplit(root, manifest, decks).ok, true);
  writeFileSync(join(root, "public/audio/detective/split/cases/7.json"), "{}\n");
  const stale = verifySplit(root, manifest, decks);
  assert.equal(stale.ok, false);
  assert.ok(stale.problems.some((p) => p.kind === "stale" && p.key.endsWith("cases/7.json")));
});

test("writeSplit drops a case file the monolith no longer has", () => {
  const root = mkdtempSync(join(tmpdir(), "split-orphan-"));
  mkdirSync(join(root, "public/audio/detective/split/cases"), { recursive: true });
  const manifest = {
    v: 1,
    voices: { holmes: "h", watson: "w" },
    fixed: {},
    cases: {},
    names: {},
  };
  writeFileSync(join(root, "public/audio/detective/split/cases/99.json"), "{}\n");
  writeSplit(root, manifest, []);
  const result = verifySplit(root, manifest, []);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(buildSplit(manifest, []).index.split, 1);
});

test("strayAudioFiles allows split shards and still flags scratch", () => {
  const root = mkdtempSync(join(tmpdir(), "split-stray-"));
  const base = join(root, "public/audio/detective");
  mkdirSync(join(base, "split/cases"), { recursive: true });
  mkdirSync(join(base, "case-1"), { recursive: true });
  writeFileSync(join(base, "manifest.json"), "{}");
  writeFileSync(join(base, "split/index.json"), "{}");
  writeFileSync(join(base, "split/names.json"), "{}");
  writeFileSync(join(base, "split/cases/1.json"), "{}");
  writeFileSync(join(base, "case-1/clue-1.mp3"), Buffer.from([0xff, 0xfb]));
  assert.equal(isSplitManifestRel("split/cases/1.json"), true);
  assert.equal(isSplitManifestRel("split/notes.txt"), false);
  assert.deepEqual(strayAudioFiles(root), []);
  writeFileSync(join(base, "split/notes.txt"), "nope");
  assert.deepEqual(strayAudioFiles(root), ["split/notes.txt"]);
});

test("real tree: committed shards match the monolith and the first clue fetch is smaller", () => {
  const manifest = readManifest(ROOT);
  const result = verifySplit(ROOT, manifest);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  const mono = statSync(join(ROOT, "public/audio/detective/manifest.json")).size;
  const index = statSync(join(ROOT, "public/audio/detective/split/index.json")).size;
  const one = statSync(join(ROOT, "public/audio/detective/split/cases/137.json")).size;
  assert.ok(index + one < mono / 10, `first clue fetch ${index + one} B is not under a tenth of ${mono} B`);
});
