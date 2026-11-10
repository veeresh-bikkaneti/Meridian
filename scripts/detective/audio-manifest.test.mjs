import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  CLUES_ONLY_BUDGET_BYTES,
  checkClueBudgets,
  checkCoreCoverage,
  createManifest,
  entryFromSpec,
  readManifest,
  setEntry,
  textHash,
  verifyManifest,
  writeManifest,
} from "./audio-manifest.mjs";

/** A stand-in clip that passes the #380 content check: an MPEG frame
 * sync followed by padding. */
function fakeMp3(bytes) {
  const b = Buffer.alloc(bytes);
  b[0] = 0xff;
  b[1] = 0xfb;
  return b;
}
import { casePlan } from "./render-plan.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;

test("textHash changes when text, speed, voice or gain changes", () => {
  const base = { voice: "avocado_v2:atlas", speed: 100, gainDb: 0, text: "Hello." };
  const h = textHash(base);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(textHash({ ...base, text: "Hello!" }), h);
  assert.notEqual(textHash({ ...base, speed: 97 }), h);
  assert.notEqual(textHash({ ...base, voice: "avocado_v2:pb1_music_02" }), h);
  assert.notEqual(textHash({ ...base, gainDb: -5 }), h);
  assert.equal(textHash({ ...base }), h, "same inputs must hash the same");
});

/** A tiny fake repo tree: one clue file + a two-row names catalog. */
function fakeTree(clueText) {
  const root = mkdtempSync(join(tmpdir(), "detective-manifest-"));
  mkdirSync(join(root, "public/loop/clues"), { recursive: true });
  mkdirSync(join(root, "public/audio/detective/case-7"), { recursive: true });
  const clue = {
    v: 1,
    placeId: "geonames:42",
    target: { lon: 0, lat: 0 },
    clues: [clueText, "c2", "c3", "c4", "c5"],
    source: { label: "Wikipedia", href: "https://example.invalid" },
  };
  writeFileSync(join(root, "public/loop/clues/7.json"), JSON.stringify(clue));
  const packed = {
    v: 2,
    regions: ["Nevada, United States"],
    n: ["testville"],
    id: [42],
    lon: [0],
    lat: [0],
    r: [0],
    p: [10],
  };
  writeFileSync(join(root, "public/loop/names.v2.json"), JSON.stringify(packed));
  return { root, clue };
}

function manifestFor(root, clue) {
  const manifest = createManifest();
  const plan = casePlan(clue, "Testville, Nevada, United States", 7);
  for (const spec of [...plan.clues, plan.answer]) {
    setEntry(manifest, spec, entryFromSpec(spec, { measuredHz: 90, measuredWpm: 140, durationSec: 5 }));
    writeFileSync(join(root, "public/audio/detective", spec.file), fakeMp3(2048));
  }
  return manifest;
}

test("verify: a fully rendered case is clean", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const result = verifyManifest(root, manifest);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(result.checked, 6);
});

test("verify: tampering one clue word makes exactly that line stale", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const tampered = { ...clue, clues: ["A fine first clue!", "c2", "c3", "c4", "c5"] };
  writeFileSync(join(root, "public/loop/clues/7.json"), JSON.stringify(tampered));
  const result = verifyManifest(root, manifest);
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].kind, "stale");
  assert.equal(result.problems[0].key, "cases.7.clues.0");
});

test("verify: a claimed-but-missing render is reported missing", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = createManifest();
  manifest.coverage.capitals = [7];
  void root;
  void clue;
  const result = verifyManifest(root, manifest);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.kind === "missing" && p.key === "cases.7.answer"));
});

test("verify: a pace-ladder speed (+12 over plan) with its ladder note is not stale", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const plan = casePlan(clue, "Testville, Nevada, United States", 7);
  const spec = plan.clues[0];
  setEntry(manifest, spec, entryFromSpec(
    { ...spec, speed: spec.speed + 12 },
    { measuredHz: 90, measuredWpm: 140, durationSec: 5, note: `pace retry ladder moved speed ${spec.speed} -> ${spec.speed + 12}` },
  ));
  const result = verifyManifest(root, manifest);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
});

test("verify: the same +12 speed without a ladder note is stale", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const plan = casePlan(clue, "Testville, Nevada, United States", 7);
  const spec = plan.clues[0];
  setEntry(manifest, spec, entryFromSpec(
    { ...spec, speed: spec.speed + 12 },
    { measuredHz: 90, measuredWpm: 140, durationSec: 5 },
  ));
  const result = verifyManifest(root, manifest);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.kind === "stale" && p.key === "cases.7.clues.0"));
});

test("manifest round-trips through disk", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  writeManifest(root, manifest);
  const back = readManifest(root);
  assert.deepEqual(back, JSON.parse(readFileSync(join(root, "public/audio/detective/manifest.json"), "utf8")));
  assert.equal(back.cases["7"].answer.text, "Out of guesses. The answer was Testville, Nevada, United States.");
});

test("real tree: the committed manifest verifies against current sources", () => {
  const manifest = readManifest(ROOT);
  const result = verifyManifest(ROOT, manifest);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
});

test("budget: a case whose clue files stay under the clues-only budget passes", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  assert.equal(CLUES_ONLY_BUDGET_BYTES, 500_000);
  assert.deepEqual(checkClueBudgets(root, manifest), []);
});

test("budget: clue bytes over 500,000 fail, and the answer read does not count", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const plan = casePlan(clue, "Testville, Nevada, United States", 7);
  // A huge ANSWER file alone must not trip the clues-only budget.
  writeFileSync(join(root, "public/audio/detective", plan.answer.file), Buffer.alloc(600_000));
  assert.deepEqual(checkClueBudgets(root, manifest), [], "answer bytes are excluded by definition");
  // One oversized CLUE file pushes the clues-only total over budget.
  writeFileSync(join(root, "public/audio/detective", plan.clues[0].file), Buffer.alloc(500_001));
  const problems = checkClueBudgets(root, manifest);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "over-budget");
  assert.equal(problems[0].key, "cases.7.clues");
});

test("real tree: every shipped case is inside the clues-only budget", () => {
  const manifest = readManifest(ROOT);
  assert.deepEqual(checkClueBudgets(ROOT, manifest), []);
});

/* Core coverage (U11, closes FG-3): a core case must be claimed with
 * all five clue reads, or named on the explicit hold list. Before U11
 * the core deck's clue entries were simply empty and no gate noticed —
 * these tests pin the new behaviour, mainly its failures. The fake
 * tree's only case is 7, so the checks run against the range [7]. */

test("coverage: a claimed core case with all five clue reads passes", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  manifest.coverage.core = [7];
  assert.deepEqual(checkCoreCoverage(manifest, [7]), []);
  // And claiming the case keeps full hash verification clean.
  assert.equal(verifyManifest(root, manifest).ok, true);
});

test("coverage: an unclaimed core case fails as uncovered", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  const problems = checkCoreCoverage(manifest, [7]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "uncovered");
  assert.equal(problems[0].key, "cases.7.clues");
});

test("coverage: a claimed core case missing a clue read fails as incomplete", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  manifest.coverage.core = [7];
  manifest.cases["7"].clues[2] = null; // one read silently dropped
  const problems = checkCoreCoverage(manifest, [7]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "incomplete-coverage");
  assert.match(problems[0].detail, /only 4 of its 5/);
});

test("coverage: a held core case with no audio is exempt", () => {
  const manifest = createManifest();
  manifest.coverage.coreHolds = [7];
  assert.deepEqual(checkCoreCoverage(manifest, [7]), []);
});

test("coverage: a hold that carries full audio anyway is a contradiction", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  manifest.coverage.coreHolds = [7];
  const problems = checkCoreCoverage(manifest, [7]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "hold-with-audio");
});

test("coverage: a hold outside the core range fails", () => {
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  manifest.coverage.core = [7];
  manifest.coverage.coreHolds = [999];
  const problems = checkCoreCoverage(manifest, [7]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, "hold-out-of-range");
});

test("real tree: every core case is claimed or explicitly held (FG-3 closed)", () => {
  const manifest = readManifest(ROOT);
  assert.deepEqual(checkCoreCoverage(manifest), []);
});

/* #380: zero-byte or corrupt clips no longer pass the gate. */
test("audioFileProblem: empty, tiny and non-MP3 files are named; real clips pass", async () => {
  const { mkdtempSync, writeFileSync: write, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: j } = await import("node:path");
  const { audioFileProblem, MIN_CLIP_BYTES } = await import("./audio-manifest.mjs");
  const dir = mkdtempSync(j(tmpdir(), "clip-"));
  try {
    const f = (name, buf) => { const p = j(dir, name); write(p, buf); return p; };
    assert.match(audioFileProblem(f("empty.mp3", Buffer.alloc(0))), /empty/);
    assert.match(audioFileProblem(f("tiny.mp3", Buffer.from([0xff, 0xfb, 0x90]))), /only 3 bytes/);
    const junk = Buffer.alloc(MIN_CLIP_BYTES * 2, 0x41);
    assert.match(audioFileProblem(f("junk.mp3", junk)), /does not start like an MP3/);
    const id3 = Buffer.alloc(MIN_CLIP_BYTES * 2);
    id3.write("ID3", 0, "latin1");
    assert.equal(audioFileProblem(f("id3.mp3", id3)), null);
    const frame = Buffer.alloc(MIN_CLIP_BYTES * 2);
    frame[0] = 0xff;
    frame[1] = 0xfb;
    assert.equal(audioFileProblem(f("frame.mp3", frame)), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* #379: a partial hold (1-4 of 5 clue reads on a held case) is pinned.
 * A hold means "ships without full reads"; the reads it does carry are
 * still hash-verified, so the gate accepts it rather than forcing a
 * re-render or a deletion. Only a hold with all five reads contradicts. */
test("coverage: a held core case with a partial set of reads (1-4) is accepted", async () => {
  const { checkCoreCoverage: ccc } = await import("./audio-manifest.mjs");
  const { root, clue } = fakeTree("A fine first clue.");
  const manifest = manifestFor(root, clue);
  manifest.coverage.coreHolds = [7];
  for (const keep of [1, 2, 3, 4]) {
    const m = structuredClone(manifest);
    for (let k = keep; k < 5; k++) m.cases["7"].clues[k] = null;
    assert.deepEqual(ccc(m, [7]), [], `partial hold with ${keep} read(s)`);
  }
});

/* #382: the core literal is pinned to the case files on disk. */
test("real tree: CORE_INDEXES equals the core deck derived from disk", async () => {
  const { CORE_INDEXES, coreIndexesFromDisk } = await import("./audio-manifest.mjs");
  const { fileURLToPath } = await import("node:url");
  const realRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
  assert.deepEqual(coreIndexesFromDisk(realRoot), [...CORE_INDEXES]);
});

/* #381: render scratch next to a clip is flagged; clean trees pass. */
test("strayAudioFiles: names render scratch, ignores clips and the manifest", async () => {
  const { strayAudioFiles } = await import("./audio-manifest.mjs");
  const root = mkdtempSync(join(tmpdir(), "stray-"));
  mkdirSync(join(root, "public/audio/detective/case-1"), { recursive: true });
  writeFileSync(join(root, "public/audio/detective/manifest.json"), "{}");
  writeFileSync(join(root, "public/audio/detective/case-1/clue-1.mp3"), fakeMp3(2048));
  assert.deepEqual(strayAudioFiles(root), []);
  writeFileSync(join(root, "public/audio/detective/case-1/clue-1.mp3.pace-best.mp3"), fakeMp3(2048));
  assert.deepEqual(strayAudioFiles(root), ["case-1/clue-1.mp3.pace-best.mp3"]);
});

/* #378: the gate fails closed when renders exist but the manifest is gone. */
test("gate: missing manifest with rendered case folders exits 2; an empty tree passes", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const gate = fileURLToPath(new URL("./check-audio-manifest.mjs", import.meta.url));
  const empty = mkdtempSync(join(tmpdir(), "gate-empty-"));
  assert.equal(spawnSync(process.execPath, [gate, "--root", empty]).status, 0);
  const lost = mkdtempSync(join(tmpdir(), "gate-lost-"));
  mkdirSync(join(lost, "public/audio/detective/case-3"), { recursive: true });
  writeFileSync(join(lost, "public/audio/detective/case-3/clue-1.mp3"), fakeMp3(2048));
  const r = spawnSync(process.execPath, [gate, "--root", lost], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /manifest\.json is missing/);
});
