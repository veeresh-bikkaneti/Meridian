import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Minimal .tsx load hook (node's --experimental-strip-types does not
// handle .tsx; same approach as scroll-cue.test.ts).
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

const { BoundedText } = await import("./bounded-text.tsx");

/**
 * BoundedText API contract (WRAPPING_SPEC §2) — node --test, no JSX.
 * Layout assertions (scrollWidth, line counts, orphans) need a real
 * layout engine and live in tests/e2e/bounded-text.mobile.spec.ts
 * (Chromium fixture page); this file pins the props contract and the
 * CSS text contract so a regression fails fast without a browser.
 */

describe("BoundedText — element + attribute contract", () => {
  it("defaults to a <p> with variant=body, wrap=word", () => {
    const html = renderToString(createElement(BoundedText, { children: "hello" }));
    assert.ok(html.startsWith("<p"), `expected <p>, got: ${html.slice(0, 40)}`);
    assert.ok(html.includes('data-as="p"'), html);
    assert.ok(html.includes('data-variant="body"'), html);
    assert.ok(html.includes('data-wrap="word"'), html);
    assert.ok(html.includes('class="bounded-text"'), html);
  });

  it("honors as/variant/wrap", () => {
    const html = renderToString(
      createElement(BoundedText, {
        as: "h2",
        variant: "headline",
        wrap: "anywhere",
        children: "9,704 km northeast of your pin",
      }),
    );
    assert.ok(html.startsWith("<h2"), `expected <h2>, got: ${html.slice(0, 40)}`);
    assert.ok(html.includes('data-as="h2"'), html);
    assert.ok(html.includes('data-variant="headline"'), html);
    assert.ok(html.includes('data-wrap="anywhere"'), html);
    assert.ok(html.includes("9,704 km northeast of your pin"), html);
  });

  it("merges className after the bounded-text contract class", () => {
    const html = renderToString(
      createElement(BoundedText, { className: "verdict-headline", children: "x" }),
    );
    assert.ok(html.includes('class="bounded-text verdict-headline"'), html);
  });

  it("emits exactly bounded-text with no className", () => {
    const html = renderToString(createElement(BoundedText, { children: "x" }));
    assert.ok(html.includes('class="bounded-text"'), html);
  });

  it("spreads rest props (href/title/data-*/aria-*/tabIndex) onto the element", () => {
    const el = createElement(BoundedText<"a">, {
      as: "a",
      variant: "url",
      href: "https://example.com/very/long/source",
      target: "_blank",
      rel: "noreferrer",
      title: "full name",
      tabIndex: -1,
      "data-testid": "result-source",
      "data-name-tier": "long",
      "aria-label": "label",
      children: "example",
    });
    assert.equal(el.props.href, "https://example.com/very/long/source");
    assert.equal(el.props.target, "_blank");
    assert.equal(el.props.rel, "noreferrer");
    assert.equal(el.props.title, "full name");
    assert.equal(el.props.tabIndex, -1);
    assert.equal(el.props["data-testid"], "result-source");
    assert.equal(el.props["data-name-tier"], "long");
    assert.equal(el.props["aria-label"], "label");
  });

  it("forwards ref-as-prop (React 19, no forwardRef)", () => {
    const ref = { current: null };
    const el = createElement(BoundedText, { as: "h2", ref, children: "x" });
    assert.equal(el.ref, ref, "ref must reach the host element");
  });

  it("emits NO escape hatches: no nowrap/truncate/ellipsis/whiteSpace props", () => {
    for (const variant of ["headline", "place", "body", "url", "banner"] as const) {
      const el = createElement(BoundedText, { variant, children: "x" });
      const keys = Object.keys(el.props);
      for (const banned of ["nowrap", "truncate", "ellipsis", "whiteSpace", "textOverflow"]) {
        assert.ok(
          !keys.includes(banned),
          `variant=${variant}: component must not emit a ${banned} prop`,
        );
      }
      assert.ok(
        !String(el.props.className).includes("whitespace-nowrap"),
        `variant=${variant}: className must not smuggle whitespace-nowrap`,
      );
      assert.ok(
        !String(el.props.className).includes("truncate"),
        `variant=${variant}: className must not smuggle truncate`,
      );
    }
  });

  it("accepts dd/dt/pre/as=pre for the ledger and share block", () => {
    const ddHtml = renderToString(
      createElement(BoundedText, { as: "dd", variant: "place", children: "x" }),
    );
    assert.ok(ddHtml.startsWith("<dd"), ddHtml.slice(0, 40));
    assert.ok(ddHtml.includes('data-variant="place"'), ddHtml);
    const preHtml = renderToString(
      createElement(BoundedText, { as: "pre", variant: "url", children: "x" }),
    );
    assert.ok(preHtml.startsWith("<pre"), preHtml.slice(0, 40));
    assert.ok(preHtml.includes('data-as="pre"'), preHtml);
  });

  it("renderToString emits the contract attributes on the host element", () => {
    const html = renderToString(
      createElement(BoundedText, {
        as: "h2",
        variant: "headline",
        className: "verdict-headline",
        "data-testid": "miss-headline",
        children: "9,704 km northeast of your pin",
      }),
    );
    assert.ok(html.startsWith("<h2"), `expected <h2>, got: ${html.slice(0, 40)}`);
    assert.ok(html.includes('class="bounded-text verdict-headline"'), html);
    assert.ok(html.includes('data-as="h2"'), html);
    assert.ok(html.includes('data-variant="headline"'), html);
    assert.ok(html.includes('data-wrap="word"'), html);
    assert.ok(html.includes('data-testid="miss-headline"'), html);
    assert.ok(html.includes("9,704 km northeast of your pin"), html);
  });

  it("renderToString keeps pre newlines with data-as=pre", () => {
    const html = renderToString(
      createElement(BoundedText, {
        as: "pre",
        variant: "url",
        children: "line one\nline two",
      }),
    );
    assert.ok(html.startsWith("<pre"), html.slice(0, 40));
    assert.ok(html.includes("line one\nline two"), "pre content must keep newlines");
  });
});

describe("BoundedText — CSS text contract", () => {
  const css = readFileSync(new URL("./bounded-text.css", import.meta.url), "utf8");

  it("bakes in the four base containment declarations", () => {
    for (const decl of [
      "min-width: 0",
      "max-width: 100%",
      "white-space: normal",
      "overflow-wrap: break-word",
    ]) {
      assert.ok(css.includes(decl), `bounded-text.css must contain "${decl}"`);
    }
  });

  it("maps data-wrap=anywhere and data-as=pre", () => {
    assert.ok(css.includes('[data-wrap="anywhere"]'), "anywhere wrap rule missing");
    assert.ok(css.includes("overflow-wrap: anywhere"), "anywhere declaration missing");
    assert.ok(css.includes('[data-as="pre"]'), "pre rule missing");
    assert.ok(css.includes("white-space: pre-wrap"), "pre-wrap declaration missing");
  });

  it("defines all five variant guardrails", () => {
    for (const v of ["headline", "place", "body", "url", "banner"]) {
      assert.ok(
        css.includes(`[data-variant="${v}"]`),
        `variant rule for "${v}" missing`,
      );
    }
    assert.ok(css.includes("text-wrap: balance"), "balance missing");
    assert.ok(css.includes("text-wrap: pretty"), "pretty missing");
    assert.ok(css.includes("hyphens: none"), "headline hyphens:none missing");
  });

  it("contains NONE of the deliberate exclusions", () => {
    // Strip comments: the file documents the vetoes in prose.
    const decls = css.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!decls.includes("hyphens: auto"), "hyphens:auto is vetoed by the spec");
    assert.ok(!decls.includes("hyphens:auto"), "hyphens:auto is vetoed by the spec");
    assert.ok(!decls.includes("overflow: hidden"), "overflow:hidden is vetoed by the spec");
    assert.ok(!decls.includes("overflow:hidden"), "overflow:hidden is vetoed by the spec");
    assert.ok(!decls.includes("text-overflow: ellipsis"), "ellipsis is vetoed by the spec");
    assert.ok(!/white-space:\s*nowrap/.test(decls), "nowrap is vetoed by the spec");
  });
});
