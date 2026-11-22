import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LANDMARKS } from "./globe-contract.ts";
import { buildLandmark, createMaterialFactory } from "./landmark-models.ts";

describe("landmark-models (moved to lib)", () => {
  it("builds a three.js group for the first landmark spec", () => {
    const group = buildLandmark(createMaterialFactory(), LANDMARKS[0]);
    assert.equal(group.type, "Group");
    assert.ok(group.children.length > 0);
  });
});
