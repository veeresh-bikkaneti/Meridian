import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement, type ReactElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TS_URL = pathToFileURL(
  resolvePath(REPO_ROOT, "node_modules/typescript/lib/typescript.js"),
).href;

// Recording stub for @formkit/auto-animate: the real library needs a DOM +
// WAAPI, so tests observe the wiring (called with the right container,
// destroyed on cleanup) through this stub instead.
const AA_STUB_SRC = [
  "export const calls = [];",
  "export const destroyed = [];",
  "export default function autoAnimate(el, options) {",
  "  calls.push({ el, options });",
  "  return { destroy() { destroyed.push(el); } };",
  "}",
  "export function __resetAaStub() { calls.length = 0; destroyed.length = 0; }",
].join("\n");
const AA_STUB_URL = "data:text/javascript," + encodeURIComponent(AA_STUB_SRC);

// Module hooks (repo pattern — see EarnedBadgeRow.test.ts): "@/..." alias,
// extensionless relatives, directory index files, ".css" stubs, ".tsx"
// transpile, and the auto-animate recording stub above.
const HOOKS_SOURCE = [
  "import { statSync, readFileSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = " + JSON.stringify(TS_URL) + ";",
  "const AA_STUB_URL = " + JSON.stringify(AA_STUB_URL) + ";",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "function tryBase(base) {",
  "  const cands = [];",
  "  for (const ext of PROBE_EXTS) cands.push(base + ext);",
  "  for (const ext of ['.ts', '.tsx']) cands.push(base + '/index' + ext);",
  "  for (const cand of cands) {",
  "    if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "  }",
  "  return null;",
  "}",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier === '@formkit/auto-animate') return { url: AA_STUB_URL, shortCircuit: true };",
  "  if (specifier.startsWith('@/')) {",
  "    const hit = tryBase(resolvePath(ROOT, 'src', specifier.slice(2)));",
  "    if (hit) return hit;",
  "  }",
  "  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && context.parentURL.startsWith('file://')) {",
  "    const dir = dirname(fileURLToPath(context.parentURL));",
  "    const hit = tryBase(resolvePath(dir, specifier));",
  "    if (hit) return hit;",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.css')) {",
  "    return { format: 'module', source: 'export default {};', shortCircuit: true };",
  "  }",
  "  if (url.endsWith('.tsx')) {",
  "    const ts = await import(TS_URL);",
  "    const code = readFileSync(new URL(url), 'utf8');",
  "    const out = ts.transpileModule(code, {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { GuessInput } = (await import("./guess-input.tsx")) as typeof import("./guess-input.tsx");
const { clearLoopIndexCache } = (await import("./evaluate.ts")) as typeof import("./evaluate.ts");
const aaStub = (await import(AA_STUB_URL)) as {
  calls: Array<{ el: unknown; options: unknown }>;
  destroyed: unknown[];
  __resetAaStub: () => void;
};

// --- minimal browser shims -------------------------------------------------

type ChangeListener = (e: { matches: boolean }) => void;

function installWindow(reduce: boolean): void {
  const listeners = new Set<ChangeListener>();
  (globalThis as Record<string, unknown>).window = {
    matchMedia: () => ({
      matches: reduce,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: (type: string, cb: ChangeListener) => {
        if (type === "change") listeners.add(cb);
      },
      removeEventListener: (type: string, cb: ChangeListener) => {
        if (type === "change") listeners.delete(cb);
      },
    }),
    setTimeout: (fn: (...args: unknown[]) => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as never),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).fetch;
  aaStub.__resetAaStub();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ENTRIES = [
  { n: "paris", id: "geo-1", lon: 2.35, lat: 48.85, r: "France", p: 2000000 },
  { n: "paris texas", id: "geo-2", lon: -95.55, lat: 33.66, r: "Texas, USA", p: 25000 },
];

function stubFetch() {
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true,
    json: async () => ENTRIES,
  });
}

// Render with createNodeMock keyed by data-testid (the test renderer's
// supported path for host refs): the mock stands in for the DOM node.
function renderGuessInput() {
  const mocks = new Map<string, object>();
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(createElement(GuessInput, { onJump: () => {} }), {
      createNodeMock: (el: ReactElement) => {
        const props = el.props as Record<string, unknown>;
        const key = (props["data-testid"] as string | undefined) ?? `anon-${mocks.size}`;
        const mock = { __mock: key };
        mocks.set(key, mock);
        return mock;
      },
    });
  });
  return { renderer: renderer!, mocks };
}

// Drive the real runtime path: focus (loads the index) → type → debounce
// → the suggestion listbox mounts.
//
// Timing subtlety: React 19's act() only runs passive effects when the
// scope exits, so the debounce timer is not even *scheduled* until the
// onChange act-block exits — the wait for the 150ms debounce must live in
// its own act-block afterwards.
async function openSuggestions(
  renderer: TestRenderer.ReactTestRenderer,
  query: string,
) {
  const input = renderer.root.findByProps({ role: "combobox" });
  await act(async () => {
    input.props.onFocus();
    await sleep(100); // index fetch resolves
  });
  act(() => {
    input.props.onChange({ target: { value: query } });
  });
  await act(async () => {
    await sleep(300); // past the 150ms debounce, then flush
  });
}

describe("GuessInput suggestion list — auto-animate wiring", () => {
  beforeEach(() => {
    installWindow(false);
    stubFetch();
    clearLoopIndexCache();
  });

  it("engages auto-animate on the suggestion listbox when it mounts", async () => {
    const { renderer, mocks } = renderGuessInput();
    await openSuggestions(renderer, "paris");
    const ul = renderer.root.findByProps({ "data-testid": "loop-suggestions" });
    assert.ok(ul, "suggestion listbox rendered");
    assert.ok(
      aaStub.calls.some((c) => c.el === mocks.get("loop-suggestions")),
      "autoAnimate called with the listbox container",
    );
  });

  it("the listbox is still fully usable when reduced motion disables the animation", async () => {
    installWindow(true);
    const { renderer } = renderGuessInput();
    await openSuggestions(renderer, "paris");
    const ul = renderer.root.findByProps({ "data-testid": "loop-suggestions" });
    assert.ok(ul, "suggestion listbox rendered");
    const options = ul.findAllByProps({ role: "option" });
    assert.ok(options.length > 0, "suggestion rows present and tappable");
    assert.equal(aaStub.calls.length, 0, "zero animation under reduced motion");
  });
});
