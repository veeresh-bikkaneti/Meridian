/**
 * Pose table for the 3D Holmes & Watson (pair3d.ts).
 *
 * Each pose is a set of joint rotations in degrees, in the GLB's own
 * frame (three.js: +X to the viewer's right, +Y up, +Z toward the
 * camera; the figure faces +Z):
 *
 * - shoulders/elbows: x < 0 swings the arm (or bends the forearm)
 *   forward and up; z swings it sideways (left arm out = negative z,
 *   right arm out = positive z). "l" is the arm on the -X side.
 * - head: x > 0 looks down, x < 0 looks up; y turns; z tilts.
 * - hips: x swings a leg (walk only).
 *
 * `anim` names a looping motion layered over the pose (walk, jump,
 * clap, nod, idle). Data only: no game state, no clue, no answer ever
 * reaches the 3D layer (the pair stays answer-blind, as the SVG rigs).
 *
 * Shared by the game and the Blender check script that renders every
 * pose from the exported GLBs (scripts/detective3d/), so the table is
 * plain JSON-shaped data.
 */
export type Vec3 = readonly [number, number, number];

export interface Pose3D {
  shoulderL: Vec3;
  shoulderR: Vec3;
  elbowL: number;
  elbowR: number;
  head: Vec3;
  anim: "idle" | "walk" | "jump" | "clap" | "nod";
}

const ARMS_DOWN = { shoulderL: [0, 0, -6], shoulderR: [0, 0, 6], elbowL: -8, elbowR: -8 } as const;

export const HOLMES_POSES_3D: Record<string, Pose3D> = {
  dock: { ...ARMS_DOWN, head: [0, 0, 0], anim: "idle" },
  walk: { ...ARMS_DOWN, head: [0, 0, 0], anim: "walk" },
  search: { shoulderL: [0, 0, -6], shoulderR: [-75, 0, 8], elbowL: -8, elbowR: -25, head: [14, 0, 0], anim: "idle" },
  "berth-think": { shoulderL: [-62, 0, 22], shoulderR: [0, 0, 6], elbowL: -118, elbowR: -8, head: [-4, 0, 6], anim: "idle" },
  ack: { shoulderL: [-62, 0, 22], shoulderR: [0, 0, 6], elbowL: -118, elbowR: -8, head: [0, 0, 0], anim: "nod" },
  announce: { shoulderL: [0, 0, -6], shoulderR: [-150, 0, 12], elbowL: -8, elbowR: -15, head: [-8, 0, 0], anim: "idle" },
  "gaze-up": { ...ARMS_DOWN, head: [-24, 0, 0], anim: "idle" },
  "card-look": { shoulderL: [-45, 0, 4], shoulderR: [0, 0, 6], elbowL: -55, elbowR: -8, head: [14, -10, 0], anim: "idle" },
  "celebrate-jump": { shoulderL: [-165, 0, -18], shoulderR: [-165, 0, 18], elbowL: -10, elbowR: -10, head: [-10, 0, 0], anim: "jump" },
  "high-five": { shoulderL: [0, 0, -6], shoulderR: [-160, 0, 28], elbowL: -8, elbowR: -10, head: [-8, 15, 0], anim: "idle" },
  clap: { shoulderL: [-60, 0, 14], shoulderR: [-60, 0, -14], elbowL: -45, elbowR: -45, head: [0, 0, 0], anim: "clap" },
  pout: { shoulderL: [-38, 0, 16], shoulderR: [-38, 0, -16], elbowL: -100, elbowR: -100, head: [10, 0, -6], anim: "idle" },
  // "Why Do We Learn This?" card film (scripts/why-learn-film/): the
  // magnifying lens raised at chest height, right arm forward, left
  // hand tucked behind the back, eyes down through the glass.
  "lens-sweep": { shoulderL: [14, 0, -4], shoulderR: [-62, 0, 10], elbowL: -70, elbowR: -62, head: [8, 0, 0], anim: "idle" },
};

export const WATSON_POSES_3D: Record<string, Pose3D> = {
  walk: { ...ARMS_DOWN, head: [0, 0, 0], anim: "walk" },
  read: { shoulderL: [-55, 0, 10], shoulderR: [0, 0, 6], elbowL: -60, elbowR: -8, head: [12, 0, 0], anim: "idle" },
  think: { shoulderL: [0, 0, -6], shoulderR: [-26, 0, -6], elbowL: -8, elbowR: -125, head: [-4, 0, -6], anim: "idle" },
  "station-idle": { shoulderL: [0, 0, -6], shoulderR: [-30, 0, 10], elbowL: -8, elbowR: -110, head: [0, 0, 0], anim: "idle" },
  "notebook-mark": { shoulderL: [-50, 0, 14], shoulderR: [-40, 0, -10], elbowL: -70, elbowR: -70, head: [16, 0, 0], anim: "nod" },
  gasp: { shoulderL: [-40, 0, -40], shoulderR: [-40, 0, 40], elbowL: -20, elbowR: -20, head: [-10, 0, 0], anim: "idle" },
  "celebrate-jump": { shoulderL: [-165, 0, -18], shoulderR: [-165, 0, 18], elbowL: -10, elbowR: -10, head: [-10, 0, 0], anim: "jump" },
  "high-five": { shoulderL: [-160, 0, -28], shoulderR: [0, 0, 6], elbowL: -10, elbowR: -8, head: [-8, -15, 0], anim: "idle" },
  clap: { shoulderL: [-60, 0, 14], shoulderR: [-60, 0, -14], elbowL: -45, elbowR: -45, head: [0, 0, 0], anim: "clap" },
  pout: { shoulderL: [-38, 0, 16], shoulderR: [-38, 0, -16], elbowL: -100, elbowR: -100, head: [10, 0, 6], anim: "idle" },
  // Card film poses (scripts/why-learn-film/). toss: throwing arm high
  // in follow-through, eyes up after the ball. lean-in: head down and
  // forward over the table, hands near the knees, delighted.
  toss: { shoulderL: [-28, 0, -14], shoulderR: [-158, 0, 16], elbowL: -24, elbowR: -10, head: [-20, 0, 0], anim: "idle" },
  "lean-in": { shoulderL: [-34, 0, -12], shoulderR: [-34, 0, 12], elbowL: -34, elbowR: -34, head: [22, 0, 4], anim: "idle" },
  // lift-pie: both arms forward and up, hands under a pie held face-on
  // to the viewer, head a touch back so the face stays clear of it.
  "lift-pie": { shoulderL: [-92, 0, -6], shoulderR: [-92, 0, 6], elbowL: -52, elbowR: -52, head: [-8, 0, 0], anim: "idle" },
  // hold-pie-wide (10-18 film): arms low and wide, hands at the sides of
  // a pie held face-on at the belly, head up so the face stays clear.
  "hold-pie-wide": { shoulderL: [-8, 0, -30], shoulderR: [-8, 0, 30], elbowL: -30, elbowR: -30, head: [-2, 0, 0], anim: "idle" },
};

/** The figure turns this far toward the side it faces (degrees about Y). */
export const FACING_TURN_DEG = 28;

/** Orthographic frame per figure, in model units: bottom and height of
 * the visible window (the width follows the SVG viewBox aspect, so the
 * canvas covers the SVG box exactly). */
export const FRAME_3D = {
  holmes: { bottom: -0.04, height: 2.16, aspect: 120 / 178 },
  watson: { bottom: -0.04, height: 1.9, aspect: 134 / 140 },
} as const;
