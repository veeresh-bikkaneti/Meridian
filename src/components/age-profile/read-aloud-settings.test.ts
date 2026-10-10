import assert from "node:assert/strict";
import test from "node:test";

// Minimal localStorage shim (node has none).
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

const { ReadAloudPrefSettings } = (await import(
  "./ReadAloudPrefSettings.tsx"
)) as typeof import("./ReadAloudPrefSettings.tsx");
const { setReadAloudPref, __resetReadAloudPrefMemory } = await import(
  "@/game/age-profile/read-aloud-pref.ts"
);

function clearStorage() {
  backing.clear();
  __resetReadAloudPrefMemory();
}

function render() {
  return renderToString(createElement(ReadAloudPrefSettings));
}

test("renders nothing while the preference is unset (onboarding owns first choice)", () => {
  clearStorage();
  assert.equal(render(), "", "no settings UI before the first choice");
});

test("toggle shows the current choice once set", () => {
  clearStorage();
  setReadAloudPref("sometimes");
  const html = render();
  assert.ok(html.includes('data-testid="readaloud-settings-toggle"'), "toggle present");
  assert.ok(html.includes("Sometimes"), "current choice shown");
  assert.ok(html.includes("44px") === false, "no inline size hacks");
});

test("toggle is a real button with an accessible name, not parent-gated", () => {
  clearStorage();
  setReadAloudPref("always");
  const html = render();
  assert.ok(html.includes("<button"), "tappable button");
  assert.ok(
    html.includes("Change read-aloud setting"),
    "accessible name describes the action",
  );
  assert.ok(!/grown-?up/i.test(html), "no grown-up gating language");
});

test("options list is collapsed by default (no layout shift on home)", () => {
  clearStorage();
  setReadAloudPref("never");
  const html = render();
  assert.ok(!html.includes("readaloud-option-always"), "options hidden until opened");
});
