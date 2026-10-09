import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { ComponentType } from "react";
import {
  getObservability,
  resetObservabilityForTests,
} from "./observability.ts";

const require = createRequire(import.meta.url);
const ts: typeof import("typescript") = require("typescript");

// ---------------------------------------------------------------------------
// Minimal DOM shim — just enough for react-dom/client createRoot().render().
// No jsdom/happy-dom in this repo; the shim covers element/text/comment
// creation, attribute + child manipulation, and no-op event listeners.
// ---------------------------------------------------------------------------

class FakeStyle {
  private props = new Map<string, string>();
  setProperty(name: string, value: string): void {
    this.props.set(name, String(value));
  }
  removeProperty(name: string): void {
    this.props.delete(name);
  }
  get cssText(): string {
    return [...this.props.entries()].map(([k, v]) => `${k}:${v}`).join(";");
  }
}

class FakeNode {
  readonly nodeType: number;
  readonly nodeName: string;
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  ownerDocument: FakeDocument;
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(nodeType: number, nodeName: string, ownerDocument: FakeDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
  }
  appendChild<T extends FakeNode>(child: T): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore<T extends FakeNode>(child: T, before: FakeNode | null): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const idx = before ? this.childNodes.indexOf(before) : -1;
    if (idx >= 0) this.childNodes.splice(idx, 0, child);
    else this.childNodes.push(child);
    return child;
  }
  removeChild<T extends FakeNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  addEventListener(type: string, fn: (...args: unknown[]) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: (...args: unknown[]) => void): void {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((f) => f !== fn));
  }
  dispatchEvent(): boolean {
    return true;
  }
  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null;
    const sibs = this.parentNode.childNodes;
    return sibs[sibs.indexOf(this) + 1] ?? null;
  }
  contains(node: FakeNode): boolean {
    let cur: FakeNode | null = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }
  get textContent(): string | null {
    return this.childNodes.map((c) => c.textContent ?? "").join("");
  }
}

class FakeElement extends FakeNode {
  readonly tagName: string;
  readonly namespaceURI: string | null;
  readonly attributes = new Map<string, string>();
  readonly style = new FakeStyle();

  constructor(
    tagName: string,
    namespaceURI: string | null,
    ownerDocument: FakeDocument,
  ) {
    super(1, tagName.toUpperCase(), ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.namespaceURI = namespaceURI;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
  setAttributeNS(_ns: string | null, name: string, value: string): void {
    this.setAttribute(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  removeAttributeNS(_ns: string | null, name: string): void {
    this.removeAttribute(name);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  set className(v: string) {
    this.setAttribute("class", v);
  }
  get className(): string {
    return this.attributes.get("class") ?? "";
  }
  set textContent(v: string | null) {
    this.childNodes = [];
    if (v !== null && v !== undefined && v !== "") {
      this.appendChild(this.ownerDocument.createTextNode(v));
    }
  }
  get textContent(): string | null {
    return this.childNodes.map((c) => c.textContent ?? "").join("");
  }
  // React treats these as present on a usable host element.
  get isConnected(): boolean {
    return true;
  }
}

class FakeText extends FakeNode {
  nodeValue: string;
  constructor(text: string, ownerDocument: FakeDocument) {
    super(3, "#text", ownerDocument);
    this.nodeValue = text;
  }
  get textContent(): string {
    return this.nodeValue;
  }
  set textContent(v: string) {
    this.nodeValue = v;
  }
  get data(): string {
    return this.nodeValue;
  }
  set data(v: string) {
    this.nodeValue = v;
  }
}

class FakeComment extends FakeNode {
  nodeValue: string;
  constructor(text: string, ownerDocument: FakeDocument) {
    super(8, "#comment", ownerDocument);
    this.nodeValue = text;
  }
  get textContent(): string {
    return this.nodeValue;
  }
}

class FakeDocumentFragment extends FakeNode {
  constructor(ownerDocument: FakeDocument) {
    super(11, "#document-fragment", ownerDocument);
  }
}

class FakeDocument extends FakeNode {
  body: FakeElement;
  head: FakeElement;
  documentElement: FakeElement;
  constructor() {
    super(9, "#document", null as unknown as FakeDocument);
    this.ownerDocument = this;
    const xhtml = "http://www.w3.org/1999/xhtml";
    this.documentElement = new FakeElement("html", xhtml, this);
    this.head = new FakeElement("head", xhtml, this);
    this.body = new FakeElement("body", xhtml, this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, "http://www.w3.org/1999/xhtml", this);
  }
  createElementNS(ns: string | null, tagName: string): FakeElement {
    return new FakeElement(tagName, ns, this);
  }
  createTextNode(text: string): FakeText {
    return new FakeText(text, this);
  }
  createComment(text: string): FakeComment {
    return new FakeComment(text, this);
  }
  createDocumentFragment(): FakeDocumentFragment {
    return new FakeDocumentFragment(this);
  }
  get activeElement(): FakeElement | null {
    return null;
  }
}

const doc = new FakeDocument();
const g = globalThis as unknown as Record<string, unknown>;
g.window = g;
g.document = doc;
// Fake a mobile Safari UA so the emit path exercises the real
// coarseDeviceFacts() bucketing (ios/mobile), not the "other" fallback.
Object.defineProperty(g, "navigator", {
  value: {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  },
  configurable: true,
  writable: true,
});
g.requestAnimationFrame = (cb: (t: number) => void): number =>
  setTimeout(() => cb(Date.now()), 16) as unknown as number;
g.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};
g.IS_REACT_ACT_ENVIRONMENT = true;
// React checks `element instanceof containerInfo.HTMLIFrameElement` during
// commit; it only needs to be a constructor (always false here).
g.HTMLIFrameElement = class HTMLIFrameElement extends FakeElement {
  constructor(ownerDocument: FakeDocument) {
    super("iframe", "http://www.w3.org/1999/xhtml", ownerDocument);
  }
};
(doc as unknown as { defaultView: unknown }).defaultView = g;

// ---------------------------------------------------------------------------
// Load the real .tsx component: node can't import .tsx directly, so transpile
// with the repo's own TypeScript and import via a data: URL. Bare/relative
// specifiers are rewritten to absolute file URLs so the component shares the
// exact same module instances (react, observability) as this test.
// ---------------------------------------------------------------------------

type ErrorComponentModule = {
  AppErrorComponent: ComponentType<{ error: unknown }>;
};

let cachedModule: ErrorComponentModule | null = null;

async function loadErrorComponent(): Promise<ErrorComponentModule> {
  if (cachedModule) return cachedModule;
  const here = dirname(fileURLToPath(import.meta.url));
  const src = await readFile(join(here, "error-component.tsx"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    fileName: "error-component.tsx",
  });
  let code = out.outputText;
  const replacements: Array<[string, string]> = [
    [
      '"react/jsx-runtime"',
      JSON.stringify(await import.meta.resolve("react/jsx-runtime")),
    ],
    ['"react"', JSON.stringify(await import.meta.resolve("react"))],
    [
      '"lucide-react"',
      JSON.stringify(await import.meta.resolve("lucide-react")),
    ],
    [
      '"./observability"',
      JSON.stringify(new URL("./observability.ts", import.meta.url).href),
    ],
  ];
  for (const [from, to] of replacements) {
    code = code.split(from).join(to);
  }
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(code, "utf8").toString("base64")}`
  )) as ErrorComponentModule;
  assert.equal(
    typeof mod.AppErrorComponent,
    "function",
    "error-component.tsx must export AppErrorComponent",
  );
  cachedModule = mod;
  return mod;
}

async function mountWithError(error: unknown): Promise<{
  rerender: (next: unknown) => Promise<void>;
  unmount: () => Promise<void>;
}> {
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { jsx } = await import("react/jsx-runtime");
  const { AppErrorComponent } = await loadErrorComponent();
  const container = doc.createElement("div");
  doc.body.appendChild(container);
  // createRoot's container type is Element; our shim is structurally complete.
  const root = createRoot(container as unknown as Element);
  const renderOnce = async (e: unknown): Promise<void> => {
    await act(async () => {
      root.render(jsx(AppErrorComponent, { error: e }));
    });
  };
  await renderOnce(error);
  return {
    rerender: renderOnce,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      doc.body.removeChild(container);
    },
  };
}

const queueLength = (): number => getObservability().getQueueLength();

describe("AppErrorComponent route-error telemetry", () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  it("emits exactly one js_error when a route error renders", async () => {
    const { unmount } = await mountWithError(new Error("route boom"));
    try {
      assert.equal(queueLength(), 1);
    } finally {
      await unmount();
    }
  });

  it("does not re-emit when the same error re-renders", async () => {
    const err = new Error("same error");
    const { rerender, unmount } = await mountWithError(err);
    try {
      assert.equal(queueLength(), 1);
      await rerender(err);
      assert.equal(queueLength(), 1);
    } finally {
      await unmount();
    }
  });

  it("emits again for a distinct route error", async () => {
    const { rerender, unmount } = await mountWithError(new Error("first"));
    try {
      assert.equal(queueLength(), 1);
      await rerender(new Error("second"));
      assert.equal(queueLength(), 2);
    } finally {
      await unmount();
    }
  });

  it("emits nothing when the boundary never renders", () => {
    assert.equal(queueLength(), 0);
  });
});
