import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDeckStatus } from "./use-deck-status.ts";

/**
 * The hook is exercised through a tiny probe component rendered with
 * react-dom/server (no jsdom in the repo's node:test harness). Effects
 * do not run in SSR, so this covers the initial value + SSR safety;
 * the flag/deck read itself is wired exactly as it ran inside
 * game-app.tsx and is covered by the picker E2E pass.
 */

function Probe() {
  const status = useDeckStatus(null, 0);
  return createElement(
    "span",
    null,
    `${status.enabled}:${status.due}:${status.total}`,
  );
}

describe("useDeckStatus", () => {
  it("starts disabled with an empty deck before the effect runs", () => {
    assert.match(renderToStaticMarkup(createElement(Probe)), /<span>false:0:0<\/span>/);
  });

  it("is SSR-safe: never throws without a browser environment", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
  });
});
