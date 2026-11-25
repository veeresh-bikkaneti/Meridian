/**
 * useAgeProfileHost — the age-profile state owner and overlay host
 * (game-app-map step 4, TD-06.6), exercised through a tiny probe
 * component rendered with react-dom/server (no jsdom in the repo's
 * node:test harness). Effects do not run in SSR and state setters
 * are never invoked, so this covers the initial values, the slot
 * construction, and the first-visit entry construction; the
 * interactive flows (ask-first, settings, toast timing) are covered
 * by the ask-age-first E2E and the settings toast unit test. Media
 * and stylesheet imports are stubbed by the loader below — they are
 * bundler concerns, pinned elsewhere (locked-tile-film.test.ts).
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// read-aloud-button.test.ts. Components are imported dynamically
// AFTER register() so the hook is in place when their specifiers
// resolve.
import { register } from "node:module";
import { createElement, isValidElement, type ReactNode } from "react";
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
  "const PROBE_EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];",
  "const ASSET_EXTS = ['.css', '.webp', '.mp4', '.png', '.jpg', '.svg'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  if (specifier.startsWith('./') || specifier.startsWith('../')) {",
  "    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (ASSET_EXTS.some((ext) => url.endsWith(ext))) {",
  "    return { format: 'module', source: 'export default \"\";', shortCircuit: true };",
  "  }",
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

const { useAgeProfileHost } = (await import("./use-age-profile-host.tsx")) as typeof import("./use-age-profile-host.tsx");
type AgeProfileHost = import("./use-age-profile-host.tsx").AgeProfileHost;
const { LockedLoop } = (await import("./LockedLoop.tsx")) as typeof import("./LockedLoop.tsx");
const { ReadAloudPrefSettings } = (await import("./ReadAloudPrefSettings.tsx")) as typeof import("./ReadAloudPrefSettings.tsx");
const { ReadAloudPrefPrompt, READ_ALOUD_PREF_HEADING_ID } = (await import("./ReadAloudPrefPrompt.tsx")) as typeof import("./ReadAloudPrefPrompt.tsx");
const { setReadAloudPref } = await import("@/game/age-profile/read-aloud-pref");
const { __resetReadAloudPrefMemory } = await import("../../../tests/harness/module-seams.ts");

const globals = globalThis as { localStorage?: unknown };
const hadLocalStorage = "localStorage" in globals;
const originalLocalStorage = globals.localStorage;

function stubLocalStorage(initial: Record<string, string> = {}): void {
  const store = new Map(Object.entries(initial));
  globals.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

beforeEach(() => {
  __resetReadAloudPrefMemory();
  stubLocalStorage();
});

afterEach(() => {
  if (hadLocalStorage) globals.localStorage = originalLocalStorage;
  else delete globals.localStorage;
});

let captured: AgeProfileHost | null = null;

function Probe({ children }: { children?: ReactNode }) {
  const host = useAgeProfileHost();
  captured = host;
  return createElement(
    "span",
    null,
    `${host.ageBand}:${host.ageAsk === null}:${host.ageSettingsOpen}:${host.ageToast === null}`,
    children,
  );
}

describe("useAgeProfileHost", () => {
  it("starts with the full-access band, no ask held, settings closed, no toast", () => {
    const html = renderToStaticMarkup(createElement(Probe));
    assert.match(html, /<span>10-18:true:false:true<\/span>/);
    assert.equal(captured!.ageAskGate, null);
    assert.equal(captured!.ageToastNode, null);
    assert.equal(captured!.ageSettings(false), null);
  });

  it("is SSR-safe: never throws without a browser environment", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
  });

  it("builds the locked-loop slot: LockedLoop for GeoDetective, wired to the host's own grown-up open", () => {
    renderToStaticMarkup(createElement(Probe));
    const slot = captured!.lockedLoop;
    assert.ok(isValidElement(slot), "slot is an element");
    assert.equal(slot.type, LockedLoop);
    assert.deepEqual(
      Object.keys(slot.props as Record<string, unknown>).sort(),
      ["onGrownUpOpen", "title"],
    );
    assert.equal((slot.props as { title: string }).title, "GeoDetective");
    assert.equal(
      (slot.props as { onGrownUpOpen: unknown }).onGrownUpOpen,
      captured!.openAgeSettings,
    );
  });

  it("builds the footer lead slot: the read-aloud preference setting", () => {
    renderToStaticMarkup(createElement(Probe));
    const slot = captured!.readAloudPrefSettings;
    assert.ok(isValidElement(slot), "slot is an element");
    assert.equal(slot.type, ReadAloudPrefSettings);
  });

  it("builds the first-visit read-aloud entry while the pref is unset, and none after it is answered", () => {
    renderToStaticMarkup(createElement(Probe));
    const entry = captured!.readAloudPrefEntry(() => {});
    assert.ok(entry, "entry exists while the pref is unset");
    assert.equal(entry.id, "read-aloud-sheet");
    assert.equal(entry.modal, true);
    assert.equal(entry.labelledBy, READ_ALOUD_PREF_HEADING_ID);
    assert.ok(isValidElement(entry.node), "entry node is an element");
    assert.equal((entry.node as { type: unknown }).type, ReadAloudPrefPrompt);
    setReadAloudPref("always");
    assert.equal(captured!.readAloudPrefEntry(() => {}), null);
  });
});
