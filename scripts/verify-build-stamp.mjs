#!/usr/bin/env node
/**
 * Verify that a built output tree carries ONE consistent build stamp
 * (WI-7a, 2026-10-21).
 *
 * For each output dir given (default: the ones that exist of
 * `dist/client` and `.vercel/output/static`):
 *   1. `build-meta.json` exists and its `buildId` is a non-empty string.
 *   2. `sw.js` exists and its VERSION is `meridian-<buildId>` — the
 *      served meta and the service worker must name the same build.
 *   3. When run inside a git checkout, the buildId is either the
 *      `local-<timestamp>` fallback or a prefix of the HEAD commit sha
 *      (7 chars from `git rev-parse --short`, 12 from GITHUB_SHA) —
 *      i.e. it really is the deployed commit's short SHA.
 *
 * This is the proof that the stamping step ran for the build that
 * produced the tree — run it after a DIRECT `npx vite build` (no npm
 * lifecycle hooks) to prove the Workers path stamps without prebuild:
 *
 *   rm -f public/build-meta.json
 *   npx vite build
 *   node scripts/verify-build-stamp.mjs
 *
 * Usage: node scripts/verify-build-stamp.mjs [dir ...]
 * Exit 0 = every checked dir is consistently stamped.
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIRS = ["dist/client", ".vercel/output/static"];

export function checkStampedDir(dir, headSha) {
  const problems = [];
  let buildId = null;

  const metaPath = join(dir, "build-meta.json");
  if (!existsSync(metaPath)) {
    problems.push(`${dir}: build-meta.json missing`);
  } else {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      if (typeof meta.buildId === "string" && meta.buildId.length > 0) {
        buildId = meta.buildId;
      } else {
        problems.push(`${dir}: build-meta.json has no non-empty buildId`);
      }
    } catch {
      problems.push(`${dir}: build-meta.json is not valid JSON`);
    }
  }

  const swPath = join(dir, "sw.js");
  if (!existsSync(swPath)) {
    problems.push(`${dir}: sw.js missing`);
  } else if (buildId) {
    const sw = readFileSync(swPath, "utf8");
    const m = /const VERSION = "meridian-([^"]+)"/.exec(sw);
    if (!m) {
      problems.push(`${dir}: sw.js has no stamped VERSION`);
    } else if (m[1] !== buildId) {
      problems.push(
        `${dir}: sw.js VERSION build id "${m[1]}" != build-meta buildId "${buildId}"`,
      );
    }
  }

  if (buildId && headSha && !buildId.startsWith("local-")) {
    if (!headSha.startsWith(buildId)) {
      problems.push(
        `${dir}: buildId "${buildId}" is not a prefix of HEAD ${headSha}`,
      );
    }
  }

  return { dir, buildId, problems };
}

function headSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const requested = process.argv.slice(2);
  const dirs = (
    requested.length > 0
      ? requested
      : DEFAULT_DIRS.filter((d) => existsSync(d))
  );
  if (dirs.length === 0) {
    console.error(
      "verify-build-stamp: no output dirs found (looked for " +
        DEFAULT_DIRS.join(", ") +
        ") — run a build first.",
    );
    process.exit(1);
  }
  const sha = headSha();
  let failed = false;
  for (const dir of dirs) {
    const { buildId, problems } = checkStampedDir(dir, sha);
    if (problems.length > 0) {
      failed = true;
      for (const p of problems) console.error(`FAIL ${p}`);
    } else {
      console.log(`PASS ${dir}: buildId=${buildId} (meta == sw.js VERSION)`);
    }
  }
  process.exit(failed ? 1 : 0);
}
