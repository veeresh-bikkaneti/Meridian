/**
 * AgeBandControl — the missing-band fail-open (PR 533, Unit E).
 *
 * The store's invariant says a set ("active") profile always
 * carries its band, and its validator enforces that on load — so
 * the broken shape cannot be seeded through storage. The render
 * branch still guards it: if a set profile's band were ever
 * missing, the control must show the three-pill chooser (the ask
 * fails open), never a collapsed pill with an empty label.
 *
 * Rendered server-side in the style of read-aloud-button.test.ts,
 * with one twist: the module hook points the "@/game/age-profile"
 * facade at a stub whose loadProfile returns the broken profile
 * (status "active", band null). The stub re-exports the REAL band
 * table, so the pills below carry the game's own labels. The
 * store import (setBand / saveBand) stays the real module; no
 * pick is tapped in these renders, so it is never called.
 */
import assert from "node:assert/strict";
import test from "node:test";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// read-aloud-button.test.ts. Components are imported dynamically
// AFTER register() so the hook is in place when their specifiers
// resolve.
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BANDS_URL = pathToFileURL(resolvePath(REPO_ROOT, "src", "game", "age-profile", "bands.ts")).href;

// The facade stub: real band table, broken profile. `band: null`
// with status "active" is the collapsed configuration with its
// band missing — the exact state the guard defends.
const STUB_SOURCE = [
  `import { AGE_BANDS, AGE_BAND_IDS } from ${JSON.stringify(BANDS_URL)};`,
  "export { AGE_BANDS, AGE_BAND_IDS };",
  "export function loadProfile() {",
  "  return {",
  '    status: "active",',
  "    band: null,",
  '    updatedAt: "2026-01-01T00:00:00.000Z",',
  "    changeCount: 0,",
  "    schemaVersion: 2,",
  "  };",
  "}",
  "export function onAgeProfileChanged() {",
  "  return () => {};",
  "}",
].join("\n");
const STUB_URL = "data:text/javascript," + encodeURIComponent(STUB_SOURCE);

const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const STUB_URL = " + JSON.stringify(STUB_URL) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier === '@/game/age-profile') {",
  "    return { url: STUB_URL, shortCircuit: true };",
  "  }",
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

const { default: AgeBandControl } = (await import("./AgeBandControl.tsx")) as typeof import("./AgeBandControl.tsx");
const { AGE_BANDS, AGE_BAND_IDS } = await import("../../game/age-profile/bands.ts");

test("a set profile with its band missing renders the chooser, never an empty pill", () => {
  const html = renderToString(createElement(AgeBandControl, {}));
  assert.ok(!html.includes("band-selected-pill"), "no collapsed selected-band pill renders");
  assert.ok(html.includes('data-testid="band-pills"'), "the three-pill chooser renders instead");
  for (const id of AGE_BAND_IDS) {
    assert.ok(html.includes(`data-testid="band-pill-${id}"`), `the ${id} pill renders`);
    assert.ok(html.includes(AGE_BANDS[id].label), `the ${id} pill carries its real label`);
  }
  assert.ok(
    html.includes("Pick the closest — you can change it anytime."),
    "the chooser keeps its helper line — the ask fails open, in full",
  );
});
