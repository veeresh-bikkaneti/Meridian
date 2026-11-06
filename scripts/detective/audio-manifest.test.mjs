import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  CLUES_ONLY_BUDGET_BYTES,
  checkClueBudgets,
  createManifest,
  entryFromSpec,
  readManifest,
  setEntry,
  textHash,
  verifyManifest,
  writeManifest,
} from "./audio-manifest.mjs";
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
    writeFileSync(join(root, "public/audio/detective", spec.file), "fake mp3 bytes");
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
