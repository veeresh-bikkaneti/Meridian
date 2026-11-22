import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coldtrailCaseCount, getColdtrailCase } from "./cases.ts";
import { capitalsPackCaseCount, getCapitalsPackCase } from "./cases-pack.ts";

describe("coldtrail case data (moved to game/data)", () => {
  it("core deck still loads from the moved JSON", () => {
    assert.equal(coldtrailCaseCount(), 60);
    assert.ok(getColdtrailCase(0)?.caseNo);
  });
  it("capitals pack still loads from the moved JSON", () => {
    assert.ok(capitalsPackCaseCount() > 0);
    assert.ok(getCapitalsPackCase(0)?.caseNo);
  });
});
