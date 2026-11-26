import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkGameAppFile,
  checkGameAppSize,
  GAME_APP_PATH,
  GAME_APP_SIZE_CEILING,
} from "./check-game-app-size.mjs";

test("ceiling is the measured count after TD-06.9", () => {
  assert.equal(GAME_APP_SIZE_CEILING, 6350);
});

test("the real file is at the ceiling", () => {
  const result = checkGameAppFile(GAME_APP_PATH);
  assert.equal(result.ok, true);
  assert.equal(result.lineCount, 6350);
});

test("a fake file with ceiling + 1 lines fails and says by how much", () => {
  const dir = mkdtempSync(join(tmpdir(), "game-app-size-"));
  try {
    const fake = join(dir, "game-app.tsx");
    writeFileSync(fake, "x\n".repeat(GAME_APP_SIZE_CEILING + 1));
    const result = checkGameAppFile(fake);
    assert.equal(result.ok, false);
    assert.match(result.message, /1 over the .* ceiling/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a ceiling higher than the real count fails instead of passing silently", () => {
  const result = checkGameAppSize(6350, GAME_APP_SIZE_CEILING + 1);
  assert.equal(result.ok, false);
  assert.match(result.message, /higher than the real count/);
});
