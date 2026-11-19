/**
 * Grandpa once per visit (fix/grandpa-once-per-visit).
 *
 * The footer scene mounts on every page, so a route change used to
 * remount it and replay the whole walk + trail lines. These tests drive
 * the REAL GrandpaCoffeeRun (bundled with esbuild, rendered with
 * react-test-renderer — the shared-shell pattern) against stubbed
 * browser globals, with ./grandpa-ask.ts stubbed so playTrail calls are
 * observable:
 *
 * 1. First mount in a session walks (strip mode), plays trail line 0 and
 *    writes the session flag; a second mount in the SAME session starts
 *    seated (bench + donation cloud) and plays no trail line.
 * 2. Inside one walk the quip rotation survives the kettle beat:
 *    walking → kettle → walking never replays line 0 and the 7s
 *    interval continues from the next index.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { build, type Plugin } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";
import TestRenderer, { act } from "react-test-renderer";

const here = dirname(fileURLToPath(import.meta.url));

/* ---------------- browser-global stubs ---------------- */

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

type TimerRec = {
  id: number;
  cb: () => void;
  ms: number;
  kind: "timeout" | "interval";
  cleared: boolean;
};

const timers: TimerRec[] = [];
let nextTimerId = 1;
let sessionStore = new MemStorage();
let localStore = new MemStorage();

function installGlobals(): void {
  timers.length = 0;
  nextTimerId = 1;
  const addTimer = (kind: TimerRec["kind"]) => (cb: () => void, ms: number) => {
    const rec: TimerRec = { id: nextTimerId++, cb, ms, kind, cleared: false };
    timers.push(rec);
    return rec.id;
  };
  const clearTimer = (id: number) => {
    const rec = timers.find((t) => t.id === id);
    if (rec) rec.cleared = true;
  };
  const matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
  const win = {
    setTimeout: addTimer("timeout"),
    clearTimeout: clearTimer,
    setInterval: addTimer("interval"),
    clearInterval: clearTimer,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    matchMedia,
    open: () => null,
  };
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.matchMedia = matchMedia;
  g.sessionStorage = sessionStore;
  g.localStorage = localStore;
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.__trailCalls = [];
}

function trailCalls(): number[] {
  return (globalThis as Record<string, unknown>).__trailCalls as number[];
}

function fireTimeout(ms: number): void {
  const rec = timers.find((t) => t.kind === "timeout" && t.ms === ms && !t.cleared);
  assert.ok(rec, `expected a pending ${ms}ms timeout`);
  rec.cleared = true;
  rec.cb();
}

function tickInterval(): void {
  const rec = [...timers]
    .reverse()
    .find((t) => t.kind === "interval" && !t.cleared);
  assert.ok(rec, "expected an active interval");
  rec.cb();
}

/* ---------------- bundled component module ---------------- */

type GrandpaModule = {
  GrandpaCoffeeRun: (props: { tastingTour?: boolean }) => ReactNode;
};

type Renderer = ReturnType<typeof TestRenderer.create>;

const askStub: Plugin = {
  name: "grandpa-ask-stub",
  setup(b) {
    b.onResolve({ filter: /grandpa-ask\.ts$/ }, () => ({
      path: "grandpa-ask-stub",
      namespace: "ask-stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "ask-stub" }, () => ({
      contents: [
        'export const TRAIL_QUIPS = ["These hills did not ask my knees for permission.", "I can smell the coffee from the next ridge.", "A good map and a warm mug. That\'s the whole trick.", "Stay on the trail, explorer. The shortcuts are liars."];',
        "export function playTrail(i: number): void { ((globalThis as any).__trailCalls ??= []).push(i); }",
        "export function playAsk(): void {}",
        "export function playCough(): void {}",
      ].join("\n"),
      loader: "ts",
    }));
  },
};

/**
 * The component imports createPortal from "react-dom"; the full client
 * bundle's scheduler holds a MessageChannel port open and the test
 * process would never exit (the reason the boundary behaviour test
 * avoids client rendering too). The portal only renders after the
 * grown-up gate opens — never in these tests, and covered by e2e — so
 * react-dom is stubbed to the one export this module uses.
 */
const reactDomStub: Plugin = {
  name: "react-dom-stub",
  setup(b) {
    b.onResolve({ filter: /^react-dom$/ }, () => ({
      path: "react-dom-stub",
      namespace: "dom-stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "dom-stub" }, () => ({
      contents:
        "export function createPortal(node: unknown): unknown { return node; }",
      loader: "ts",
    }));
  },
};

let modulePromise: Promise<GrandpaModule> | undefined;
let bundleDir: string | undefined;
after(() => {
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true });
});

function loadModule(): Promise<GrandpaModule> {
  modulePromise ??= (async () => {
    // Only the component is bundled; react stays external and the bundle
    // is written under node_modules so its bare "react" import resolves
    // to the very copy this file renders with (a bundled scheduler keeps
    // a MessageChannel port open and the test process never exits — the
    // use-auto-animate suite renders unbundled for the same reason).
    const repoRoot = join(here, "..", "..");
    bundleDir = mkdtempSync(join(repoRoot, "node_modules", ".grandpa-once-"));
    const entry = join(bundleDir, "entry.tsx");
    writeFileSync(
      entry,
      `export { GrandpaCoffeeRun } from ${JSON.stringify(join(here, "grandpa-coffee-run.tsx"))};`,
    );
    const outfile = join(bundleDir, "bundle.mjs");
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      external: ["react", "scheduler"],
      define: {
        "import.meta.env": JSON.stringify({
          VITE_KOFI_URL: "https://ko-fi.com/test",
        }),
      },
      loader: { ".css": "empty" },
      plugins: [askStub, reactDomStub],
      logLevel: "silent",
    });
    return (await import(pathToFileURL(outfile).href)) as GrandpaModule;
  })();
  return modulePromise;
}

const nodeMock = () => ({
  addEventListener: () => {},
  removeEventListener: () => {},
  focus: () => {},
  style: {},
});

async function mount(m: GrandpaModule): Promise<Renderer> {
  let renderer!: Renderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(m.GrandpaCoffeeRun, {}), {
      createNodeMock: nodeMock,
    });
  });
  return renderer;
}

describe("GrandpaCoffeeRun once per visit", () => {
  it("walks on the first mount of a session, starts seated on the next", async () => {
    const m = await loadModule();
    sessionStore = new MemStorage();
    localStore = new MemStorage();
    installGlobals();

    const first = await mount(m);
    const scene1 = first.root.findByProps({ "data-testid": "grandpa-scene" });
    assert.equal(scene1.props["data-mode"], "strip");
    assert.deepEqual(trailCalls(), [0]);
    assert.equal(
      sessionStore.getItem("meridian.grandpa.walkedSession"),
      "1",
      "the walk writes the session flag as it begins",
    );
    await act(async () => first.unmount());

    const second = await mount(m);
    const scene2 = second.root.findByProps({ "data-testid": "grandpa-scene" });
    assert.equal(scene2.props["data-mode"], "seated");
    assert.equal(scene2.props["data-beat"], "seated");
    // The seated finale still renders: bench + donation cloud.
    second.root.findByProps({ "data-testid": "grandpa-bench" });
    second.root.findByProps({ "data-testid": "grandpa-donation-bubble" });
    assert.deepEqual(trailCalls(), [0], "no trail line replays");
    await act(async () => second.unmount());
  });

  it("quip rotation continues across the kettle beat, never replaying line 0", async () => {
    const m = await loadModule();
    sessionStore = new MemStorage();
    localStore = new MemStorage();
    installGlobals();

    const r = await mount(m);
    const scene = () => r.root.findByProps({ "data-testid": "grandpa-scene" });
    assert.equal(scene().props["data-beat"], "walking");
    assert.deepEqual(trailCalls(), [0]);

    // 7s tick: rotation advances to line 1.
    await act(async () => tickInterval());
    assert.deepEqual(trailCalls(), [0, 1]);

    // Kettle beat at 45% of the 9.5s walk (4275ms), hold 4000ms, resume.
    await act(async () => fireTimeout(4275));
    assert.equal(scene().props["data-beat"], "kettle");
    await act(async () => fireTimeout(4000));
    assert.equal(scene().props["data-beat"], "walking");
    assert.deepEqual(trailCalls(), [0, 1], "re-entry must not replay line 0");

    // The re-registered interval continues from the next index.
    await act(async () => tickInterval());
    assert.deepEqual(trailCalls(), [0, 1, 2]);
    await act(async () => r.unmount());
  });
});
