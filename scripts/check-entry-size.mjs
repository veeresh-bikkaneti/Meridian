#!/usr/bin/env node
/**
 * check-entry-size.mjs — fail CI when the first-load JS grows past its budget.
 *
 * Run after `npm run build:pages`:
 *
 *   node scripts/check-entry-size.mjs                 # uses dist/client
 *   node scripts/check-entry-size.mjs --dir <path>
 *
 * Reads the entry JS total that `bundle-report.mjs --json` reports (gzip,
 * zlib level 9, the same figure the Phase 0 spec recorded) and exits 1 when
 * it is above ENTRY_JS_GZIP_LIMIT.
 *
 * The limit is the Phase 0 starting measurement (owner approved 2026-11-10).
 * Subjects load as lazy chunks, so the entry set should not grow. Raise the
 * number only on purpose, in its own reviewed change.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENTRY_JS_GZIP_LIMIT = 323_865;

/** Pure check, exported for the unit test. */
export function checkEntrySize(entryJsGzip, limit = ENTRY_JS_GZIP_LIMIT) {
  if (!Number.isFinite(entryJsGzip) || entryJsGzip <= 0) {
    return { ok: false, message: `entry JS gzip size is missing or invalid (${entryJsGzip})` };
  }
  const head = limit - entryJsGzip;
  if (head < 0) {
    return {
      ok: false,
      message: `entry JS gzip ${entryJsGzip.toLocaleString("en-US")} B is ${(-head).toLocaleString("en-US")} B over the ${limit.toLocaleString("en-US")} B limit`,
    };
  }
  return {
    ok: true,
    message: `entry JS gzip ${entryJsGzip.toLocaleString("en-US")} B, limit ${limit.toLocaleString("en-US")} B (${head.toLocaleString("en-US")} B to spare)`,
  };
}

function main(argv) {
  const report = fileURLToPath(new URL("./bundle-report.mjs", import.meta.url));
  const out = execFileSync(process.execPath, [report, "--json", ...argv], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const gzip = JSON.parse(out)?.shell?.entryJsTotal?.gzip;
  const result = checkEntrySize(gzip);
  (result.ok ? console.log : console.error)(`check-entry-size: ${result.message}`);
  process.exit(result.ok ? 0 : 1);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
