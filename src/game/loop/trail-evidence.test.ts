import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TrailEvidenceMark, TrailEvidenceRing } from "./trail-evidence.ts";
import type { TrailEvidenceMark as MarkViaLoopMap, TrailEvidenceRing as RingViaLoopMap } from "./LoopMap.tsx";

describe("trail-evidence (extracted from LoopMap)", () => {
  it("LoopMap's re-exports accept the same objects placement builds", () => {
    const ring: TrailEvidenceRing = { lon: 1, lat: 2, radiusKm: 3, label: "x" };
    const mark: TrailEvidenceMark = { lon: 1, lat: 2, kind: "x" };
    const ring2: RingViaLoopMap = ring;
    const mark2: MarkViaLoopMap = mark;
    assert.equal(ring2.radiusKm, 3);
    assert.equal(mark2.kind, "x");
  });
});
