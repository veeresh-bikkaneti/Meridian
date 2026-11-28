/**
 * SiteHeaderNav: the More split keeps the first links inline and
 * moves the rest behind the More button. The overflow measurement
 * itself needs a laid-out DOM, so the node harness tests the split
 * and both rendered modes (the row is mode-driven for exactly this).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MORE_VISIBLE_COUNT,
  SiteHeaderNav,
  SiteHeaderNavRow,
  splitNavItems,
} from "./site-header-nav.ts";

function link(label: string) {
  return createElement("button", { type: "button", className: "site-header-nav-link" }, label);
}

const SEVEN = ["A", "B", "C", "D", "E", "F", "G"].map(link);

describe("splitNavItems", () => {
  it("keeps the first links inline, the rest behind More", () => {
    const { visible, rest } = splitNavItems(SEVEN);
    assert.equal(visible.length, MORE_VISIBLE_COUNT);
    assert.equal(rest.length, SEVEN.length - MORE_VISIBLE_COUNT);
  });

  it("a short nav has nothing behind More", () => {
    const { visible, rest } = splitNavItems(SEVEN.slice(0, 2));
    assert.equal(visible.length, 2);
    assert.equal(rest.length, 0);
  });
});

describe("SiteHeaderNavRow", () => {
  it("full mode: every link inline, no More button", () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeaderNavRow, {
        items: SEVEN,
        mode: "full",
        moreOpen: false,
        onMoreToggle: () => {},
        navRef: { current: null },
      }),
    );
    for (const label of ["A", "B", "C", "D", "E", "F", "G"]) assert.match(html, new RegExp(`>${label}<`));
    assert.doesNotMatch(html, />More</);
  });

  it("more mode: first links inline, More button, rest in the drawer", () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeaderNavRow, {
        items: SEVEN,
        mode: "more",
        moreOpen: true,
        onMoreToggle: () => {},
        navRef: { current: null },
      }),
    );
    assert.match(html, />More</);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /site-header-more-panel/);
    // The rest live in the drawer (after the More button in the markup).
    const drawerAt = html.indexOf("site-header-more-panel");
    for (const label of ["E", "F", "G"]) assert.ok(html.indexOf(`>${label}<`, drawerAt) > drawerAt);
  });

  it("more mode, drawer closed: the rest are not rendered", () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeaderNavRow, {
        items: SEVEN,
        mode: "more",
        moreOpen: false,
        onMoreToggle: () => {},
        navRef: { current: null },
      }),
    );
    assert.match(html, />More</);
    assert.doesNotMatch(html, /site-header-more-panel/);
  });
});

describe("SiteHeaderNav", () => {
  it("initial render is the full row (the measurement runs in the browser)", () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeaderNav, { navNode: createElement("span", null, SEVEN) }),
    );
    for (const label of ["A", "B", "C", "D", "E", "F", "G"]) assert.match(html, new RegExp(`>${label}<`));
    assert.doesNotMatch(html, />More</);
  });
});
