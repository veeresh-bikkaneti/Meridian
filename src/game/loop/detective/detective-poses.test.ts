import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOLMES_POSES, WATSON_POSES } from "./detective-poses.ts";

describe("detective-poses (extracted from DetectivePair)", () => {
  it("pose arrays keep their contents and order", () => {
    assert.equal(HOLMES_POSES.length, 12);
    assert.equal(WATSON_POSES.length, 10);
    assert.equal(HOLMES_POSES[0], "dock");
  });
});
