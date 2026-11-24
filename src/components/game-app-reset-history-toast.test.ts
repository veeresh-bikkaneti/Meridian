import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RESET_HISTORY_SUCCESS_TOAST,
  useHistoryResetToast,
} from "./game-app-reset-history-toast.ts";

function Probe() {
  const { resetToast, historyResetEpoch } = useHistoryResetToast();
  return createElement("span", null, `${resetToast ?? "none"}:${historyResetEpoch}`);
}

describe("useHistoryResetToast", () => {
  it("starts with no toast and epoch zero (SSR probe, effects do not run)", () => {
    assert.equal(
      renderToStaticMarkup(createElement(Probe)),
      '<span>none:0</span>',
    );
  });

  it("keeps the locked success toast copy", () => {
    assert.equal(RESET_HISTORY_SUCCESS_TOAST, "All cleared. You are starting fresh.");
  });
});
