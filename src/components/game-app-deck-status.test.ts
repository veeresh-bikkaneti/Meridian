import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDeckStatus } from "./game-app-deck-status.ts";

function Probe() {
  const status = useDeckStatus(null, 0);
  return createElement("span", null, `${status.enabled}:${status.due}:${status.total}`);
}

describe("useDeckStatus", () => {
  it("starts with the deck entry disabled (SSR probe, effects do not run)", () => {
    assert.equal(
      renderToStaticMarkup(createElement(Probe)),
      '<span>false:0:0</span>',
    );
  });
});
