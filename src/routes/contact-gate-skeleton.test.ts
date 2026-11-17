/**
 * Item 41 (PR #522, rebuilt as #528): the Contact page shows the gate's
 * skeleton while the lazy grown-up-check chunk loads — never a blank
 * page.
 *
 * BEHAVIOUR version (Task 2, 2026-11-17): this used to grep contact.tsx
 * source text. It now renders the real Contact page through a memory
 * router: on the first synchronous render the lazy GrownUpGate chunk
 * has not loaded, so what renders IS the Suspense fallback — the
 * loading screen a grown-up actually sees. Asserting on that markup
 * proves the shape, the aria-busy state, and the fallback wiring in
 * one pass: point the fallback anywhere else and the skeleton stops
 * rendering here. The one part a markup render cannot prove — that
 * the skeleton's classes have rules in the shared stylesheet — stays
 * a stylesheet check below, labelled as such.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// read-aloud-button.test.ts. Components are imported dynamically AFTER
// register() so the hook is in place when their specifiers resolve.
// Stylesheet and image imports resolve to empty modules: the node
// harness renders markup, it does not paint.
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(here, "..", "..");

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

const { Route } = (await import("./contact.tsx")) as typeof import("./contact.tsx");
const {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} = await import("@tanstack/react-router");

async function renderContactGateLoading(): Promise<string> {
  const ContactPage = Route.options.component;
  assert.ok(ContactPage, "the /contact route carries a component");
  const rootRoute = createRootRoute({ component: () => createElement(Outlet) });
  const contactRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contact",
    component: ContactPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([contactRoute]),
    history: createMemoryHistory({ initialEntries: ["/contact"] }),
  });
  await router.load();
  // Synchronous render: the lazy gate chunk cannot have resolved yet,
  // so this markup is the Suspense fallback — the loading screen.
  return renderToStaticMarkup(createElement(RouterProvider, { router } as never));
}

// Rendered ONCE, up front: the lazy gate chunk resolves in the
// background, so a later render would show the gate itself instead of
// its loading screen. This single markup string is the loading screen.
const gateLoadingHtml = await renderContactGateLoading();

describe("contact gate loading screen, rendered (item 41)", () => {
  it("the loading screen is the gate skeleton, announcing the wait", () => {
    const html = gateLoadingHtml;
    assert.match(html, /aria-busy="true"/, "the loading screen carries the busy state");
    assert.ok(
      html.includes('aria-label="Loading the grown-up check"'),
      "the loading screen announces what is loading",
    );
    assert.match(html, /class="agep-screen"/, "the skeleton wears the gate's screen shape");
  });

  it("the skeleton renders its title bar, box, and two text lines", () => {
    const html = gateLoadingHtml;
    assert.ok(html.includes("agep-skeleton agep-skeleton-title"), "title bar rendered");
    assert.ok(html.includes("agep-skeleton agep-skeleton-box"), "box bar rendered");
    const lines = html.match(/agep-skeleton agep-skeleton-line/g) ?? [];
    assert.equal(lines.length, 2, "two skeleton text lines rendered");
  });

  it("the skeleton bars have styles in the shared age-profile sheet (stylesheet check)", () => {
    const ageProfileCss = readFileSync(
      join(here, "..", "components", "age-profile", "age-profile.css"),
      "utf8",
    );
    assert.ok(ageProfileCss.includes(".agep-skeleton {"), "skeleton base style defined");
    assert.ok(ageProfileCss.includes(".agep-skeleton-box {"), "skeleton box style defined");
  });
});
