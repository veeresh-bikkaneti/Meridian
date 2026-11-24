/**
 * PR 3 Step 3.9 — MapErrorBoundary behaviour (owner conditions,
 * 2026-11-17). The boundary's card is the shared ErrorScreen in
 * embedded mode. These tests drive the REAL boundary class —
 * its render() output for a caught error, rendered to markup
 * with react-dom/server (the shared-shell bundle pattern), and
 * its real retry/goHome methods against stubbed browser storage:
 *
 * 1. Mid-run (the bare-map usage, inside a run in progress): NO
 *    Home control — the retry reload restores the run, so a Home
 *    button would lie. The action button still reloads.
 * 2. A persisted screen (GeoDetective): the Home exit shows, and
 *    Try again reloads back into the screen — the one-shot retry
 *    marker it arms is exactly what boot consumes to restore it.
 * 3. The stale card's owner-approved copy renders word for word.
 *
 * (Rendering through react-test-renderer was tried first: a
 * throwing child keeps that renderer's scheduler alive and the
 * test process never exits. Instance + static markup exercises
 * the same render logic without it.)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import type { ReactNode } from "react";
import { consumeRetryScreen } from "../lib/persisted-screen.ts";
import {
  setLocalBackend,
  setSessionBackend,
  type GameEnumerableStorageBackend,
  type GameStorageBackend,
} from "../game/storage-slot.ts";

const req = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

type BoundaryClass = new (props: {
  surface?: string;
}) => {
  state: { error: Error | null; staleBuild: boolean };
  render: () => ReactNode;
  retry: () => void;
  goHome: () => void;
};

type BoundaryModule = {
  MapErrorBoundary: BoundaryClass;
  renderToStaticMarkup: (node: ReactNode) => string;
  setLocalBackend: (backend: GameEnumerableStorageBackend | undefined) => void;
  setSessionBackend: (backend: GameStorageBackend | undefined) => void;
};

let modulePromise: Promise<BoundaryModule> | undefined;
function loadBoundary(): Promise<BoundaryModule> {
  modulePromise ??= (async () => {
    const dir = mkdtempSync(join(tmpdir(), "map-boundary-test-"));
    const entry = join(dir, "entry.tsx");
    writeFileSync(
      entry,
      [
        `export { MapErrorBoundary } from ${JSON.stringify(join(here, "map-error-boundary.tsx"))};`,
        `export { setLocalBackend, setSessionBackend } from ${JSON.stringify(join(here, "../game/storage-slot.ts"))};`,
        'export { renderToStaticMarkup } from "react-dom/server";',
      ].join("\n"),
    );
    const outfile = join(dir, "bundle.mjs");
    buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      alias: {
        react: dirname(req.resolve("react/package.json")),
        "react-dom": dirname(req.resolve("react-dom/package.json")),
        scheduler: dirname(req.resolve("scheduler/package.json")),
      },
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    return (await import(pathToFileURL(outfile).href)) as BoundaryModule;
  })();
  return modulePromise;
}

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

/** Slot backends delegating to a fake storage object. The boundary
 *  reads storage through the game slot (src/game/storage-slot.ts),
 *  so the fakes must be registered there — installing the globals
 *  alone no longer reaches the code under test. Both module
 *  instances get the same fakes: the bundle's copy (via the entry
 *  exports) and this file's direct import (via the setters above),
 *  because esbuild bundles its own copy of the slot. */
type Fake = ReturnType<typeof fakeStorage>;
function sessionBackend(fake: Fake): GameStorageBackend {
  return {
    getItem: (k: string) => fake.getItem(k),
    setItem: (k: string, v: string) => fake.setItem(k, v),
    removeItem: (k: string) => fake.removeItem(k),
  };
}
function localBackend(fake: Fake): GameEnumerableStorageBackend {
  return {
    ...sessionBackend(fake),
    get length() {
      return fake.data.size;
    },
    key: (i: number) => [...fake.data.keys()][i] ?? null,
  };
}

/** Install window/localStorage/sessionStorage fakes; returns reload count + restore fn. */
function stubBrowser() {
  const local = fakeStorage();
  const session = fakeStorage();
  let reloads = 0;
  let bundleMod: BoundaryModule | undefined;
  const g = globalThis as Record<string, unknown>;
  const prev = { window: g.window, localStorage: g.localStorage, sessionStorage: g.sessionStorage };
  g.localStorage = local;
  g.sessionStorage = session;
  g.window = {
    sessionStorage: session,
    localStorage: local,
    location: {
      reload: () => {
        reloads += 1;
      },
    },
  };
  // Direct-import side: persisted-screen.ts and its stores read the
  // slot from this file's module graph.
  setLocalBackend(localBackend(local));
  setSessionBackend(sessionBackend(session));
  return {
    local,
    session,
    reloads: () => reloads,
    /** Fill the bundle's slot copy once the bundle is loaded. */
    wireBundle: (mod: BoundaryModule) => {
      bundleMod = mod;
      mod.setLocalBackend(localBackend(local));
      mod.setSessionBackend(sessionBackend(session));
    },
    restore: () => {
      setLocalBackend(undefined);
      setSessionBackend(undefined);
      bundleMod?.setLocalBackend(undefined);
      bundleMod?.setSessionBackend(undefined);
      g.window = prev.window;
      g.localStorage = prev.localStorage;
      g.sessionStorage = prev.sessionStorage;
    },
  };
}

/** A boundary instance in its caught-error state, as React leaves it after a chunk failure. */
async function caughtBoundary(
  surface: string | undefined,
  staleBuild: boolean,
  browser: ReturnType<typeof stubBrowser>,
) {
  const mod = await loadBoundary();
  browser.wireBundle(mod);
  const g = globalThis as { mh?: { s?: () => Promise<boolean> } };
  g.mh = { ...(g.mh ?? {}), s: () => Promise.resolve(staleBuild) };
  const instance = new mod.MapErrorBoundary({ surface });
  instance.state = { error: new Error("chunk failed to load"), staleBuild };
  const html = mod.renderToStaticMarkup(instance.render());
  return { instance, html };
}

/** Button labels in rendered markup, in order. */
function buttonLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!);
}

describe("MapErrorBoundary on ErrorScreen embedded (PR 3 Step 3.9)", () => {
  it("mid-run (bare map): Home is hidden and Try again still reloads back into the run", async () => {
    const browser = stubBrowser();
    try {
      const { instance, html } = await caughtBoundary(undefined, false, browser);
      assert.match(html, /Couldn’t load the map\./);
      assert.match(html, /Your game is safe — it just didn’t finish loading\. Check your connection, then try again\./);
      assert.deepEqual(
        buttonLabels(html),
        ["Try again"],
        "no Home control mid-run — the reload restores the run, so Home would lie",
      );
      instance.retry();
      assert.equal(browser.reloads(), 1, "Try again reloads the page (the run restores from storage on boot)");
    } finally {
      browser.restore();
    }
  });

  it("persisted screen (GeoDetective): Home shows, and Try again reloads back into the screen", async () => {
    const browser = stubBrowser();
    try {
      const { instance, html } = await caughtBoundary("GeoDetective", false, browser);
      assert.match(html, /Couldn’t load GeoDetective\./);
      assert.deepEqual(buttonLabels(html), ["Try again", "Home"]);
      instance.retry();
      assert.equal(browser.reloads(), 1, "Try again reloads");
      assert.equal(
        consumeRetryScreen(),
        "GeoDetective",
        "the reload restores GeoDetective exactly once via the retry marker boot consumes",
      );
    } finally {
      browser.restore();
    }
  });

  it("the stale card renders the owner-approved copy word for word, with Refresh", async () => {
    const browser = stubBrowser();
    try {
      const { html } = await caughtBoundary("GeoDetective", true, browser);
      assert.match(html, /A new version of Meridian is available\./);
      assert.match(
        html,
        /Your game is safe — this tab is running an older copy\. Refresh to get the new version and keep playing\./,
      );
      assert.deepEqual(buttonLabels(html), ["Refresh", "Home"]);
    } finally {
      browser.restore();
    }
  });
});
