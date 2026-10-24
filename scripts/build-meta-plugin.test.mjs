import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_META_FILE,
  buildMetaPlugin,
  writeBuildMetaToDir,
} from "./build-meta-plugin.mjs";
import { checkStampedDir } from "./verify-build-stamp.mjs";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "build-meta-plugin-"));
}

test("writeBuildMetaToDir writes parseable JSON with the given id", () => {
  const dir = tempDir();
  try {
    const nested = join(dir, "client");
    const id = writeBuildMetaToDir(nested, "abc1234");
    assert.equal(id, "abc1234");
    const meta = JSON.parse(
      readFileSync(join(nested, BUILD_META_FILE), "utf8"),
    );
    assert.deepEqual(meta, { buildId: "abc1234" });
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("buildMetaPlugin writeBundle stamps the output dir with the pinned id", () => {
  const dir = tempDir();
  try {
    // A client static output always carries sw.js; server dirs don't,
    // and the plugin uses that as the stamp signal.
    writeFileSync(join(dir, "sw.js"), "// client output marker\n");
    const plugin = buildMetaPlugin("deadbee");
    plugin.writeBundle({ dir });
    const meta = JSON.parse(readFileSync(join(dir, BUILD_META_FILE), "utf8"));
    assert.equal(meta.buildId, "deadbee");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("buildMetaPlugin without a pinned id still stamps a non-empty id", () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, "sw.js"), "// client output marker\n");
    const plugin = buildMetaPlugin();
    plugin.writeBundle({ dir });
    const meta = JSON.parse(readFileSync(join(dir, BUILD_META_FILE), "utf8"));
    assert.ok(typeof meta.buildId === "string" && meta.buildId.length > 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("buildMetaPlugin writeBundle skips dirs without sw.js (server outputs)", () => {
  const dir = tempDir();
  try {
    const plugin = buildMetaPlugin("deadbee");
    plugin.writeBundle({ dir });
    assert.equal(existsSync(join(dir, BUILD_META_FILE)), false);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("checkStampedDir passes when meta and sw.js name the same build", () => {
  const dir = tempDir();
  try {
    writeBuildMetaToDir(dir, "abc1234");
    writeFileSync(
      join(dir, "sw.js"),
      'const VERSION = "meridian-abc1234";\n',
    );
    const { buildId, problems } = checkStampedDir(dir, null);
    assert.equal(buildId, "abc1234");
    assert.deepEqual(problems, []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("checkStampedDir fails on a meta/sw mismatch and on a missing meta", () => {
  const dir = tempDir();
  try {
    writeBuildMetaToDir(dir, "abc1234");
    writeFileSync(
      join(dir, "sw.js"),
      'const VERSION = "meridian-fffffff";\n',
    );
    assert.ok(checkStampedDir(dir, null).problems.length > 0);
    rmSync(join(dir, BUILD_META_FILE));
    assert.ok(
      checkStampedDir(dir, null).problems.some((p) =>
        p.includes("build-meta.json missing"),
      ),
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("checkStampedDir rejects a buildId that is not the HEAD commit", () => {
  const dir = tempDir();
  try {
    writeBuildMetaToDir(dir, "abc1234");
    writeFileSync(
      join(dir, "sw.js"),
      'const VERSION = "meridian-abc1234";\n',
    );
    const head = "0123456789abcdef0123456789abcdef01234567";
    assert.ok(checkStampedDir(dir, head).problems.length > 0);
    // A 7- or 12-char prefix of HEAD passes.
    assert.deepEqual(checkStampedDir(dir, "abc1234" + "5".repeat(33)).problems, []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("vite.config wires ONE shared BUILD_ID into both stamping plugins", () => {
  const config = readFileSync(
    new URL("../vite.config.ts", import.meta.url),
    "utf8",
  );
  assert.ok(config.includes("const BUILD_ID = buildIdForBundle();"));
  assert.ok(config.includes("fingerprintSwPlugin(BUILD_ID)"));
  assert.ok(config.includes("buildMetaPlugin(BUILD_ID)"));
  assert.ok(
    config.includes("__MERIDIAN_BUILD_ID__: JSON.stringify(BUILD_ID)"),
  );
});

test("the build-meta plugin guards its .vercel safety net with create:false", () => {
  // closeBundle stamps .vercel/output/static ONLY when that tree
  // already exists — a Pages build must not grow a fake .vercel dir.
  const src = readFileSync(
    new URL("./build-meta-plugin.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(src.includes('stampDir(join(root, ".vercel", "output", "static"), {'));
  assert.ok(src.includes("create: false"));
  assert.ok(src.includes("if (!create && !existsSync(dir)) return false;"));
});
