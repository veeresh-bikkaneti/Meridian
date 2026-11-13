#!/usr/bin/env node
/**
 * `npm test` runner. Runs both unit suites even if the first fails, then
 * exits non-zero if either did. Replaces a POSIX-only shell one-liner so it
 * works under cmd.exe too. Node expands the globs itself (Node 21+), so no
 * shell quoting rules apply.
 */
import { spawnSync } from "node:child_process";

const suites = [
  ["--test", "scripts/**/*.test.mjs"],
  ["--experimental-strip-types", "--test", "src/**/*.test.ts"],
];

let failed = false;
for (const args of suites) {
  const r = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
