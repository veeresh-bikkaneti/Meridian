/**
 * TD-14.3 — Playwright spec-registration guard.
 *
 * A spec under tests/e2e that matches no project is skipped by a
 * full-suite run and the run still looks green. These tests pin the
 * guard: a fixture tree that is fully registered passes, a planted
 * unregistered spec fails by filename, a vanished exception fails as
 * stale, and the live repo tree is checked against the live config.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkE2eRegistration, DELIBERATE_EXCEPTIONS } from "./check-e2e-registration.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-e2e-registration.mjs");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE_CONFIG = `export default {
  testDir: "./tests/e2e",
  projects: [{ name: "desktop", testMatch: /desktop\\.spec\\.ts/ }],
};
`;

function fixtureTree(files) {
  const root = mkdtempSync(join(tmpdir(), "e2e-registration-"));
  const all = { "playwright.config.ts": FIXTURE_CONFIG, ...files };
  for (const [rel, content] of Object.entries(all)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("a fixture tree with only registered specs and live exceptions passes", () => {
  const root = fixtureTree({
    "tests/e2e/ok.desktop.spec.ts": "test('ok', () => {});\n",
    "tests/e2e/qa-evidence.spec.ts": "test('qa', () => {});\n",
    "tests/e2e/mode-screens-shots.spec.ts": "test('shots', () => {});\n",
  });
  const result = checkE2eRegistration(root);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.census, {
    total: 3,
    matched: 1,
    excepted: 2,
    unmatched: [],
  });
});

test("a planted unregistered spec fails by filename", () => {
  const root = fixtureTree({
    "tests/e2e/ok.desktop.spec.ts": "test('ok', () => {});\n",
    "tests/e2e/qa-evidence.spec.ts": "test('qa', () => {});\n",
    "tests/e2e/mode-screens-shots.spec.ts": "test('shots', () => {});\n",
    "tests/e2e/planted-unregistered.spec.ts": "test('planted', () => {});\n",
  });
  const result = checkE2eRegistration(root);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /UNREGISTERED/);
  assert.match(result.problems[0], /planted-unregistered\.spec\.ts/);
  assert.deepEqual(result.census.unmatched, ["planted-unregistered.spec.ts"]);
});

test("a listed exception that is missing from the tree fails as stale", () => {
  const root = fixtureTree({
    "tests/e2e/ok.desktop.spec.ts": "test('ok', () => {});\n",
    "tests/e2e/mode-screens-shots.spec.ts": "test('shots', () => {});\n",
  });
  const result = checkE2eRegistration(root);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /STALE exception/);
  assert.match(result.problems[0], /qa-evidence\.spec\.ts/);
});

test("the deliberate exception list is the two known cases", () => {
  assert.deepEqual(DELIBERATE_EXCEPTIONS, [
    "qa-evidence.spec.ts",
    "mode-screens-shots.spec.ts",
  ]);
});

test("the current repo tree passes the live config", () => {
  const result = checkE2eRegistration(REPO_ROOT);
  assert.deepEqual(
    result.problems,
    [],
    `census ${JSON.stringify(result.census)} problems ${JSON.stringify(result.problems)}`,
  );
});

test("the CLI exits 0 on a fully registered fixture", () => {
  const root = fixtureTree({
    "tests/e2e/ok.desktop.spec.ts": "test('ok', () => {});\n",
    "tests/e2e/qa-evidence.spec.ts": "test('qa', () => {});\n",
    "tests/e2e/mode-screens-shots.spec.ts": "test('shots', () => {});\n",
  });
  const out = execFileSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  assert.match(out, /check-e2e-registration: PASS/);
});
