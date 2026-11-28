/**
 * SiteHeaderDrawer: closed renders nothing, open renders the panel;
 * Escape closes and Tab cycles, via the pure handlePanelKeyDown
 * (the node harness has no DOM, so the key handling is tested as a
 * function, not through a browser event).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeaderDrawer, handlePanelKeyDown } from "./site-header-drawer.ts";

describe("SiteHeaderDrawer", () => {
  it("closed: renders nothing", () => {
    const html = renderToStaticMarkup(
      createElement(
        SiteHeaderDrawer,
        { open: false, onClose: () => {} },
        createElement("a", { href: "#x", className: "site-header-nav-link" }, "X"),
      ),
    );
    assert.equal(html, "");
  });

  it("open: renders the panel with its links", () => {
    const html = renderToStaticMarkup(
      createElement(
        SiteHeaderDrawer,
        { open: true, onClose: () => {} },
        createElement("a", { href: "#x", className: "site-header-nav-link" }, "X"),
      ),
    );
    assert.match(html, /site-header-panel/);
    assert.match(html, />X</);
  });

  it("Escape calls onClose", () => {
    let closed = 0;
    const panel = { contains: () => true, querySelectorAll: () => [] } as unknown as HTMLElement;
    handlePanelKeyDown(
      { key: "Escape", preventDefault: () => {}, stopPropagation: () => {} },
      panel,
      null,
      () => {
        closed += 1;
      },
    );
    assert.equal(closed, 1);
  });

  it("a non-Escape, non-Tab key does nothing", () => {
    let closed = 0;
    handlePanelKeyDown({ key: "a", preventDefault: () => {} }, null, null, () => {
      closed += 1;
    });
    assert.equal(closed, 0);
  });

  it("Tab on the last item wraps to the first", () => {
    const focused: string[] = [];
    const mk = (name: string) => ({
      focus: () => {
        focused.push(name);
      },
      getClientRects: () => [{ width: 1 }],
    });
    const first = mk("first");
    const last = mk("last");
    const panel = {
      contains: () => true,
      querySelectorAll: () => [first, last],
    } as unknown as HTMLElement;
    let prevented = false;
    handlePanelKeyDown(
      { key: "Tab", preventDefault: () => { prevented = true; } },
      panel,
      last as unknown as Element,
      () => {},
    );
    assert.equal(prevented, true);
    assert.deepEqual(focused, ["first"]);
  });

  it("Shift+Tab on the first item wraps to the last", () => {
    const focused: string[] = [];
    const mk = (name: string) => ({
      focus: () => {
        focused.push(name);
      },
      getClientRects: () => [{ width: 1 }],
    });
    const first = mk("first");
    const last = mk("last");
    const panel = {
      contains: () => true,
      querySelectorAll: () => [first, last],
    } as unknown as HTMLElement;
    let prevented = false;
    handlePanelKeyDown(
      { key: "Tab", shiftKey: true, preventDefault: () => { prevented = true; } },
      panel,
      first as unknown as Element,
      () => {},
    );
    assert.equal(prevented, true);
    assert.deepEqual(focused, ["last"]);
  });
});
