import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  activeCue,
  captionUrl,
  getJournalTranscripts,
  journalTranscriptFor,
  journalTranscriptsUrl,
  loadJournalTranscripts,
  parseJournalTranscripts,
  resetJournalTranscriptsCache,
  type JournalTranscript,
  type JournalTranscriptsFile,
} from "./journal-transcripts.ts";

// The REAL transcripts file landed with the captions worker (commit
// c5cc7ecf): 106 entries, 430 cues, VTT files to match. Tests below run
// against it directly, the way journal-movies.test.ts runs against the
// real manifest — no provisional timings anywhere in this file.
const REAL_TRANSCRIPTS = JSON.parse(
  readFileSync("public/videos/journal-transcripts.json", "utf8"),
) as JournalTranscriptsFile;
const REAL_OLD_FAITHFUL = REAL_TRANSCRIPTS.transcripts["old-faithful"]!;
const REAL_CUE_TOTAL = Object.values(REAL_TRANSCRIPTS.transcripts).reduce(
  (n, t) => n + t.cues.length,
  0,
);

/** Small synthetic payload for the loader tests (fetch stubbing). */
const SYNTHETIC_SHAPE: JournalTranscriptsFile = {
  version: 1,
  transcripts: {
    "old-faithful": {
      source: "synthetic",
      cues: [
        { start: 0.3, end: 1.7, text: "Hey kids, have you heard about this place?" },
        { start: 2.0, end: 3.4, text: "Crowds wait for Old Faithful." },
        { start: 5.5, end: 7.1, text: "Whoosh! That's how it goes up!" },
        { start: 7.4, end: 9.1, text: "And quiet again." },
      ],
    },
  },
};

// --- Shape guard: never crash on a bad fetch, degrade instead -----------

test("parseJournalTranscripts accepts the contract shape", () => {
  const parsed = parseJournalTranscripts(SYNTHETIC_SHAPE);
  assert.ok(parsed !== null);
  assert.equal(parsed!.version, 1);
  assert.equal(parsed!.transcripts["old-faithful"]!.cues.length, 4);
});

test("parseJournalTranscripts rejects anything that is not a usable file", () => {
  for (const bad of [
    null,
    undefined,
    "x",
    42,
    [],
    {},
    { version: "1", transcripts: {} },
    { version: 1, transcripts: null },
    { version: 1, transcripts: [] },
    { version: 1 },
  ]) {
    assert.equal(parseJournalTranscripts(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

test("parseJournalTranscripts drops a malformed entry but keeps the good ones", () => {
  const mixed = {
    version: 1,
    transcripts: {
      "old-faithful": SYNTHETIC_SHAPE.transcripts["old-faithful"],
      broken: { cues: [{ start: 5, end: 2, text: "ends before it starts" }] },
      "no-cues": { source: "nothing here" },
      "empty-text": { cues: [{ start: 0, end: 1, text: "" }] },
    },
  };
  const parsed = parseJournalTranscripts(mixed);
  assert.ok(parsed !== null);
  assert.deepEqual(Object.keys(parsed!.transcripts), ["old-faithful"]);
});

test("journalTranscriptFor returns the entry, or null when absent", () => {
  assert.deepEqual(journalTranscriptFor(SYNTHETIC_SHAPE, "old-faithful"), SYNTHETIC_SHAPE.transcripts["old-faithful"]);
  assert.equal(journalTranscriptFor(SYNTHETIC_SHAPE, "no-such-place"), null);
  assert.equal(journalTranscriptFor(null, "old-faithful"), null);
});

test("journalTranscriptsUrl points at the public transcripts file", () => {
  assert.ok(journalTranscriptsUrl().endsWith("videos/journal-transcripts.json"));
});

test("captionUrl builds the per-entry WebVTT URL", () => {
  assert.ok(captionUrl("old-faithful").endsWith("videos/captions/old-faithful.vtt"));
  assert.ok(captionUrl("giza").endsWith("videos/captions/giza.vtt"));
});

// --- Cue lookup: the spoken line at a time, null in the gap -------------

test("activeCue finds the cue covering the time, inclusive of its start", () => {
  const cues = REAL_OLD_FAITHFUL.cues;
  assert.equal(activeCue(cues, 0.1)?.text, "Hey kids, have you heard about this place?");
  assert.equal(activeCue(cues, 1.0)?.text, "Hey kids, have you heard about this place?");
  assert.equal(activeCue(cues, 2.6)?.text, "Crowds wait for Old Faithful.");
  assert.equal(activeCue(cues, 6.6)?.text, "Whoosh! That's how it goes up!");
  assert.equal(activeCue(cues, 9.0)?.text, "And quiet again.");
});

test("activeCue returns null in the voice-free gap and outside the cues", () => {
  const cues = REAL_OLD_FAITHFUL.cues;
  // The 2.1 s voice-free window between the 2nd and 3rd lines: no line
  // is highlighted while the geyser rumbles.
  assert.equal(activeCue(cues, 5.0), null);
  assert.equal(activeCue(cues, 6.59), null);
  assert.equal(activeCue(cues, 0.0), null);
  assert.equal(activeCue(cues, 2.35), null);
  assert.equal(activeCue(cues, 9.85), null);
  assert.equal(activeCue(cues, 10.0), null);
  assert.equal(activeCue(cues, -1), null);
  assert.equal(activeCue(cues, Number.NaN), null);
});

// --- Loader: failures degrade to null, never throw ----------------------

test("loadJournalTranscripts returns the file on a good fetch", async () => {
  const stub = async () => ({ ok: true, json: async () => REAL_TRANSCRIPTS });
  assert.deepEqual(await loadJournalTranscripts(stub), parseJournalTranscripts(REAL_TRANSCRIPTS));
});

test("loadJournalTranscripts returns null on HTTP error, bad shape, or throw", async () => {
  const httpError = async () => ({ ok: false, json: async () => REAL_TRANSCRIPTS });
  assert.equal(await loadJournalTranscripts(httpError), null);
  const badShape = async () => ({ ok: true, json: async () => ({ nope: true }) });
  assert.equal(await loadJournalTranscripts(badShape), null);
  const throwing = async (): Promise<never> => {
    throw new Error("network down");
  };
  assert.equal(await loadJournalTranscripts(throwing), null);
});

test("getJournalTranscripts fetches at most once per page load", async () => {
  resetJournalTranscriptsCache();
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { ok: true, json: async () => REAL_TRANSCRIPTS };
  };
  const first = await getJournalTranscripts(stub);
  const second = await getJournalTranscripts(stub);
  assert.equal(first, second);
  assert.equal(calls, 1);
  resetJournalTranscriptsCache();
});

test("resetJournalTranscriptsCache lets the next call fetch again", async () => {
  resetJournalTranscriptsCache();
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { ok: true, json: async () => REAL_TRANSCRIPTS };
  };
  const first = await getJournalTranscripts(stub);
  assert.equal(calls, 1);
  resetJournalTranscriptsCache();
  const second = await getJournalTranscripts(stub);
  assert.equal(calls, 2);
  // Each fetch parses a fresh object, so the two loads are equal in
  // value, not identical by reference.
  assert.deepEqual(first, second);
  resetJournalTranscriptsCache();
});

// --- The real file (captions worker, c5cc7ecf): 106/106 covered --------

test("real transcripts file: version 1, 102 entries (4 withheld), 412 cues", () => {
  const parsed = parseJournalTranscripts(REAL_TRANSCRIPTS);
  assert.ok(parsed !== null);
  assert.equal(parsed!.version, 1);
  assert.equal(Object.keys(parsed!.transcripts).length, 102);
  assert.equal(REAL_CUE_TOTAL, 412);
});

test("real Old Faithful: the 4 approved lines, 2.1 s voice-free gap 4.50-6.60", () => {
  const cues = REAL_OLD_FAITHFUL.cues;
  assert.equal(cues.length, 4);
  assert.deepEqual(
    cues.map((c) => c.text),
    [
      "Hey kids, have you heard about this place?",
      "Crowds wait for Old Faithful.",
      "Whoosh! That's how it goes up!",
      "And quiet again.",
    ],
  );
  assert.equal(cues[1]!.end, 4.5);
  assert.equal(cues[2]!.start, 6.6);
  // Float arithmetic: 6.6 - 4.5 is 2.0999999999999996, not 2.1.
  assert.ok(Math.abs(cues[2]!.start - cues[1]!.end - 2.1) < 0.001);
  assert.equal(activeCue(cues, 5.5), null);
});

test("real file: every entry's cues sit inside the 10 s clip, sorted, non-overlapping", () => {
  for (const [id, t] of Object.entries(REAL_TRANSCRIPTS.transcripts)) {
    assert.ok(t.cues.length > 0, `${id} has at least one cue`);
    let prevEnd = 0;
    for (const cue of t.cues) {
      assert.ok(cue.start >= 0 && cue.end <= 10, `${id}: cue inside 0-10 s`);
      assert.ok(cue.start >= prevEnd, `${id}: cues sorted and non-overlapping`);
      prevEnd = cue.end;
    }
  }
});

test("real file: the known cue-count exceptions (robbers-cave 3, split-L1 entries 5)", () => {
  assert.equal(REAL_TRANSCRIPTS.transcripts["robbers-cave"]!.cues.length, 3);
  for (const id of ["victoria-falls", "fushimi", "iguazu", "tongariki", "galapagos"]) {
    assert.equal(REAL_TRANSCRIPTS.transcripts[id]!.cues.length, 5, `${id} keeps two L1 cues`);
  }
});

function parseVttCues(vtt: string): { start: number; end: number; text: string }[] {
  const toSeconds = (stamp: string): number => {
    const [h, m, rest] = stamp.split(":");
    const [s, ms] = rest!.split(".");
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  };
  const cues: { start: number; end: number; text: string }[] = [];
  const blocks = vtt.replace(/^\uFEFF/, "").split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0 || lines[0] === "WEBVTT") continue;
    const match = /^(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)$/.exec(lines[0]!);
    assert.ok(match, `VTT timing line parses: ${lines[0]}`);
    cues.push({
      start: toSeconds(match![1]!),
      end: toSeconds(match![2]!),
      text: lines.slice(1).join("\n"),
    });
  }
  return cues;
}

test("real files: every VTT matches its JSON entry cue-for-cue (count, boundaries, text)", () => {
  const vttFiles = readdirSync("public/videos/captions").filter((f) => f.endsWith(".vtt"));
  assert.equal(vttFiles.length, 102);
  for (const [id, t] of Object.entries(REAL_TRANSCRIPTS.transcripts)) {
    const vtt = readFileSync(`public/videos/captions/${id}.vtt`, "utf8");
    assert.ok(vtt.startsWith("WEBVTT"), `${id}: WEBVTT header`);
    const vttCues = parseVttCues(vtt);
    assert.equal(vttCues.length, t.cues.length, `${id}: same cue count`);
    for (let i = 0; i < t.cues.length; i++) {
      // VTT timestamps are millisecond strings; parsing them back to
      // seconds loses float exactness (1.86 → 1.8599999999999999), so
      // boundaries compare within 1 ms, not strictly.
      assert.ok(Math.abs(vttCues[i]!.start - t.cues[i]!.start) < 0.001, `${id} cue ${i}: same start`);
      assert.ok(Math.abs(vttCues[i]!.end - t.cues[i]!.end) < 0.001, `${id} cue ${i}: same end`);
      assert.equal(vttCues[i]!.text, t.cues[i]!.text, `${id} cue ${i}: same text`);
    }
  }
});
