import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "LoopScreen.tsx"), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("LoopScreen routes network and the stale-refresh stamp through the ports", () => {
  assert.equal(code.includes("fetch("), false);
  assert.equal(code.includes("sessionStorage"), false);
  assert.equal(code.includes("localStorage"), false);
  assert.ok(code.includes("getRaw("));
  assert.ok(code.includes("writeSessionItem(STORAGE_KEYS.staleRefresh"));
});
