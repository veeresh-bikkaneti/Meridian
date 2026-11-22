import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IMAGERY_TILES } from "./imagery.ts";
import { IMAGERY_TILES as IMAGERY_TILES_VIA_SHIM } from "../map/imagery.ts";

describe("imagery (moved to lib)", () => {
  it("the map shim re-exports the same tiles value", () => {
    assert.equal(IMAGERY_TILES_VIA_SHIM, IMAGERY_TILES);
    assert.ok(IMAGERY_TILES.length > 0);
  });
});
