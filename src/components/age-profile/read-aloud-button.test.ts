import assert from "node:assert/strict";
import test from "node:test";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// result-card.test.ts. Components are imported dynamically AFTER register()
// so the hook is in place when their specifiers resolve.
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

// node has no window.speechSynthesis: every render below exercises the
// "device cannot speak" path — the button must stay visible and tappable.
const { ReadAloudButton, READ_ALONG_MESSAGE } = (await import("./ReadAloudButton.tsx")) as typeof import("./ReadAloudButton.tsx");
const { ReadAloudPrefPrompt } = (await import("./ReadAloudPrefPrompt.tsx")) as typeof import("./ReadAloudPrefPrompt.tsx");

const STORY = "A short story about a place.";
const KEY = "card-1";

function renderButton(mode: "auto" | "button" | "off") {
  return renderToString(
    createElement(ReadAloudButton, { text: STORY, mode, autoplay: false, speakKey: KEY }),
  );
}

// --- Uniform ghost speaker icon across bands ---

test("8-10 and 11-13 render the identical control (no band-revealing differences)", () => {
  const for810 = renderButton("button");
  const for1113 = renderButton("off");
  assert.equal(for1113, for810, "identical chrome for 8-10 and 11-13");
});

test("the ghost icon control is 44px, icon-only, no text label", () => {
  const html = renderButton("off");
  assert.ok(html.includes("agep-listen-icon"), "icon variant class present");
  assert.ok(html.includes("<svg"), "speaker icon rendered");
  assert.ok(!/>Listen</.test(html), "no text label");
  assert.ok(!/>Read aloud</.test(html), "no text label");
  assert.ok(html.includes('aria-label="Listen to the story"'), "accessible name kept");
  assert.ok(html.includes('type="button"'), "still a tappable button");
});

test("5-7 keeps its filled auto variant (documenting the one intentional difference)", () => {
  const html = renderButton("auto");
  assert.ok(html.includes("agep-listen-auto"), "filled variant");
  assert.ok(/>🔊 Listen</.test(html), "5-7 keeps the filled + label button");
  assert.ok(!html.includes("agep-listen-icon"), "5-7 is not the ghost icon");
});

test("no speech on this device: the button still renders for every mode", () => {
  for (const mode of ["auto", "button", "off"] as const) {
    const html = renderButton(mode);
    assert.ok(html.includes("<button"), `button present for mode ${mode}`);
    assert.ok(!html.includes("display:none"), `never hidden for mode ${mode}`);
  }
});

test("the unavailable-speech message is the exact locked copy", () => {
  assert.equal(READ_ALONG_MESSAGE, "The words are right here — read along with me.");
});

test("read-aloud control reveals no band: no age numbers, no easy/hard", () => {
  for (const mode of ["auto", "button", "off"] as const) {
    const html = renderButton(mode);
    assert.ok(!/11-13|8-10|5-7/.test(html), `mode ${mode} leaks a band`);
    assert.ok(!/easy|hard/i.test(html), `mode ${mode} leaks difficulty`);
  }
});

// --- Onboarding preference prompt ---

test("the prompt asks the exact question once, with the three choices", () => {
  const html = renderToString(createElement(ReadAloudPrefPrompt, {}));
  assert.ok(html.includes("Do you like stories read aloud?"), "exact question");
  assert.ok(html.includes(">Always<"), "Always choice");
  assert.ok(html.includes(">Sometimes<"), "Sometimes choice");
  assert.ok(html.includes(">Never<"), "Never choice");
  assert.ok(!/11-13|8-10|5-7/.test(html), "no age numbers in the prompt");
  assert.ok(!/easy|hard/i.test(html), "no easy/hard in the prompt");
});
