/**
 * Contract constants for the landmark globe (docs/mockups/
 * landmark-globe-contract.md sections 3.1-3.5). These pin the approved
 * values so a tuning change has to update the contract on purpose.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GLOBE_CONTRACT as C, LANDMARKS, PALETTE } from "./globe-contract.ts";

describe("globe contract — scene and motion constants", () => {
  it("scene values match section 3.1 and 3.2", () => {
    assert.equal(C.radius, 1);
    assert.deepEqual([...C.segments.full], [64, 48]);
    assert.deepEqual([...C.segments.small], [32, 24]);
    assert.equal(C.smallBelowPx, 280);
    assert.equal(C.dprCap, 1.5);
    assert.equal(C.fov, 34);
    assert.equal(C.axialTiltDeg, 23.44);
    assert.equal(C.viewerPitch, 0.12);
    assert.equal(C.startLongitudeDeg, 20);
    assert.equal(C.halo.strength, 0.5);
    assert.equal(C.halo.radius, 1.09);
    assert.equal(C.ring.radius, 1.42);
    assert.equal(C.ring.opacity, 0.45);
    assert.equal(C.plane.speed, 0.35);
  });

  it("motion values match section 3.5", () => {
    assert.equal(C.zoom.start, 5.6);
    assert.equal(C.zoom.min, 3.4);
    assert.equal(C.zoom.max, 8.5);
    assert.equal(C.dragSens, 0.005);
    assert.equal(C.keySpin, 0.18);
    assert.equal(C.inertiaDamp, 0.92);
    assert.equal(C.inertiaStop, 0.02);
    assert.equal(C.inertiaCap, 6);
    assert.equal(C.autoSpin, 0.12);
    assert.equal(C.resumeAfter, 3.0);
    assert.equal(C.resumeRamp, 1.5);
    assert.equal(C.uprightEase, 0.8);
    assert.equal(C.riseSeconds, 0.8);
  });
});

describe("globe contract — landmarks", () => {
  it("has the twelve landmarks at their contract scales", () => {
    assert.equal(LANDMARKS.length, 12);
    const byId = new Map(LANDMARKS.map((l) => [l.id, l]));
    assert.equal(byId.get("eiffel")?.scale, 0.22);
    assert.equal(byId.get("bigben")?.scale, 0.19);
    assert.equal(byId.get("liberty")?.scale, 0.22);
    assert.equal(byId.get("opera")?.scale, 0.3);
    for (const lm of LANDMARKS) {
      assert.ok(lm.color in PALETTE, `${lm.id} uses a palette colour`);
      assert.ok(lm.scale > 0 && lm.scale <= 0.3, `${lm.id} scale in range`);
    }
  });

  it("Europe is drawn at the nudged spots, Colosseum restyled", () => {
    const byId = new Map(LANDMARKS.map((l) => [l.id, l]));
    assert.deepEqual(
      [byId.get("eiffel")?.drawnLat, byId.get("eiffel")?.drawnLon],
      [47.0, 2.8],
    );
    assert.deepEqual(
      [byId.get("bigben")?.drawnLat, byId.get("bigben")?.drawnLon],
      [53.0, -2.0],
    );
    const colosseum = byId.get("colosseum");
    assert.deepEqual([colosseum?.drawnLat, colosseum?.drawnLon], [40.5, 15.0]);
    assert.equal(colosseum?.scale, 0.25, "restyled Colosseum scale");
    assert.equal(colosseum?.color, "sandstone", "restyled Colosseum colour");
    // Everywhere else the drawn spot is the real spot.
    for (const lm of LANDMARKS) {
      if (["eiffel", "bigben", "colosseum"].includes(lm.id)) continue;
      assert.equal(lm.drawnLat, lm.lat, `${lm.id} drawn at its real latitude`);
      assert.equal(lm.drawnLon, lm.lon, `${lm.id} drawn at its real longitude`);
    }
  });
});
