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

// LoopMap needs maplibre-gl (browser-only): a null stub with the same
// named exports LoopScreen imports. Import-free so the data: URL resolves.
const LOOPMAP_STUB_SRC = [
  "export function ringAnnouncement() { return ''; }",
  "export function LoopMap() { return null; }",
].join("\n");
const LOOPMAP_STUB_URL = "data:text/javascript," + encodeURIComponent(LOOPMAP_STUB_SRC);

// Module hooks (repo pattern — see EarnedBadgeRow.test.ts): "@/..." alias,
// extensionless relatives, directory index files, ".css" stubs, ".tsx"
// transpile, the stubs above, and a test-only rewrite of
// `import.meta.env.BASE_URL` (node has no import.meta.env; Vite does).
const HOOKS_SOURCE = [
  "import { statSync, readFileSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = " + JSON.stringify(TS_URL) + ";",
  "const AA_STUB_URL = " + JSON.stringify(AA_STUB_URL) + ";",
  "const LOOPMAP_STUB_URL = " + JSON.stringify(LOOPMAP_STUB_URL) + ";",
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
  "  if (specifier === './LoopMap' && context.parentURL && context.parentURL.endsWith('LoopScreen.tsx')) return { url: LOOPMAP_STUB_URL, shortCircuit: true };",
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
  "    let code = readFileSync(new URL(url), 'utf8');",
  "    if (url.endsWith('LoopScreen.tsx')) {",
  "      code = code.split('import.meta.env.BASE_URL ?? \"/\"').join('\"/\"');",
  "    }",
  "    const out = ts.transpileModule(code, {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { LoopScreen } = (await import("./LoopScreen.tsx")) as typeof import("./LoopScreen.tsx");
const { GuessInput } = (await import("./guess-input.tsx")) as typeof import("./guess-input.tsx");
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
    requestAnimationFrame: (fn: (t: number) => void) => setTimeout(() => fn(Date.now()), 16),
    cancelAnimationFrame: (id: unknown) => clearTimeout(id as never),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  // ClueCard's Rise uses the bare globals, not window.*.
  (globalThis as Record<string, unknown>).requestAnimationFrame = (
    globalThis as Record<string, unknown> & { window: { requestAnimationFrame: (fn: (t: number) => void) => unknown } }
  ).window.requestAnimationFrame;
  (globalThis as Record<string, unknown>).cancelAnimationFrame = (
    globalThis as Record<string, unknown> & { window: { cancelAnimationFrame: (id: unknown) => void } }
  ).window.cancelAnimationFrame;
  // GuessListScroll's useMoreBelow observes its container: the createNodeMock
  // stand-in for a DOM node needs the same surface.
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

const CLUE_FILE = {
  v: 1,
  placeId: "geo-paris",
  target: { lon: 2.35, lat: 48.85 },
  clues: ["geography", "climate", "history", "hook", "giveaway"],
  source: { label: "test", href: "https://example.com" },
};

function stubFetch() {
  (globalThis as Record<string, unknown>).fetch = async (url: unknown) => {
    const u = String(url);
    const body = u.includes("manifest.json")
      ? { v: 1, size: 1, generatedAt: "test" }
      : CLUE_FILE;
    return { ok: true, json: async () => body };
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).fetch;
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
  delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
  delete (globalThis as Record<string, unknown>).ResizeObserver;
  aaStub.__resetAaStub();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Render with createNodeMock keyed by data-testid (the test renderer's
// supported path for host refs): the mock stands in for the DOM node.
function renderLoopScreen() {
  const mocks = new Map<string, object>();
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      createElement(LoopScreen, { onLeave: () => {}, onCelebrate: () => {}, onEndGame: () => {} }),
      {
        createNodeMock: (el: ReactElement) => {
          const props = el.props as Record<string, unknown>;
          const key = (props["data-testid"] as string | undefined) ?? `anon-${mocks.size}`;
          // Stand-in for a DOM node: listeners + geometry the scroll cue reads.
          const mock = {
            __mock: key,
            addEventListener: () => {},
            removeEventListener: () => {},
            scrollHeight: 0,
            scrollTop: 0,
            clientHeight: 0,
          };
          mocks.set(key, mock);
          return mock;
        },
      },
    );
  });
  return { renderer: renderer!, mocks };
}

// The mount effect deals a mystery (manifest + clue fetch); flush until the
// game screen is up.
async function waitForReady(renderer: TestRenderer.ReactTestRenderer) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await sleep(80);
    });
    const found = renderer.root.findAllByProps({ "data-testid": "loop-screen" });
    if (found.length > 0) return;
  }
  throw new Error("loop-screen never reached ready");
}

const GUESS_ENTRY = {
  n: "lyon",
  id: "geo-lyon",
  lon: 4.83,
  lat: 45.76,
  r: "France",
  p: 500000,
};

function flatText(node: { children?: unknown[] }): string {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") out.push(n);
    else if (n && typeof n === "object" && Array.isArray((n as { children?: unknown }).children))
      (n as { children: unknown[] }).children.forEach(walk);
  };
  walk(node);
  return out.join("");
}

describe("LoopScreen — auto-animate wiring", () => {
  beforeEach(() => {
    installWindow(false);
    stubFetch();
  });

  it("engages auto-animate on the screen container (sheet / reveal / section transitions)", async () => {
    const { renderer, mocks } = renderLoopScreen();
    await waitForReady(renderer);
    assert.ok(
      aaStub.calls.some((c) => c.el === mocks.get("loop-screen")),
      "autoAnimate called with the loop-screen container",
    );
  });

  it("engages auto-animate on the guesses list when the first guess row appears", async () => {
    const { renderer, mocks } = renderLoopScreen();
    await waitForReady(renderer);
    // No guesses yet: the list is absent and its animator never engaged.
    assert.equal(renderer.root.findAllByProps({ "data-testid": "loop-guesses" }).length, 0);
    assert.ok(
      !aaStub.calls.some((c) => c.el === mocks.get("loop-guesses")),
      "no animator on a list that does not exist",
    );

    // Drive the real runtime path: map-tap select → bottom-sheet confirm.
    const guessInput = renderer.root.findByType(GuessInput);
    act(() => {
      guessInput.props.onJump(GUESS_ENTRY);
    });
    const confirm = renderer.root
      .findAllByType("button")
      .find((b) => flatText(b).includes("Guess this place"));
    assert.ok(confirm, "bottom-sheet confirm rendered");
    act(() => {
      confirm!.props.onClick();
    });

    const ol = renderer.root.findByProps({ "data-testid": "loop-guesses" });
    assert.ok(flatText(ol).includes("Lyon"), "the guess row rendered");
    assert.ok(
      aaStub.calls.some((c) => c.el === mocks.get("loop-guesses")),
      "autoAnimate called with the guesses list container",
    );
  });

  it("reduced motion: the screen still works, zero animation engaged", async () => {
    installWindow(true);
    const { renderer } = renderLoopScreen();
    await waitForReady(renderer);
    // Content is fully usable — clues render, the game is playable.
    const tree = JSON.stringify(renderer.toJSON());
    assert.ok(tree.includes("Clue 1"), "clue cards render without animation");
    assert.equal(aaStub.calls.length, 0, "zero animation under reduced motion");
  });
});
