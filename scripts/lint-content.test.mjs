/**
 * lint-content.test.mjs — subprocess tests for scripts/lint-content.mjs (WI-17).
 *
 * The lint imports the runtime's TypeScript modules, so it only runs under
 * node --experimental-strip-types. This test file runs WITHOUT strip-types
 * (it is part of the scripts half of `npm test`), so it must not import
 * those modules itself — it spawns the real CLI instead, which is also
 * exactly what CI runs.
 *
 * Fixtures live in temp dirs under os.tmpdir() and are removed in finally;
 * no fixture ever lands in public/loop/clues/ or any shipped path.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts/lint-content.mjs");
// The measurement rule is identified by a fragment of its pattern source,
// copied from src/game/story-ai.ts (MEASUREMENT_RE). The test cannot import
// that TS module, so the fragment is how "the measurement rule" is named.
const MEASUREMENT_RULE_FRAGMENT = "kilometers?|kilometres?|km";
const MEASUREMENT_RULE =
  "\\b\\d[\\d,]*\\s*-?\\s*(kilometers?|kilometres?|km|miles?|mi|feet|ft|meters?|metres?|m)\\b";

function runLintCli(args = []) {
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", SCRIPT, ...args],
    { cwd: REPO, encoding: "utf8" },
  );
  return { status: res.status, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

/** A temp clues dir holding one clue file, plus a baseline file beside it. */
function makeFixture({ fileName, clues, baselineEntries }) {
  const root = mkdtempSync(join(tmpdir(), "lint-content-"));
  const cluesDir = join(root, "clues");
  mkdirSync(cluesDir);
  writeFileSync(
    join(cluesDir, fileName),
    JSON.stringify({ v: 1, placeId: "fixture:test", clues }),
  );
  const baselinePath = join(root, "baseline.json");
  writeFileSync(baselinePath, JSON.stringify({ entries: baselineEntries }));
  return { root, cluesDir, baselinePath };
}

const CLEAN_CLUES = [
  "A fine first clue.",
  "A fine second clue.",
  "A fine third clue.",
  "A fine fourth clue.",
  "A fine fifth clue.",
];

test("real corpora pass: counts all > 0, 6 baselined, capitol reported KNOWN", () => {
  const { status, output } = runLintCli();
  assert.equal(status, 0, output);
  const scanned = output.match(
    /lint-content: scanned clues=(\d+) starters=(\d+) catalog=(\d+)/,
  );
  assert.ok(scanned, output);
  for (const n of scanned.slice(1)) assert.ok(Number(n) > 0, output);
  assert.match(output, /baselined 6/);
  const knownCapitol = output
    .split("\n")
    .find((line) => line.includes("KNOWN") && line.includes("capitol"));
  assert.ok(knownCapitol, output);
  assert.match(output, /lint-content: GATE PASSED/);
});

test("seeded bad fixture fails and names the file, the record, and the measurement rule", () => {
  const fixture = makeFixture({
    fileName: "fixture-bad.json",
    clues: [
      "A fine first clue.",
      "It stands 12 km from the river.",
      "A fine third clue.",
      "A fine fourth clue.",
      "A fine fifth clue.",
    ],
    baselineEntries: [],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      fixture.cluesDir,
      "--baseline",
      fixture.baselinePath,
    ]);
    assert.equal(status, 1, output);
    assert.match(output, /VIOLATION/);
    assert.ok(output.includes("fixture-bad.json"), output);
    assert.ok(output.includes("#c2"), output);
    assert.ok(output.includes(MEASUREMENT_RULE_FRAGMENT), output);
    assert.ok(output.includes('match="12 km"'), output);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("stale baseline entry fails with a STALE BASELINE line", () => {
  const fixture = makeFixture({
    fileName: "fixture-clean.json",
    clues: CLEAN_CLUES,
    baselineEntries: [
      {
        corpus: "clues",
        locator: "fixture-clean.json#c1",
        rule: "stale-rule-that-matches-nothing",
        matchedText: "999 km",
        note: "test-only stale entry",
      },
    ],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      fixture.cluesDir,
      "--baseline",
      fixture.baselinePath,
    ]);
    assert.equal(status, 1, output);
    const staleLine = output
      .split("\n")
      .find(
        (line) =>
          line.includes("STALE BASELINE") && line.includes("fixture-clean.json#c1"),
      );
    assert.ok(staleLine, output);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("two different measurements in one clue with empty baseline fails naming both", () => {
  const fixture = makeFixture({
    fileName: "fixture-two-measurements.json",
    clues: [
      "The district seat is 54 km away. The state capital is 69 km away.",
      "A fine second clue.",
      "A fine third clue.",
      "A fine fourth clue.",
      "A fine fifth clue.",
    ],
    baselineEntries: [],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      fixture.cluesDir,
      "--baseline",
      fixture.baselinePath,
    ]);
    assert.equal(status, 1, output);
    const violations = output
      .split("\n")
      .filter((line) => line.includes("VIOLATION"));
    assert.ok(
      violations.some((line) => line.includes('match="54 km"')),
      output,
    );
    assert.ok(
      violations.some((line) => line.includes('match="69 km"')),
      output,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("two measurements in one clue with only one baselined fails naming the unbaselined one", () => {
  const fixture = makeFixture({
    fileName: "fixture-partial-baseline.json",
    clues: [
      "The district seat is 54 km away. The state capital is 69 km away.",
      "A fine second clue.",
      "A fine third clue.",
      "A fine fourth clue.",
      "A fine fifth clue.",
    ],
    baselineEntries: [
      {
        corpus: "clues",
        locator: "fixture-partial-baseline.json#c1",
        rule: MEASUREMENT_RULE,
        matchedText: "54 km",
        occurrence: 0,
        note: "test-only baselined entry",
      },
    ],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      fixture.cluesDir,
      "--baseline",
      fixture.baselinePath,
    ]);
    assert.equal(status, 1, output);
    const violations = output
      .split("\n")
      .filter((line) => line.includes("VIOLATION"));
    assert.ok(
      violations.some((line) => line.includes('match="69 km"')),
      output,
    );
    assert.ok(
      !violations.some((line) => line.includes('match="54 km"')),
      output,
    );
    assert.ok(
      output
        .split("\n")
        .some(
          (line) => line.includes("KNOWN") && line.includes('match="54 km"'),
        ),
      output,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("same measurement twice in one clue with only occurrence 0 baselined fails on occurrence 1", () => {
  const fixture = makeFixture({
    fileName: "fixture-same-twice.json",
    clues: [
      "It is 12 km to the river and 12 km to the hills.",
      "A fine second clue.",
      "A fine third clue.",
      "A fine fourth clue.",
      "A fine fifth clue.",
    ],
    baselineEntries: [
      {
        corpus: "clues",
        locator: "fixture-same-twice.json#c1",
        rule: MEASUREMENT_RULE,
        matchedText: "12 km",
        occurrence: 0,
        note: "test-only baselined entry",
      },
    ],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      fixture.cluesDir,
      "--baseline",
      fixture.baselinePath,
    ]);
    assert.equal(status, 1, output);
    const violations = output
      .split("\n")
      .filter((line) => line.includes("VIOLATION"));
    assert.ok(
      violations.some(
        (line) =>
          line.includes('match="12 km"') && line.includes("occurrence=1"),
      ),
      output,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("malformed-shape clue file fails naming the file", () => {
  const notArray = makeFixture({
    fileName: "fixture-not-array.json",
    clues: "not-an-array",
    baselineEntries: [],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      notArray.cluesDir,
      "--baseline",
      notArray.baselinePath,
    ]);
    assert.equal(status, 1, output);
    assert.ok(output.includes("SHAPE"), output);
    assert.ok(output.includes("fixture-not-array.json"), output);
  } finally {
    rmSync(notArray.root, { recursive: true, force: true });
  }
  const nonString = makeFixture({
    fileName: "fixture-non-string.json",
    clues: [
      42,
      "A fine second clue.",
      "A fine third clue.",
      "A fine fourth clue.",
      "A fine fifth clue.",
    ],
    baselineEntries: [],
  });
  try {
    const { status, output } = runLintCli([
      "--corpus",
      "clues",
      "--clues-dir",
      nonString.cluesDir,
      "--baseline",
      nonString.baselinePath,
    ]);
    assert.equal(status, 1, output);
    assert.ok(output.includes("SHAPE"), output);
    assert.ok(output.includes("fixture-non-string.json"), output);
  } finally {
    rmSync(nonString.root, { recursive: true, force: true });
  }
});
