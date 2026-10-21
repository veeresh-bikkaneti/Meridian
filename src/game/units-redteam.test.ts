import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLength, unitForLoopTarget, unitForSessionSummary } from "./units.ts";
import { preloadTerritory } from "./territory.ts";

// F2b: unitForLoopTarget reads the lazy countries-50m data (territory.ts)
// — preload it once so the Puerto Rico case below is decided by the real
// territory key (630), not by the fail-closed unloaded default.
await preloadTerritory();

describe("red-team edge cases — distance units", () => {
  it("US territory (Puerto Rico, key 630) reads km under the territory-key rule", () => {
    // San Juan, PR — a US territory, but territory key 630 != 840.
    assert.equal(unitForLoopTarget([-66.11, 18.47]), "km");
  });
  it("exact 1-unit edges format with one decimal, no singularization", () => {
    assert.equal(formatLength(1.609344, "mi"), "1.0 mi");
    assert.equal(formatLength(3.218688, "mi"), "2.0 mi");
    assert.equal(formatLength(1, "km"), "1.0 km");
  });
  it("very large distances get thousands separators in both units", () => {
    assert.equal(formatLength(16093.44, "mi"), "10,000 mi");
    assert.equal(formatLength(20000, "km"), "20,000 km");
  });
  it("sub-unit distances read ft for miles, m for km", () => {
    assert.equal(formatLength(0.5, "mi"), "1640 ft"); // 0.31 mi * 5280
    assert.equal(formatLength(0.5, "km"), "500 m");
    assert.equal(formatLength(0, "mi"), "0 ft");
  });
  it("mixed-edition session (state Nebraska + country France) fails closed to km", () => {
    assert.equal(
      unitForSessionSummary([
        { edition: "state", regionId: "nebraska" },
        { edition: "country", regionId: "france" },
      ]),
      "km",
    );
  });
  it("US country run + state runs in one session reads miles", () => {
    assert.equal(
      unitForSessionSummary([
        { edition: "country", regionId: "united-states" },
        { edition: "state", regionId: "texas" },
      ]),
      "mi",
    );
  });
  it("non-finite input never renders a bogus unit", () => {
    assert.equal(formatLength(NaN, "mi"), "—");
    assert.equal(formatLength(Infinity, "km"), "—");
  });
});
