import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deckLabelForId } from "./pack-shelf-data.ts";
import { deckLabelForId as viaShim } from "../pack-shelf-data.ts";
import { createCelebrationLinePlayer } from "./summary-celebration-line.ts";
import { createCelebrationLinePlayer as playerViaShim } from "../summary-celebration-line.ts";

describe("ui moves keep their old paths working", () => {
  it("pack-shelf-data shim re-exports the same function", () => {
    assert.equal(viaShim, deckLabelForId);
    assert.equal(typeof deckLabelForId("capitals"), "string");
  });
  it("summary-celebration-line shim re-exports the same factory", () => {
    assert.equal(playerViaShim, createCelebrationLinePlayer);
  });
});
