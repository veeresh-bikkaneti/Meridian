/**
 * Unit tests for the test-seam ratchet (scripts/check-test-seams.mjs).
 *
 * The fixture cases run the scanner against temp trees with a small
 * fixture baseline, so each ratchet direction is proven on its own:
 * a matching tree passes, an added unlisted seam fails and is named,
 * and a baseline seam that vanishes fails as stale. The last case
 * runs the real baseline against this repo and the CLI itself, so
 * the shipped inventory can never drift from the shipped code
 * without this suite going red.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { scanTestSeams } from "./check-test-seams.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-test-seams.mjs");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE_BASELINE = [
  {
    id: "reset-thing-for-tests",
    sites: [{ file: "src/a.ts", pattern: /resetThingForTests/ }],
    covers: [{ file: "src/a.ts", pattern: /resetThingForTests/ }],
  },
];

function fixtureTree(files) {
  const root = mkdtempSync(join(tmpdir(), "check-test-seams-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const MATCHING_A = `/** Test-only: reset the thing between tests. */
export function resetThingForTests(): void {}
`;

test("a fixture tree matching the baseline passes", () => {
  const root = fixtureTree({ "src/a.ts": MATCHING_A });
  assert.deepEqual(scanTestSeams(root, FIXTURE_BASELINE, []), []);
});

test("an added unlisted seam fails and names it", () => {
  const root = fixtureTree({
    "src/a.ts": MATCHING_A,
    "src/b.ts": `export function sneakyForTests(): void {}\n`,
  });
  const problems = scanTestSeams(root, FIXTURE_BASELINE, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /UNLISTED seam/);
  assert.match(problems[0], /sneakyForTests/);
  assert.match(problems[0], /src\/b\.ts:1/);
});

test("a baseline seam that vanishes fails as stale", () => {
  const root = fixtureTree({ "src/a.ts": `export function thing(): void {}\n` });
  const problems = scanTestSeams(root, FIXTURE_BASELINE, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /STALE baseline seam "reset-thing-for-tests"/);
});

test("the real repo tree passes the real baseline", () => {
  assert.deepEqual(scanTestSeams(REPO_ROOT), []);
});

test("the CLI exits 0 on the real repo tree", () => {
  const out = execFileSync(process.execPath, [SCRIPT, "--root", REPO_ROOT], {
    encoding: "utf8",
  });
  assert.match(out, /check-test-seams: PASS/);
});
