import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TILE_FALLBACK_COPY } from "./tile-fallback-copy.ts";
import { TILE_FALLBACK_COPY as VIA_SHIM } from "../map/tile-fallback-copy.ts";

describe("tile-fallback-copy (moved to lib)", () => {
  it("the map shim re-exports the same copy object", () => {
    assert.equal(VIA_SHIM, TILE_FALLBACK_COPY);
  });
});
