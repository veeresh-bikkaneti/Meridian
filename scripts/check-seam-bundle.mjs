#!/usr/bin/env node
/**
 * Fail when a test-seam marker survives in the pages entry chunk.
 *
 * Run after `npm run build:pages`:
 *
 *   node scripts/check-seam-bundle.mjs
 *   node scripts/check-seam-bundle.mjs --dir dist/client
 *
 * The entry set is the same static-import closure check-entry-size
 * measures (the scripts and modulepreloads named by `_shell.html`,
 * plus the modules they import). Markers are the shortcut strings
 * from the TD-10.4 inventory. They belong in tests/harness, not in
 * the bytes a player downloads.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseShell, staticClosure } from "./bundle-report.mjs";

export const SEAM_MARKERS = [
  "loop-puzzle",
  "idle-ms",
  "__spotScreen",
  "__boundaryBand",
  "__loopMap",
  "__meridianGpu",
  "__reset",
  "ForTests",
  "movieUrlOverride",
  "transcriptOverride",
  "probeStaleBuild",
  "__project",
];

const BASE = "/Meridian/";

export function seamMarkersIn(source, markers = SEAM_MARKERS) {
  const found = [];
  for (const marker of markers) {
    if (source.includes(marker)) found.push(marker);
  }
  return found;
}

function distPath(href) {
  if (/^[a-z]+:\/\//i.test(href)) return null;
  const rel = href.startsWith(BASE) ? href.slice(BASE.length) : href.replace(/^\//, "");
  return rel.split("?")[0];
}

/** Entry-chunk paths (posix, relative to the pages output). */
export function entryChunkPaths(dir) {
  const html = readFileSync(join(dir, "_shell.html"), "utf8");
  const refs = parseShell(html);
  const roots = [];
  for (const href of [...refs.scripts, ...refs.modulepreloads]) {
    const rel = distPath(href);
    if (rel && /\.m?js$/.test(rel)) roots.push(rel);
  }
  return staticClosure(dir, roots).filter((p) => /\.m?js$/.test(p));
}

/**
 * Scan the entry set. Returns `{ ok, hits }` where hits are
 * `{ file, marker }` pairs.
 */
export function scanEntryForSeamMarkers(dir, markers = SEAM_MARKERS) {
  const hits = [];
  for (const file of entryChunkPaths(dir)) {
    const source = readFileSync(join(dir, file), "utf8");
    for (const marker of seamMarkersIn(source, markers)) {
      hits.push({ file, marker });
    }
  }
  return { ok: hits.length === 0, hits };
}

function main(argv = process.argv.slice(2)) {
  let dir = join(fileURLToPath(new URL("..", import.meta.url)), "dist", "client");
  const dirIdx = argv.indexOf("--dir");
  if (dirIdx !== -1 && argv[dirIdx + 1]) dir = resolve(argv[dirIdx + 1]);
  let result;
  try {
    result = scanEntryForSeamMarkers(dir);
  } catch (err) {
    console.error(`check-seam-bundle: FAIL — ${err instanceof Error ? err.message : err}`);
    return 1;
  }
  if (!result.ok) {
    console.error(`check-seam-bundle: FAIL (${result.hits.length} marker hit(s) in the entry chunk)`);
    for (const hit of result.hits) console.error(`  - ${hit.marker} in ${hit.file}`);
    return 1;
  }
  console.log("check-seam-bundle: PASS — entry chunk has no test-seam markers");
  return 0;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
