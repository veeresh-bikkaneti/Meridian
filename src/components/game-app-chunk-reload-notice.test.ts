import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useChunkReloadNotice } from "./game-app-chunk-reload-notice.ts";

function Probe() {
  const { chunkReloadNotice } = useChunkReloadNotice();
  return createElement("span", null, String(chunkReloadNotice));
}

describe("useChunkReloadNotice", () => {
  it("starts hidden (SSR probe, effects do not run)", () => {
    assert.equal(renderToStaticMarkup(createElement(Probe)), "<span>false</span>");
  });
});
