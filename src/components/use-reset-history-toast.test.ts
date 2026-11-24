import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RESET_HISTORY_SUCCESS_TOAST,
  useResetHistoryToast,
} from "./use-reset-history-toast.ts";

/**
 * The hook is exercised through a tiny probe component rendered with
 * react-dom/server (no jsdom in the repo's node:test harness). Effects
 * do not run in SSR, so this covers the initial values + SSR safety;
 * the reset flow itself is covered by the reset-history E2E pass.
 */

function Probe() {
  const { resetToast, historyResetEpoch, showResetSuccess } = useResetHistoryToast();
  return createElement(
    "span",
    null,
    `${resetToast}:${historyResetEpoch}:${typeof showResetSuccess}`,
  );
}

describe("useResetHistoryToast", () => {
  it("starts with no toast and epoch 0, with a show callback", () => {
    assert.match(
      renderToStaticMarkup(createElement(Probe)),
      /<span>null:0:function<\/span>/,
    );
  });

  it("is SSR-safe: never throws without a browser environment", () => {
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));
  });

  it("keeps the locked success toast copy verbatim (manifest 2026-10-28 §4)", () => {
    assert.equal(RESET_HISTORY_SUCCESS_TOAST, "All cleared. You are starting fresh.");
  });
});
