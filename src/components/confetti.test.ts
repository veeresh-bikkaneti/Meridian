import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveParticleCap, type ParticleCapEnv } from "./particle-caps.ts";

const desktop: ParticleCapEnv = {
  finePointer: true,
  narrowViewport: false,
  lowEnd: false,
  reducedMotion: false,
};

describe("resolveParticleCap — device tiers (spec §7.3)", () => {
  it("120 on a capable desktop (fine pointer, deviceMemory ≥ 4)", () => {
    assert.equal(resolveParticleCap(desktop), 120);
  });

  it("60 on coarse pointers (touch) and on narrow viewports", () => {
    assert.equal(resolveParticleCap({ ...desktop, finePointer: false }), 60);
    assert.equal(resolveParticleCap({ ...desktop, narrowViewport: true }), 60);
    assert.equal(
      resolveParticleCap({ ...desktop, finePointer: false, narrowViewport: true }),
      60,
    );
  });

  it("30 on low-end devices (deviceMemory < 4 or hardwareConcurrency ≤ 2)", () => {
    assert.equal(resolveParticleCap({ ...desktop, lowEnd: true }), 30);
  });

  it("0 under reduced-motion, no matter the device", () => {
    assert.equal(resolveParticleCap({ ...desktop, reducedMotion: true }), 0);
    assert.equal(
      resolveParticleCap({ ...desktop, reducedMotion: true, lowEnd: true }),
      0,
    );
    assert.equal(
      resolveParticleCap({ ...desktop, reducedMotion: true, finePointer: false }),
      0,
    );
  });

  it("low-end wins over the coarse/narrow tier", () => {
    assert.equal(
      resolveParticleCap({ ...desktop, lowEnd: true, finePointer: false }),
      30,
    );
    assert.equal(
      resolveParticleCap({ ...desktop, lowEnd: true, narrowViewport: true }),
      30,
    );
  });
});
