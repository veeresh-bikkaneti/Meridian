/**
 * Item 39 (PR #522, rebuilt as #528): the Privacy page must not claim we
 * never ask about age — the game does ask for an age band.
 *
 * BEHAVIOUR version (Task 2, 2026-11-17): this used to grep privacy.tsx
 * source text. It now renders the real Privacy page through a memory
 * router (the home-button.test.ts pattern) and asserts on the rendered
 * output — what a grown-up actually reads. Reverting the item-39 copy
 * fix (restoring "age" to the never-asked list, dropping the age-band
 * sentence, or reverting the Last-updated date) turns this test red.
 *
 * NOTE: the age-band sentence itself is awaiting the owner's explicit
 * sign-off (see docs/branch-status/fix-ui-copy-sweep-v2.md). This test
 * pins the copy as written on the branch; if the owner edits the
 * sentence, update the pin with the approved wording.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// read-aloud-button.test.ts. Components are imported dynamically AFTER
// register() so the hook is in place when their specifiers resolve.
// Stylesheet and image imports resolve to empty modules: the node
// harness renders markup, it does not paint.
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  "  if (/\\.(css|webp|png|jpe?g|svg|woff2?)$/.test(url)) {",
  "    return { format: 'module', source: '', shortCircuit: true };",
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

const { Route } = (await import("./privacy.tsx")) as typeof import("./privacy.tsx");
const {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} = await import("@tanstack/react-router");

/** Rendered visible text: tags and hidden SVG artwork removed, space-collapsed. */
function renderedText(html: string): string {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function renderPrivacyPage(): Promise<string> {
  const PrivacyPage = Route.options.component;
  assert.ok(PrivacyPage, "the /privacy route carries a component");
  const rootRoute = createRootRoute({ component: () => createElement(Outlet) });
  const blank = () => null;
  const privacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: PrivacyPage,
  });
  const siblings = ["/", "/board", "/contact", "/credits"].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: blank }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([privacyRoute, ...siblings]),
    history: createMemoryHistory({ initialEntries: ["/privacy"] }),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router } as never));
}

describe("privacy page, rendered — the age band is disclosed (item 39)", () => {
  it("the rendered short version does not list age among the things never asked", async () => {
    const text = renderedText(await renderPrivacyPage());
    assert.ok(
      text.includes(
        "We never ask a player for a name, email, location, photo, or any other personal information.",
      ),
      "the never-asked list renders without age in it",
    );
    assert.ok(!text.includes("name, email, age"), "the old false claim is not rendered");
  });

  it("the rendered age-band sentence reads word for word as written for sign-off", async () => {
    const text = renderedText(await renderPrivacyPage());
    assert.ok(
      text.includes(
        "We do ask for an age band (7-10, 10-18, or 18+). The band is saved only in this browser, and the game uses it to pick the difficulty and the cases the player sees. It is never sent to us.",
      ),
      "the age-band disclosure renders exactly as written for sign-off",
    );
  });

  it("the rendered page carries the current Last-updated date", async () => {
    const text = renderedText(await renderPrivacyPage());
    assert.ok(
      text.includes("Last updated November 17, 2026"),
      "the page a grown-up reads shows the date of this change",
    );
  });
});
