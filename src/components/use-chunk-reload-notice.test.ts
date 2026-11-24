import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useChunkReloadNotice } from "./use-chunk-reload-notice.ts";

/**
 * The hook is exercised through a tiny probe component rendered with
 * react-dom/server (no jsdom in the repo's node:test harness). Effects
 * and callbacks cannot fire in SSR, so this covers the initial value +
 * SSR safety; the consume behaviour itself is the chunk-recovery
 * module's, covered by src/lib/chunk-recovery.test.ts.
 */

function Probe() {
  const { chunkReloadNotice, consumeChunkReloadNoticeOnce, dismissChunkReloadNotice } =
    useChunkReloadNotice();
  return createElement(
    "span",
    null,
    `${chunkReloadNotice}:${typeof consumeChunkReloadNoticeOnce}:${typeof dismissChunkReloadNotice}`,
  );
}

describe("useChunkReloadNotice", () => {
  it("starts with no notice showing, with consume and dismiss callbacks", () => {
    assert.match(
      renderToStaticMarkup(createElement(Probe)),
      /<span>false:function:function<\/span>/,
    );
  });

  it("is SSR-safe: never throws without a browser environment", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
  });
});
