#!/usr/bin/env node
/**
 * TD-14.3 — Playwright spec-registration guard (issue #375).
 *
 * A full-suite run only executes specs that match a project in
 * playwright.config.ts. A file under tests/e2e that matches none is
 * skipped, and the run still reports green. This script reads the
 * live config's projects and the live tests/e2e tree and fails when:
 *
 *   - a *.spec.ts matches no project and is not on the exception
 *     list, or
 *   - an exception-list entry is no longer in the tree (stale).
 *
 * Deliberate exceptions (still true on this tip):
 *   - qa-evidence.spec.ts — run from a temp config, not a project
 *   - mode-screens-shots.spec.ts — env-gated (MODE_SHOTS=1)
 *
 * Usage:
 *   node scripts/check-e2e-registration.mjs [--root <dir>]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Module, createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(fileURLToPath(import.meta.url));
const ts = require("typescript");

/** Paths relative to tests/e2e. Shrink or grow only on purpose. */
export const DELIBERATE_EXCEPTIONS = [
  "qa-evidence.spec.ts",
  "mode-screens-shots.spec.ts",
];

function toPosix(rel) {
  return rel.split("\\").join("/");
}

function listSpecRels(specDir) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".spec.ts")) out.push(toPosix(relative(specDir, full)));
    }
  };
  walk(specDir);
  out.sort();
  return out;
}

function patternList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function patternHits(filePath, value) {
  for (const pattern of patternList(value)) {
    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      if (pattern.test(filePath)) return true;
      continue;
    }
    if (typeof pattern === "string") {
      const body = pattern.startsWith("**/") ? pattern.slice(3) : pattern;
      const escaped = body.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      const re = new RegExp(escaped);
      if (re.test(filePath)) return true;
    }
  }
  return false;
}

function projectMatches(filePath, project) {
  const matched = project.testMatch == null ? true : patternHits(filePath, project.testMatch);
  if (!matched) return false;
  if (project.testIgnore != null && patternHits(filePath, project.testIgnore)) return false;
  return true;
}

function loadConfig(configPath) {
  const source = readFileSync(configPath, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const root = dirname(configPath);
  const compiled = new Module(configPath);
  compiled.filename = configPath;
  compiled.paths = Module._nodeModulePaths(root);
  compiled._compile(js, configPath);
  const exported = compiled.exports.default ?? compiled.exports;
  if (!exported || !Array.isArray(exported.projects)) {
    throw new Error(`playwright config at ${configPath} has no projects array`);
  }
  return exported;
}

/**
 * @param {string} root repo root (holds playwright.config.ts and tests/e2e)
 * @param {{ exceptions?: string[] }} [options]
 * @returns {{ problems: string[], census: { total: number, matched: number, excepted: number, unmatched: string[] } }}
 */
export function checkE2eRegistration(root, options = {}) {
  const exceptions = (options.exceptions ?? DELIBERATE_EXCEPTIONS).map(toPosix);
  const specDir = join(root, "tests", "e2e");
  const config = loadConfig(join(root, "playwright.config.ts"));
  const specs = listSpecRels(specDir);
  const problems = [];
  const unmatched = [];
  let matched = 0;
  let excepted = 0;
  for (const rel of specs) {
    const abs = join(specDir, rel);
    const hit = config.projects.some((project) => projectMatches(abs, project));
    if (hit) {
      matched += 1;
      continue;
    }
    if (exceptions.includes(rel)) {
      excepted += 1;
      continue;
    }
    unmatched.push(rel);
    problems.push(`UNREGISTERED tests/e2e/${rel} matches no Playwright project`);
  }
  for (const rel of exceptions) {
    if (!specs.includes(rel)) {
      problems.push(`STALE exception tests/e2e/${rel} is not in the spec tree`);
    }
  }
  return {
    problems,
    census: { total: specs.length, matched, excepted, unmatched },
  };
}

export function main(argv = process.argv.slice(2)) {
  let root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const rootIdx = argv.indexOf("--root");
  if (rootIdx !== -1 && argv[rootIdx + 1]) root = argv[rootIdx + 1];
  const { problems, census } = checkE2eRegistration(root);
  const summary = `${census.matched} matched, ${census.excepted} excepted, ${census.total} total`;
  if (problems.length > 0) {
    console.error(`check-e2e-registration: FAIL (${problems.length} problem(s); ${summary})`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }
  console.log(`check-e2e-registration: PASS — ${summary}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
