/**
 * Pure step-function tests for the landmark globe controls (contract 3.5).
 * No canvas, no three.js: state + input + dt in, state + effects out.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createGlobeControlsState,
  stepGlobeControls,
  type GlobeControlsState,
} from "./globe-controls.ts";
import { GLOBE_CONTRACT as C } from "./globe-contract.ts";

function tick(state: GlobeControlsState, dt: number, reducedMotion = false) {
  return stepGlobeControls(state, { type: "tick", dt, reducedMotion });
}

/** Run whole seconds of idle ticks in 1/60 steps. */
function idleFor(state: GlobeControlsState, seconds: number, reducedMotion = false) {
  let s = state;
  let last = tick(s, 0);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    last = tick(s, 1 / 60, reducedMotion);
    s = last.state;
  }
  return last;
}

describe("globe controls — slow turn resume timing", () => {
  it("stays still before the 3.0 s idle delay, then ramps to full speed", () => {
    // A key press counts as interaction and restarts the idle clock.
    let s = stepGlobeControls(createGlobeControlsState(), { type: "key", key: "ArrowRight" }).state;

    const before = idleFor(s, 2.9);
    assert.equal(before.effects.autoSpinAngle, 0, "no slow turn before the resume delay");
    s = before.state;

    const mid = idleFor(s, 0.85); // idle now ~3.75 s: halfway through the 1.5 s ramp
    assert.ok(mid.effects.autoSpinAngle > 0, "slow turn has resumed during the ramp");
    assert.ok(mid.effects.autoSpinRamp > 0 && mid.effects.autoSpinRamp < 1, "ramp is partial");
    s = mid.state;

    const full = idleFor(s, 1.0); // idle now ~4.75 s: past resumeAfter + resumeRamp
    assert.equal(full.effects.autoSpinRamp, 1, "ramp completes after 1.5 s");
    const expected = C.autoSpin * (1 / 60);
    assert.ok(
      Math.abs(full.effects.autoSpinAngle - expected) < 1e-9,
      `full-speed slow turn is ${C.autoSpin} rad/s`,
    );
  });

  it("never auto-spins under reduced motion, and zoom snaps instead of easing", () => {
    let s = createGlobeControlsState();
    s = stepGlobeControls(s, { type: "key", key: "+" }).state;
    assert.notEqual(s.targetDist, s.dist, "zoom target moved, distance not yet eased");
    const settled = tick(s, 1 / 60, true);
    assert.equal(settled.state.dist, settled.state.targetDist, "reduced motion snaps the zoom");
    const idle = idleFor(settled.state, 6, true);
    assert.equal(idle.effects.autoSpinAngle, 0, "no slow turn under reduced motion");
  });
});

describe("globe controls — wheel rule", () => {
  it("zooms over the sphere, and leaves the event unconsumed off it", () => {
    const s0 = createGlobeControlsState();
    const off = stepGlobeControls(s0, { type: "wheel", deltaY: 120, overSphere: false });
    assert.equal(off.effects.consumed, false, "off-sphere wheel is left for page scroll");
    assert.equal(off.state.targetDist, C.zoom.start, "off-sphere wheel does not zoom");

    const on = stepGlobeControls(s0, { type: "wheel", deltaY: 120, overSphere: true });
    assert.equal(on.effects.consumed, true, "on-sphere wheel is consumed");
    assert.ok(on.state.targetDist > C.zoom.start, "wheel down zooms out");
  });

  it("does not zoom at the limit, so the page scrolls instead", () => {
    let s = createGlobeControlsState();
    // Drive the target to the far limit with repeated wheel events.
    for (let i = 0; i < 40; i++) {
      s = stepGlobeControls(s, { type: "wheel", deltaY: 240, overSphere: true }).state;
    }
    assert.equal(s.targetDist, C.zoom.max, "target sits at the max zoom limit");
    const atLimit = stepGlobeControls(s, { type: "wheel", deltaY: 240, overSphere: true });
    assert.equal(atLimit.effects.consumed, false, "wheel at the limit is not consumed");
    assert.equal(atLimit.state.targetDist, C.zoom.max, "wheel at the limit does not zoom");

    let s2 = createGlobeControlsState();
    for (let i = 0; i < 40; i++) {
      s2 = stepGlobeControls(s2, { type: "wheel", deltaY: -240, overSphere: true }).state;
    }
    assert.equal(s2.targetDist, C.zoom.min, "target sits at the min zoom limit");
    const atMin = stepGlobeControls(s2, { type: "wheel", deltaY: -240, overSphere: true });
    assert.equal(atMin.effects.consumed, false, "wheel at the min limit is not consumed");
  });
});

describe("globe controls — inertia", () => {
  it("a flick spins on release, damps down, and stops below 0.02 rad/s", () => {
    let s = createGlobeControlsState();
    s = stepGlobeControls(s, { type: "dragStart" }).state;
    // A fast horizontal flick: 30 px in 1/60 s.
    s = stepGlobeControls(s, { type: "dragMove", dx: 30, dy: 0, dt: 1 / 60 }).state;
    s = stepGlobeControls(s, { type: "dragEnd", stale: false, reducedMotion: false }).state;
    const speed = Math.hypot(s.velAxisX, s.velAxisY);
    assert.ok(speed > 1, `flick leaves real inertia (got ${speed} rad/s)`);
    assert.ok(speed <= C.inertiaCap, "inertia is capped");

    const first = tick(s, 1 / 60);
    assert.ok(first.effects.rotateAngle > 0, "inertia rotates on the first tick after release");

    // Run idle ticks until the velocity settles; it must reach exact zero
    // and then produce no further rotation.
    let cur = first.state;
    let settled = false;
    for (let i = 0; i < 60 * 20; i++) {
      const r = tick(cur, 1 / 60);
      cur = r.state;
      if (cur.velAxisX === 0 && cur.velAxisY === 0) {
        assert.equal(r.effects.rotateAngle, 0, "no rotation once inertia has stopped");
        settled = true;
        break;
      }
      assert.ok(r.effects.rotateAngle > 0, "still rotating while above the stop speed");
    }
    assert.ok(settled, "inertia settles to zero instead of creeping forever");
  });

  it("a stale release and a reduced-motion release both kill inertia", () => {
    const flick = () => {
      let s = createGlobeControlsState();
      s = stepGlobeControls(s, { type: "dragStart" }).state;
      s = stepGlobeControls(s, { type: "dragMove", dx: 30, dy: 0, dt: 1 / 60 }).state;
      return s;
    };
    const stale = stepGlobeControls(flick(), { type: "dragEnd", stale: true, reducedMotion: false });
    assert.equal(stale.state.velAxisY, 0, "stale release drops the flick");
    const reduced = stepGlobeControls(flick(), {
      type: "dragEnd",
      stale: false,
      reducedMotion: true,
    });
    assert.equal(reduced.state.velAxisY, 0, "reduced-motion release drops the flick");
  });
});

describe("globe controls — the park rule (dive and zoom park, rotation un-parks)", () => {
  const dived = () =>
    stepGlobeControls(createGlobeControlsState(), { type: "dive", targetDist: C.zoom.diveDist }).state;

  it("a dive parks the slow turn for good: no resume however long the idle", () => {
    const s = dived();
    assert.equal(s.parked, true, "dive parks");
    const idle = idleFor(s, 12);
    assert.equal(idle.effects.autoSpinAngle, 0, "no slow turn while parked");
    assert.equal(idle.state.parked, true, "still parked after a long idle");
  });

  it("a wheel zoom parks, so the turn cannot resume under a zooming player", () => {
    const zoomed = stepGlobeControls(createGlobeControlsState(), {
      type: "wheel",
      deltaY: -120,
      overSphere: true,
    });
    assert.equal(zoomed.effects.consumed, true, "wheel zoom consumed");
    assert.equal(zoomed.state.parked, true, "wheel zoom parks");
    const idle = idleFor(zoomed.state, 6);
    assert.equal(idle.effects.autoSpinAngle, 0, "no slow turn resumes after a wheel zoom");
  });

  it("a wheel that does not zoom leaves the park exactly as it was", () => {
    const offSphere = stepGlobeControls(dived(), { type: "wheel", deltaY: 120, overSphere: false });
    assert.equal(offSphere.state.parked, true, "off-sphere wheel does not un-park a dive");
    const atLimitState: GlobeControlsState = { ...createGlobeControlsState(), targetDist: C.zoom.min };
    const atLimit = stepGlobeControls(atLimitState, { type: "wheel", deltaY: -240, overSphere: true });
    assert.equal(atLimit.effects.consumed, false, "wheel at the limit is not consumed");
    assert.equal(atLimit.state.parked, false, "wheel at the limit does not park either");
  });

  it("a pinch that zooms parks; a pinch that changes nothing does not", () => {
    const zoomed = stepGlobeControls(createGlobeControlsState(), {
      type: "pinch",
      pinchStartTarget: C.zoom.start,
      distanceRatio: 0.6,
      midDx: 0,
      midDy: 0,
    });
    assert.equal(zoomed.state.parked, true, "pinch zoom parks");
    const still = stepGlobeControls(createGlobeControlsState(), {
      type: "pinch",
      pinchStartTarget: C.zoom.start,
      distanceRatio: 1,
      midDx: 0,
      midDy: 0,
    });
    assert.equal(still.state.parked, false, "a no-change pinch leaves the park alone");
  });

  it("zoom keys park; arrow keys and a drag un-park, then the idle rule resumes the turn", () => {
    const zoomKey = stepGlobeControls(createGlobeControlsState(), { type: "key", key: "+" });
    assert.equal(zoomKey.state.parked, true, "+ parks");

    const arrowed = stepGlobeControls(dived(), { type: "key", key: "ArrowRight" });
    assert.equal(arrowed.state.parked, false, "an arrow key un-parks a dive");
    const before = idleFor(arrowed.state, 2.9);
    assert.equal(before.effects.autoSpinAngle, 0, "no turn before the resume delay");
    const after = idleFor(before.state, 2.0);
    assert.ok(after.effects.autoSpinAngle > 0, "the turn resumes under the idle rule");

    const dragged = stepGlobeControls(dived(), { type: "dragStart" });
    assert.equal(dragged.state.parked, false, "a drag un-parks a dive");
  });
});

describe("globe controls — keys, pinch and reset", () => {
  it("arrows spin 0.18 rad, + and - step the zoom, unhandled keys do nothing", () => {
    const s0 = createGlobeControlsState();
    const left = stepGlobeControls(s0, { type: "key", key: "ArrowLeft" });
    assert.ok(Math.abs(left.effects.rotateAngle - C.keySpin) < 1e-9, "arrow spin is 0.18 rad");
    const zoomIn = stepGlobeControls(s0, { type: "key", key: "+" });
    assert.equal(zoomIn.state.targetDist, C.zoom.start * C.zoom.keyStep, "+ steps zoom in");
    const zoomOut = stepGlobeControls(zoomIn.state, { type: "key", key: "-" });
    assert.ok(Math.abs(zoomOut.state.targetDist - C.zoom.start) < 1e-9, "- steps back out");
    const other = stepGlobeControls(s0, { type: "key", key: "x" });
    assert.equal(other.state, s0, "unhandled key returns the state untouched");
  });

  it("pinch distance ratio sets the zoom, clamped to the limits", () => {
    const s0 = createGlobeControlsState();
    const out = stepGlobeControls(s0, {
      type: "pinch",
      pinchStartTarget: C.zoom.start,
      distanceRatio: 2,
      midDx: 0,
      midDy: 0,
    });
    assert.equal(out.state.targetDist, C.zoom.max, "pinch zoom clamps at the max");
    const into = stepGlobeControls(s0, {
      type: "pinch",
      pinchStartTarget: C.zoom.start,
      distanceRatio: 0.8,
      midDx: 4,
      midDy: 0,
    });
    assert.equal(into.state.targetDist, C.zoom.start * 0.8, "pinch ratio scales the start target");
    const clamped = stepGlobeControls(s0, {
      type: "pinch",
      pinchStartTarget: C.zoom.start,
      distanceRatio: 0.3,
      midDx: 0,
      midDy: 0,
    });
    assert.equal(clamped.state.targetDist, C.zoom.min, "pinch zoom clamps at the min");
    assert.ok(into.effects.rotateAngle > 0, "pinch midpoint move tilts the globe");
  });

  it("key 0 resets pose and zoom and clears inertia", () => {
    let s = createGlobeControlsState();
    s = stepGlobeControls(s, { type: "key", key: "+" }).state;
    s = stepGlobeControls(s, { type: "dragStart" }).state;
    s = stepGlobeControls(s, { type: "dragMove", dx: 30, dy: 0, dt: 1 / 60 }).state;
    const reset = stepGlobeControls(s, { type: "key", key: "0" });
    assert.equal(reset.effects.resetPose, true, "reset asks the renderer to restore the pose");
    assert.equal(reset.state.targetDist, C.zoom.start, "reset restores the start zoom");
    assert.equal(reset.state.velAxisX, 0, "reset clears inertia (x)");
    assert.equal(reset.state.velAxisY, 0, "reset clears inertia (y)");
  });
});
