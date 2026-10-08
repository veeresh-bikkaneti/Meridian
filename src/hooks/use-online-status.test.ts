import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useOnlineStatus } from "./use-online-status.ts";

/**
 * The hook is exercised through a tiny probe component rendered with
 * react-dom/server (no jsdom in the repo's node:test harness). Effects do
 * not run in SSR, so this covers the initial value + SSR safety; the
 * online/offline listeners are wired per the usePrefersReducedMotion
 * pattern (change subscription covered by the loop-offline E2E pass).
 */

function Probe() {
  const online = useOnlineStatus();
  return createElement("span", null, String(online));
}

const realNavigator = (globalThis as { navigator?: unknown }).navigator;

function stubNavigator(onLine: unknown): void {
  (globalThis as { navigator?: unknown }).navigator = { onLine };
}

beforeEach(() => {
  delete (globalThis as { navigator?: unknown }).navigator;
});

afterEach(() => {
  if (realNavigator === undefined) {
    delete (globalThis as { navigator?: unknown }).navigator;
  } else {
    (globalThis as { navigator?: unknown }).navigator = realNavigator;
  }
});

describe("useOnlineStatus", () => {
  it("reflects navigator.onLine", () => {
    stubNavigator(true);
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>true<\/span>/);
    stubNavigator(false);
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>false<\/span>/);
  });

  it("is SSR-safe: reads as online (fail-open) and never throws without navigator", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>true<\/span>/);
  });

  it("is SSR-safe when navigator.onLine is not a boolean", () => {
    stubNavigator(undefined);
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>true<\/span>/);
  });
});
