#!/usr/bin/env node
/**
 * check-game-app-size.mjs — fail CI when game-app.tsx grows past its budget.
 *
 * Run directly:
 *
 *   node scripts/check-game-app-size.mjs
 *
 * Counts the lines of src/components/game-app.tsx (wc -l) and exits 1 when
 * the count is above GAME_APP_SIZE_CEILING, or when the ceiling is higher
 * than the count (a raised ceiling must be lowered to the real count, in
 * its own reviewed change — no silent raising).
 *
 * The ceiling is the measured count on main 7dbf62eb (TD-06.2, PR 2 of the
 * game-app map). Later Phase 4 module PRs may only lower it. Do not extract
 * a module in this change; do not edit game-app.tsx.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GAME_APP_SIZE_CEILING = 8787;
export const GAME_APP_PATH = fileURLToPath(
  new URL("../src/components/game-app.tsx", import.meta.url),
);

/** Line count of a file, wc -l semantics (newline characters). */
export function countLines(filePath) {
  return readFileSync(filePath, "utf8").split("\n").length - 1;
}

/** Pure check, exported for the unit test. */
export function checkGameAppSize(lineCount, ceiling = GAME_APP_SIZE_CEILING) {
  if (!Number.isFinite(lineCount) || lineCount < 0) {
    return {
      ok: false,
      message: `game-app.tsx line count is missing or invalid (${lineCount})`,
    };
  }
  if (lineCount > ceiling) {
    return {
      ok: false,
      message: `game-app.tsx has ${lineCount.toLocaleString("en-US")} lines, ${(lineCount - ceiling).toLocaleString("en-US")} over the ${ceiling.toLocaleString("en-US")} ceiling — shrink it, do not raise the ceiling`,
    };
  }
  if (ceiling > lineCount) {
    return {
      ok: false,
      message: `ceiling ${ceiling.toLocaleString("en-US")} is higher than the real count ${lineCount.toLocaleString("en-US")} — lower the ceiling to the real count (no silent raising)`,
    };
  }
  return {
    ok: true,
    message: `game-app.tsx has ${lineCount.toLocaleString("en-US")} lines, at the ${ceiling.toLocaleString("en-US")} ceiling`,
  };
}

/** Read a file and check it against the ceiling. */
export function checkGameAppFile(
  filePath = GAME_APP_PATH,
  ceiling = GAME_APP_SIZE_CEILING,
) {
  const lineCount = countLines(filePath);
  return { ...checkGameAppSize(lineCount, ceiling), lineCount };
}

function main() {
  const result = checkGameAppFile();
  (result.ok ? console.log : console.error)(
    `check-game-app-size: ${result.message}`,
  );
  process.exit(result.ok ? 0 : 1);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();
