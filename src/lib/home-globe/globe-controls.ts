/**
 * Landmark globe — pure motion/input step function (contract section 3.5).
 *
 * No three.js, no DOM, no timers: the renderer owns the clock and feeds
 * each frame and each input event through `stepGlobeControls`. The step
 * returns the next state plus the rotation/zoom effects the renderer
 * applies to the scene graph, which keeps every motion rule unit-testable
 * without a canvas.
 */
import { GLOBE_CONTRACT as C } from "./globe-contract.ts";

export interface GlobeControlsState {
  /** Eased camera distance actually rendered. */
  dist: number;
  /** Distance the ease is heading toward. */
  targetDist: number;
  /**
   * Inertia angular velocity, screen-axis components in rad/s: a flick
   * along (axisX, axisY) at this speed. Zero when settled.
   */
  velAxisX: number;
  velAxisY: number;
  /** Seconds since the last input of any kind. */
  idleTime: number;
  /** True while at least one pointer is down. */
  dragging: boolean;
  /**
   * True after a dive or a zoom (wheel, pinch, zoom key): auto-spin
   * stays parked however long the idle, until a rotation input — a
   * drag or an arrow key — un-parks it. Zoom inputs park rather than
   * un-park: a player closing in to look at a reveal must not have
   * the frame start rotating away once the idle delay passes.
   */
  parked: boolean;
}

export type GlobeControlsInput =
  | { type: "dragStart" }
  /** dt is the seconds since the previous move event (for inertia). */
  | { type: "dragMove"; dx: number; dy: number; dt: number }
  /** stale: the last move is old enough that no flick should survive. */
  | { type: "dragEnd"; stale: boolean; reducedMotion: boolean }
  | { type: "wheel"; deltaY: number; overSphere: boolean }
  /** distanceRatio is pinch-start distance over current distance. */
  | {
      type: "pinch";
      pinchStartTarget: number;
      distanceRatio: number;
      midDx: number;
      midDy: number;
    }
  | { type: "key"; key: string }
  /** A tap-to-landmark dive: ease the zoom to targetDist and park. */
  | { type: "dive"; targetDist: number }
  | { type: "tick"; dt: number; reducedMotion: boolean };

export interface GlobeControlsEffects {
  /** Trackball rotation to apply: unit axis (axisX, axisY, 0) by angle rad. */
  rotateAxisX: number;
  rotateAxisY: number;
  rotateAngle: number;
  /** Slow-turn rotation about the globe's own pole this tick, in rad. */
  autoSpinAngle: number;
  /** 0..1 slow-turn ramp, also weights the upright drift. */
  autoSpinRamp: number;
  /** Wheel only: true when the zoom moved, so the caller blocks page scroll. */
  consumed: boolean;
  /** Key "0": the renderer restores the start pose. */
  resetPose: boolean;
}

const NO_EFFECTS: GlobeControlsEffects = {
  rotateAxisX: 0,
  rotateAxisY: 0,
  rotateAngle: 0,
  autoSpinAngle: 0,
  autoSpinRamp: 0,
  consumed: false,
  resetPose: false,
};

export function createGlobeControlsState(): GlobeControlsState {
  return {
    dist: C.zoom.start,
    targetDist: C.zoom.start,
    velAxisX: 0,
    velAxisY: 0,
    idleTime: Number.POSITIVE_INFINITY,
    dragging: false,
    parked: false,
  };
}

/** Drag sensitivity at a given distance: 0.005 rad/px at start zoom, scaled by zoom. */
export function dragSensitivity(dist: number): number {
  return C.dragSens * (dist / C.zoom.start);
}

function clampZoom(value: number): number {
  return Math.min(C.zoom.max, Math.max(C.zoom.min, value));
}

/** Trackball rotation for a pixel delta, per the mock's rotateBy. */
function trackball(
  dx: number,
  dy: number,
  sens: number,
): Pick<GlobeControlsEffects, "rotateAxisX" | "rotateAxisY" | "rotateAngle"> {
  const len = Math.hypot(dx, dy);
  if (!len) return { rotateAxisX: 0, rotateAxisY: 0, rotateAngle: 0 };
  return { rotateAxisX: dy / len, rotateAxisY: dx / len, rotateAngle: len * sens };
}

function smoothstep(x: number, min: number, max: number): number {
  const t = Math.min(1, Math.max(0, (x - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export function stepGlobeControls(
  state: GlobeControlsState,
  input: GlobeControlsInput,
): { state: GlobeControlsState; effects: GlobeControlsEffects } {
  const next: GlobeControlsState = { ...state };
  const effects: GlobeControlsEffects = { ...NO_EFFECTS };

  switch (input.type) {
    case "dragStart": {
      next.dragging = true;
      next.velAxisX = 0;
      next.velAxisY = 0;
      next.idleTime = 0;
      next.parked = false;
      break;
    }
    case "dragMove": {
      const rot = trackball(input.dx, input.dy, dragSensitivity(next.dist));
      Object.assign(effects, rot);
      if (rot.rotateAngle > 0 && input.dt > 0) {
        const speed = Math.min(rot.rotateAngle / input.dt, C.inertiaCap);
        next.velAxisX = rot.rotateAxisX * speed;
        next.velAxisY = rot.rotateAxisY * speed;
      }
      next.idleTime = 0;
      break;
    }
    case "dragEnd": {
      next.dragging = false;
      if (input.reducedMotion || input.stale) {
        next.velAxisX = 0;
        next.velAxisY = 0;
      }
      next.idleTime = 0;
      break;
    }
    case "wheel": {
      // Zooms only over the sphere and only when not already at the limit;
      // otherwise the event is left for the page to scroll — and the park
      // is left exactly as it was: a wheel that does not zoom is page
      // browsing, not globe input.
      if (!input.overSphere) break;
      const zoomed = clampZoom(next.targetDist * Math.exp(input.deltaY * C.zoom.wheelK));
      if (Math.abs(zoomed - next.targetDist) < 1e-4) break;
      next.targetDist = zoomed;
      effects.consumed = true;
      // A zoom parks the slow turn, like a dive (see `parked`).
      next.parked = true;
      next.idleTime = 0;
      break;
    }
    case "pinch": {
      next.targetDist = clampZoom(input.pinchStartTarget * input.distanceRatio);
      // A pinch that actually zooms parks the slow turn, like a dive.
      if (next.targetDist !== state.targetDist) next.parked = true;
      Object.assign(effects, trackball(input.midDx, input.midDy, dragSensitivity(next.dist)));
      next.velAxisX = 0;
      next.velAxisY = 0;
      next.idleTime = 0;
      break;
    }
    case "key": {
      const px = C.keySpin / C.dragSens;
      // Rotation keys un-park (they are the player browsing); zoom and
      // reset keys park, like a dive (see `parked`).
      let parks = true;
      if (input.key === "ArrowLeft") Object.assign(effects, trackball(-px, 0, C.dragSens));
      else if (input.key === "ArrowRight") Object.assign(effects, trackball(px, 0, C.dragSens));
      else if (input.key === "ArrowUp") Object.assign(effects, trackball(0, -px, C.dragSens));
      else if (input.key === "ArrowDown") Object.assign(effects, trackball(0, px, C.dragSens));
      else if (input.key === "+" || input.key === "=") {
        next.targetDist = Math.max(C.zoom.min, next.targetDist * C.zoom.keyStep);
      } else if (input.key === "-" || input.key === "_") {
        next.targetDist = Math.min(C.zoom.max, next.targetDist / C.zoom.keyStep);
      } else if (input.key === "0") {
        next.targetDist = C.zoom.start;
        effects.resetPose = true;
      } else {
        return { state, effects: NO_EFFECTS };
      }
      if (input.key.startsWith("Arrow")) parks = false;
      next.velAxisX = 0;
      next.velAxisY = 0;
      next.idleTime = 0;
      next.parked = parks;
      break;
    }
    case "dive": {
      next.targetDist = clampZoom(input.targetDist);
      next.velAxisX = 0;
      next.velAxisY = 0;
      next.idleTime = 0;
      next.parked = true;
      break;
    }
    case "tick": {
      const dt = input.dt;
      next.idleTime += dt;

      // Inertia: spin while the flick is above the stop speed, damped
      // per 60 fps frame; below the stop speed it settles to zero.
      if (!next.dragging && !input.reducedMotion) {
        const speed = Math.hypot(next.velAxisX, next.velAxisY);
        if (speed > C.inertiaStop) {
          effects.rotateAxisX = next.velAxisX / speed;
          effects.rotateAxisY = next.velAxisY / speed;
          effects.rotateAngle = speed * dt;
          const damp = Math.pow(C.inertiaDamp, dt * 60);
          next.velAxisX *= damp;
          next.velAxisY *= damp;
        } else {
          next.velAxisX = 0;
          next.velAxisY = 0;
        }
      } else if (!next.dragging) {
        next.velAxisX = 0;
        next.velAxisY = 0;
      }

      // Slow turn: returns after the idle delay, ramping to full speed.
      // Parked (post-dive) suppresses it until a real input un-parks.
      if (!next.dragging && !next.parked && !input.reducedMotion && next.idleTime > C.resumeAfter) {
        const ramp = smoothstep(next.idleTime, C.resumeAfter, C.resumeAfter + C.resumeRamp);
        effects.autoSpinAngle = C.autoSpin * ramp * dt;
        effects.autoSpinRamp = ramp;
      }

      // Zoom ease; snaps under reduced motion.
      if (input.reducedMotion) {
        next.dist = next.targetDist;
      } else {
        next.dist =
          next.dist + (next.targetDist - next.dist) * (1 - Math.exp(-C.zoom.ease * dt));
      }
      break;
    }
  }

  return { state: next, effects };
}
