#!/usr/bin/env node
/**
 * build-globe-tiers.mjs — (re)generate src/game/data/geonames/tiers/globe-t<N>.json
 * from the canonical chunks/globe.json. See globe-tiers.mjs for the why.
 *
 *   node scripts/build-globe-tiers.mjs           # write the tier files
 *   node scripts/build-globe-tiers.mjs --check   # exit 1 if they are stale/missing
 *
 * Output is byte-for-byte deterministic (same input → same files), so `--check`
 * is a plain string comparison. Also exported for check-generated-places.mjs.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOBE_TIERS, serializeTiers, tierFileName } from "./globe-tiers.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GEONAMES = join(REPO, "src", "game", "data", "geonames");
export const GLOBE_CHUNK_PATH = join(GEONAMES, "chunks", "globe.json");
export const TIERS_DIR = join(GEONAMES, "tiers");

/** Problems with the on-disk tier files vs the canonical chunk ([] = in sync). */
export function checkGlobeTiers(chunkPath = GLOBE_CHUNK_PATH, tiersDir = TIERS_DIR) {
  const problems = [];
  const expected = serializeTiers(JSON.parse(readFileSync(chunkPath, "utf8")));
  for (const t of GLOBE_TIERS) {
    const file = join(tiersDir, tierFileName(t));
    if (!existsSync(file)) problems.push(`${tierFileName(t)}: missing`);
    else if (readFileSync(file, "utf8") !== expected[t]) {
      problems.push(`${tierFileName(t)}: differs from chunks/globe.json (run node scripts/build-globe-tiers.mjs)`);
    }
  }
  if (existsSync(tiersDir)) {
    const known = new Set(GLOBE_TIERS.map(tierFileName));
    for (const f of readdirSync(tiersDir)) if (!known.has(f)) problems.push(`${f}: unexpected file in tiers/`);
  }
  return problems;
}

/** Write the tier files for a canonical chunk. Returns { tier: count }. */
export function writeGlobeTiers(chunkPath = GLOBE_CHUNK_PATH, tiersDir = TIERS_DIR) {
  const serialized = serializeTiers(JSON.parse(readFileSync(chunkPath, "utf8")));
  mkdirSync(tiersDir, { recursive: true });
  const counts = {};
  for (const t of GLOBE_TIERS) {
    writeFileSync(join(tiersDir, tierFileName(t)), serialized[t]);
    counts[t] = JSON.parse(serialized[t]).meta.count;
  }
  return counts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const problems = checkGlobeTiers();
    if (problems.length) {
      console.error(`globe tiers stale:\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log("globe tiers in sync with chunks/globe.json");
  } else {
    const counts = writeGlobeTiers();
    console.log(
      `wrote ${GLOBE_TIERS.length} globe tier files to ${dirname(join(TIERS_DIR, "x"))}: ` +
        GLOBE_TIERS.map((t) => `t${t}=${counts[t]}`).join(" "),
    );
  }
}
