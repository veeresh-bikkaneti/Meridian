import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "board.tsx"), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the board page routes saved preferences through the storage port", () => {
  assert.equal(code.includes("localStorage"), false);
  assert.equal(code.includes("sessionStorage"), false);
  assert.ok(code.includes("getStorageItem(STORAGE_KEYS.boardCalm)"));
  assert.ok(code.includes("setStorageItem(STORAGE_KEYS.boardCalm"));
  assert.ok(code.includes("getStorageItem(STORAGE_KEYS.boardTheme)"));
  assert.ok(code.includes("setStorageItem(STORAGE_KEYS.boardTheme"));
  assert.ok(code.includes("readSeenClosed(seenStorage)"));
  assert.ok(code.includes("writeSeenClosed(seenStorage"));
});
