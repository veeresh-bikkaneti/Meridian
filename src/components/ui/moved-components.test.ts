import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// age-profile/read-aloud-button.test.ts. Components are imported
// dynamically AFTER register() so the hook is in place.
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const { DropPinButton } = (await import("./drop-pin-button.tsx")) as typeof import("./drop-pin-button.tsx");
const { ZoomControls } = (await import("./zoom-controls.tsx")) as typeof import("./zoom-controls.tsx");
// Non-literal specifiers: tsc must not resolve these, the shim files are deleted.
const SHIM_FLAG_IMG = "../flag-img.tsx";
const SHIM_DETECTIVE_PAIR = "../../game/loop/detective/DetectivePair.tsx";

const { FlagImg } = (await import("./flag-img.tsx")) as typeof import("./flag-img.tsx");
const pair = (await import("./DetectivePair.tsx")) as typeof import("./DetectivePair.tsx");


describe("components moved to ui keep working", () => {
  it("DropPinButton renders disabled with no aim, as satellite-map passes it", () => {
    const html = renderToStaticMarkup(createElement(DropPinButton, { aim: null, onDrop: () => {} }));
    assert.match(html, /disabled/);
  });
  it("ZoomControls renders with its zoom announcement region", () => {
    const html = renderToStaticMarkup(
      createElement(ZoomControls, { zoom: 3, onZoomIn: () => {}, onZoomOut: () => {} }),
    );
    assert.match(html, /zoom/i);
  });
  it("the deleted flag-img and DetectivePair shims no longer resolve", async () => {
    await assert.rejects(import(SHIM_FLAG_IMG));
    await assert.rejects(import(SHIM_DETECTIVE_PAIR));
  });
  it("the canonical flag-img and DetectivePair modules still export their API", () => {
    assert.equal(typeof FlagImg, "function");
    assert.equal(typeof pair.HolmesRig, "function");
    assert.equal(typeof pair.WatsonRig, "function");
  });
});
