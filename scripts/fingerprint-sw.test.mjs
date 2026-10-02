import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLACEHOLDER, fingerprintSw } from "./fingerprint-sw.mjs";

function tempSw(content) {
  const dir = mkdtempSync(join(tmpdir(), "fingerprint-sw-"));
  const file = join(dir, "sw.js");
  writeFileSync(file, content);
  return { dir, file };
}

test("fingerprintSw replaces the placeholder with the build id", () => {
  const { dir, file } = tempSw(`const VERSION = "meridian-${PLACEHOLDER}";\n`);
  try {
    const id = fingerprintSw(file, "abc123def456");
    assert.equal(id, "abc123def456");
    const out = readFileSync(file, "utf8");
    assert.ok(out.includes('const VERSION = "meridian-abc123def456"'));
    assert.ok(!out.includes(PLACEHOLDER));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("fingerprintSw replaces every occurrence", () => {
  const { dir, file } = tempSw(`${PLACEHOLDER} and ${PLACEHOLDER}`);
  try {
    fingerprintSw(file, "x1");
    assert.equal(readFileSync(file, "utf8"), "x1 and x1");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("fingerprintSw throws when the placeholder is absent", () => {
  const { dir, file } = tempSw(`const VERSION = "meridian-v1";\n`);
  try {
    assert.throws(() => fingerprintSw(file, "x1"), /placeholder/);
    // The file is left untouched.
    assert.ok(readFileSync(file, "utf8").includes("meridian-v1"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("the committed public/sw.js still carries the placeholder", () => {
  const src = readFileSync(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  assert.ok(
    src.includes(PLACEHOLDER),
    "public/sw.js must keep the __BUILD_ID__ placeholder for postbuild:pages",
  );
});
