import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLAG_ENTRIES } from "./registry.generated.ts";
import { flagEntry } from "../flag-registry.ts";

describe("flags registry.generated (moved to lib)", () => {
  it("flag-registry reads the moved module", () => {
    assert.ok(Object.keys(FLAG_ENTRIES).length > 50);
    assert.equal(flagEntry("ae")?.land, "United Arab Emirates");
  });
});
