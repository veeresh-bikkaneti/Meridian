import assert from "node:assert/strict";
import test from "node:test";

// Minimal localStorage shim (node has none), mirroring badges.test.ts.
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => {
    backing.set(k, v);
  },
  removeItem: (k: string) => {
    backing.delete(k);
  },
  clear: () => backing.clear(),
};

import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { EarnedBadgeRow } = (await import("./EarnedBadgeRow.tsx")) as typeof import("./EarnedBadgeRow.tsx");
const {
  awardPassportBadge,
  CLEAN_ROUND_BADGE_ID,
  __resetPassportBadgeMemory,
} = await import("@/game/passport/badges.ts");

function clearStorage() {
  backing.clear();
  __resetPassportBadgeMemory();
}

function render() {
  return renderToString(createElement(EarnedBadgeRow));
}

test("renders nothing when no badges earned", () => {
  clearStorage();
  assert.equal(render(), "", "empty row, not an empty container");
});

test("renders the earned badge chip with name", () => {
  clearStorage();
  awardPassportBadge(CLEAN_ROUND_BADGE_ID);
  const html = render();
  assert.ok(html.includes('data-testid="earned-badges"'), "badge row present");
  assert.ok(html.includes("Clean Round"), "badge name shown");
  assert.ok(
    html.includes("A whole round without a single hint"),
    "blurb present as title",
  );
});

test("chip is band-invisible: no ages, no easy/hard language", () => {
  clearStorage();
  awardPassportBadge(CLEAN_ROUND_BADGE_ID);
  const html = render();
  assert.ok(!/11-13|8-10|5-7/.test(html), "no age numbers");
  assert.ok(!/easy|hard/i.test(html), "no easy/hard language");
});
