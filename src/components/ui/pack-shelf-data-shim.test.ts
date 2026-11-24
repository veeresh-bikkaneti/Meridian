import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deckLabelForId } from "./pack-shelf-data.ts";

// Non-literal specifier: tsc must not resolve this, the shim file is deleted.
const SHIM_PACK_SHELF_DATA = "../pack-shelf-data.ts";


describe("pack-shelf-data canonical module", () => {
  it("exports the deck label helper", () => {
    assert.equal(typeof deckLabelForId("capitals"), "string");
  });

  it("the deleted components-root shim no longer resolves", async () => {
    await assert.rejects(import(SHIM_PACK_SHELF_DATA));
  });

});
