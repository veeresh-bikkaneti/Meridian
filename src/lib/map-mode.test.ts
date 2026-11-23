import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MapMode } from "./map-mode.ts";
import type { MapMode as MapModeFromCapability } from "../map/capability.ts";

describe("map-mode (extracted to lib)", () => {
  it("capability's re-export is the same type as lib's", () => {
    const a: MapMode = "scout";
    const b: MapModeFromCapability = a;
    const c: MapMode = b;
    assert.equal(c, "scout");
  });
});
