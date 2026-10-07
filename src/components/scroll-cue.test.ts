import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Minimal .tsx load hook (node's --experimental-strip-types does not
// handle .tsx; same approach as result-card.test.ts, trimmed to the
// .tsx transpile only — scroll-cue.tsx imports nothing but react).
const HOOKS_SOURCE = [
  "import { pathToFileURL } from 'node:url';",
  "import { resolve as resolvePath } from 'node:path';",
  "const TS_URL = " +
    JSON.stringify(
      pathToFileURL(resolvePath(REPO_ROOT, "node_modules/typescript/lib/typescript.js")).href,
    ) +
    ";",
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

const { ScrollCue, useMoreBelow } = await import("./scroll-cue.tsx");

// Cartographer's Plate PR3 — the "more below" cue (spec §5/§8.1).
// No DOM infra in this repo; renderToString covers the component contract.
// The hook's scroll/resize measurement is proven in the Playwright E2E
// (tests/e2e/longname-scroll-a11y.desktop.spec.ts).
describe("scroll-cue — ScrollCue component contract", () => {
  it("exports the hook and the component", () => {
    assert.equal(typeof useMoreBelow, "function");
    assert.equal(typeof ScrollCue, "function");
  });

  it("renders nothing when the content fits (hidden when content fits, §8.1)", () => {
    const html = renderToString(createElement(ScrollCue, { visible: false }));
    assert.equal(html, "", "no cue markup at all when there is nothing more below");
  });

  it("renders the fade + ⋯ + 'more below' cue, aria-hidden, when visible", () => {
    const html = renderToString(createElement(ScrollCue, { visible: true }));
    assert.ok(html.includes('aria-hidden="true"'), "the cue is decorative: aria-hidden");
    assert.ok(html.includes("⋯"), "the cue carries the brass ⋯");
    assert.ok(html.includes("more below"), "the cue carries the “more below” text");
    assert.ok(
      html.includes('class="scroll-cue"'),
      "the cue uses the .scroll-cue class (pointer-events: none in CSS)",
    );
    assert.ok(
      !html.includes("tabindex") && !html.includes("tabIndex"),
      "the cue is never a tab stop",
    );
  });
});
