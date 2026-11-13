/**
 * HomeButton renders one name, "Home", in both modes: a <button> for the
 * in-app screens and a router <Link> for the real routes. Rendered with
 * react-dom/server (the repo's node harness has no DOM); the link mode
 * runs inside a real memory router.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { HomeButton, HOME_LABEL } from "./home-button.ts";

/** Visible text with aria-hidden subtrees removed: what a screen reader names it. */
function accessibleText(html: string): string {
  return html
    .replace(/<svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

describe("HomeButton", () => {
  it("HOME_LABEL is exactly Home", () => {
    assert.equal(HOME_LABEL, "Home");
  });

  it("button mode: a type=button named exactly Home, icon hidden, no aria-label, 44px floor", () => {
    const html = renderToStaticMarkup(createElement(HomeButton, { onHome: () => {} }));
    assert.match(html, /^<button type="button"/);
    assert.equal(accessibleText(html), "Home");
    assert.doesNotMatch(html, /aria-label=/);
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /min-h-11/);
    assert.match(html, /min-w-11/);
    assert.match(html, /focus-visible:outline-2/);
  });

  it("link mode: an <a href=\"/\"> named exactly Home inside a router", async () => {
    const root = createRootRoute({ component: () => createElement(HomeButton, { to: "/" }) });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/credits"] }),
    });
    await router.load();
    const html = renderToStaticMarkup(createElement(RouterProvider, { router } as never));
    assert.match(html, /<a [^>]*href="\/"/);
    assert.doesNotMatch(html, /<button/);
    assert.equal(accessibleText(html), "Home");
    assert.doesNotMatch(html, /aria-label=/);
    assert.match(html, /data-testid="home-button"/);
  });

  it("a second Home on one screen can carry its own test id, same name", () => {
    const html = renderToStaticMarkup(
      createElement(HomeButton, { onHome: () => {}, testId: "home-button-end", variant: "primary" }),
    );
    assert.match(html, /data-testid="home-button-end"/);
    assert.equal(accessibleText(html), "Home");
  });
});
