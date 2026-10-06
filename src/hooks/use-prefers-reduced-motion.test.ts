import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  REDUCED_MOTION_QUERY,
  usePrefersReducedMotion,
} from "./use-prefers-reduced-motion.ts";

/**
 * The hook is exercised through a tiny probe component rendered with
 * react-dom/server (no jsdom in the repo's node:test harness). Effects do
 * not run in SSR, so this covers the initial value + SSR safety; the change
 * listener is covered by the prefers-reduced-motion E2E pass.
 */

function Probe() {
  const reduced = usePrefersReducedMotion();
  return createElement("span", null, String(reduced));
}

function stubMatchMedia(matches: boolean): void {
  (globalThis as { window?: unknown }).window = {
    matchMedia: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
}

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("usePrefersReducedMotion", () => {
  it("exports the reduce query", () => {
    assert.equal(REDUCED_MOTION_QUERY, "(prefers-reduced-motion: reduce)");
  });

  it("returns a boolean reflecting the media query", () => {
    stubMatchMedia(true);
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>true<\/span>/);
    stubMatchMedia(false);
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>false<\/span>/);
  });

  it("is SSR-safe: returns false and never throws without a window", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>false<\/span>/);
  });
});
