import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assetBase } from "./asset-base.ts";
import { assetBase as assetBaseViaLines } from "../components/storyteller-lines.ts";

describe("asset-base (extracted to lib)", () => {
  it("storyteller-lines re-exports the same function", () => {
    assert.equal(assetBaseViaLines, assetBase);
    assert.ok(assetBase().endsWith("/"));
  });
});
