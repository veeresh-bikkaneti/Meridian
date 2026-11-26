import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DifficultyPicker } from "./difficulty-picker.ts";

/**
 * The picker is exercised through renderToStaticMarkup (no jsdom in
 * the repo's node:test harness): effects do not run in SSR, so this
 * covers the rendered a11y shape — group name, aria-pressed, live
 * hint — and that the pressed pill follows the module's stored
 * choice. The chirp-on-change guard lives in the onClick and is the
 * same guard the home hero used (re-tapping the active band stays
 * silent); it is verified by read-back of the source's behaviour
 * contract, not by a click the harness cannot fire.
 */

const globals = globalThis as { localStorage?: unknown };
const hadLocalStorage = "localStorage" in globals;
const originalLocalStorage = globals.localStorage;

function stubLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial));
  globals.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  return store;
}

beforeEach(() => {
  stubLocalStorage();
});

afterEach(() => {
  if (hadLocalStorage) globals.localStorage = originalLocalStorage;
  else delete globals.localStorage;
});

describe("DifficultyPicker (FW-11.1)", () => {
  it("renders the labelled group, three pills, and the medium hint by default", () => {
    const html = renderToStaticMarkup(
      createElement(DifficultyPicker, { moduleId: "globe", testId: "tour-stop-difficulty" }),
    );
    assert.match(html, /data-testid="tour-stop-difficulty"/);
    assert.match(html, /id="difficulty-label-globe"/);
    assert.match(html, /How do you want to grow your map today\?/);
    assert.match(html, /role="group" aria-labelledby="difficulty-label-globe"/);
    assert.match(html, />Easy<\/button>/);
    assert.match(html, />Medium<\/button>/);
    assert.match(html, />Hard<\/button>/);
    // Medium is the default: only its pill is pressed.
    assert.match(html, /aria-pressed="true">Medium<\/button>/);
    assert.match(html, /aria-pressed="false">Easy<\/button>/);
    assert.match(html, /aria-pressed="false">Hard<\/button>/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /A little of everything — grow your map one discovery at a time\./);
  });

  it("presses the pill that matches the module's stored choice", () => {
    stubLocalStorage({
      "meridian.difficulty.byModule": JSON.stringify({ globe: "hard", country: "easy" }),
    });
    const globe = renderToStaticMarkup(
      createElement(DifficultyPicker, { moduleId: "globe" }),
    );
    assert.match(globe, /aria-pressed="true">Hard<\/button>/);
    assert.match(globe, /Hidden corners of the world — for explorers ready to discover more\./);
    const country = renderToStaticMarkup(
      createElement(DifficultyPicker, { moduleId: "country" }),
    );
    assert.match(country, /aria-pressed="true">Easy<\/button>/);
    assert.match(country, /Famous places — the spots every explorer starts with\./);
  });

  it("accepts a label id override", () => {
    const html = renderToStaticMarkup(
      createElement(DifficultyPicker, { moduleId: "state", labelId: "custom-label" }),
    );
    assert.match(html, /id="custom-label"/);
    assert.match(html, /aria-labelledby="custom-label"/);
  });
});
