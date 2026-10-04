/**
 * ?nosw hatch build-plugin tests (P0 Safari launch fix).
 *
 * Drives the real plugin object (scripts/nosw-hatch-plugin.mjs) against
 * temp out-dirs: configResolved() with a fake Vite config, then the
 * buildApp post handler. GITHUB_PAGES=1 marks the Pages build, where a
 * missing marker must FAIL the build; anything else stays non-fatal.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { noswHatchPlugin } from "./nosw-hatch-plugin.mjs";

const SHELL = "_shell.html";
const MARKER = "meridian-nosw-hatch";

function makeOutDir(withShell) {
  const dir = mkdtempSync(join(tmpdir(), "nosw-plugin-"));
  if (withShell) {
    writeFileSync(
      join(dir, SHELL),
      "<!doctype html><html><head><title>t</title></head><body></body></html>",
    );
  }
  return dir;
}

/** A shell the injector cannot patch (no </head> anchor): marker stays absent. */
function makeUnpatchableOutDir() {
  const dir = mkdtempSync(join(tmpdir(), "nosw-plugin-"));
  writeFileSync(join(dir, SHELL), "<!doctype html><html><body>no head</body></html>");
  return dir;
}

function pluginFor(dir) {
  const plugin = noswHatchPlugin();
  plugin.configResolved({
    environments: { client: { build: { outDir: dir } } },
    build: {},
  });
  return plugin;
}

async function withPagesEnv(value, fn) {
  const prev = process.env.GITHUB_PAGES;
  try {
    if (value === undefined) delete process.env.GITHUB_PAGES;
    else process.env.GITHUB_PAGES = value;
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.GITHUB_PAGES;
    else process.env.GITHUB_PAGES = prev;
  }
}

async function captureWarn(fn) {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    await fn();
  } finally {
    console.warn = orig;
  }
  return warnings;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test("buildApp handler injects the hatch marker into the emitted shell", async () => {
  const dir = makeOutDir(true);
  try {
    const plugin = pluginFor(dir);
    await withPagesEnv(undefined, () => plugin.buildApp.handler());
    const html = readFileSync(join(dir, SHELL), "utf8");
    assert.ok(html.includes(MARKER), "marker present after injection");
    assert.ok(html.indexOf(MARKER) < html.indexOf("</head>"), "marker before </head>");
  } finally {
    cleanup(dir);
  }
});

test("buildApp handler is idempotent: a marked shell passes without rewrite", async () => {
  const dir = makeOutDir(true);
  try {
    const plugin = pluginFor(dir);
    await withPagesEnv("1", () => plugin.buildApp.handler());
    const once = readFileSync(join(dir, SHELL), "utf8");
    await withPagesEnv("1", () => plugin.buildApp.handler());
    const twice = readFileSync(join(dir, SHELL), "utf8");
    assert.equal(twice, once, "second run leaves the shell byte-identical");
    assert.equal(
      (twice.match(/meridian-nosw-hatch/g) || []).length,
      1,
      "exactly one injected hatch script",
    );
  } finally {
    cleanup(dir);
  }
});

test("Pages build FAILS when the shell is emitted but the marker is absent", async () => {
  const dir = makeUnpatchableOutDir();
  try {
    const plugin = pluginFor(dir);
    await assert.rejects(
      () => withPagesEnv("1", () => plugin.buildApp.handler()),
      /meridian:nosw-hatch.*marker absent/,
      "Pages build throws instead of silently shipping without the hatch",
    );
  } finally {
    cleanup(dir);
  }
});

test("Pages build FAILS when no shell is emitted at all", async () => {
  const dir = makeOutDir(false);
  try {
    const plugin = pluginFor(dir);
    await assert.rejects(
      () => withPagesEnv("1", () => plugin.buildApp.handler()),
      /meridian:nosw-hatch.*_shell\.html not found/,
      "Pages build throws instead of silently skipping the hatch",
    );
  } finally {
    cleanup(dir);
  }
});

test("non-Pages build only warns when the shell is missing (no throw)", async () => {
  const dir = makeOutDir(false);
  try {
    const plugin = pluginFor(dir);
    const warnings = await captureWarn(() =>
      withPagesEnv(undefined, () => plugin.buildApp.handler()),
    );
    assert.ok(
      warnings.some((w) => w.includes("meridian:nosw-hatch")),
      `expected a hatch warning, got: ${JSON.stringify(warnings)}`,
    );
  } finally {
    cleanup(dir);
  }
});

test("non-Pages build only warns when the marker is absent (no throw)", async () => {
  const dir = makeUnpatchableOutDir();
  try {
    const plugin = pluginFor(dir);
    // Must not throw — dev/preview/Vercel builds keep the old behavior.
    await withPagesEnv(undefined, () => plugin.buildApp.handler());
    const html = readFileSync(join(dir, SHELL), "utf8");
    assert.ok(!html.includes(MARKER));
  } finally {
    cleanup(dir);
  }
});
