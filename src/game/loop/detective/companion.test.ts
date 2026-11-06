import assert from "node:assert/strict";
import test from "node:test";

import {
  berthFor,
  createAutoKillTracker,
  createPauseDetector,
  type BerthInput,
  type PointerSample,
} from "./companion.ts";

/* ------------------------------------------------------------------ */
/* Pause detector                                                      */
/* ------------------------------------------------------------------ */

const mouse = (x: number, y: number, t: number, down = 0): PointerSample => ({
  x,
  y,
  t,
  pointerType: "mouse",
  pointersDown: down,
});
const touch = (x: number, y: number, t: number, down = 1): PointerSample => ({
  x,
  y,
  t,
  pointerType: "touch",
  pointersDown: down,
});

test("pause: mouse still 350 ms confirms, 349 ms does not", () => {
  const d = createPauseDetector();
  for (let t = 0; t <= 300; t += 50) d.feed(mouse(500, 400, t));
  assert.equal(d.check(349, 9999), null);
  assert.deepEqual(d.check(350, 9999), { x: 500, y: 400 });
  // Emitted exactly once.
  assert.equal(d.check(700, 9999), null);
});

test("pause: touch needs 450 ms AND map still ≥ 250 ms", () => {
  const d = createPauseDetector();
  for (let t = 0; t <= 400; t += 50) d.feed(touch(300, 500, t));
  assert.equal(d.check(449, 9999), null);
  assert.equal(d.check(450, 249), null); // map still moving
  assert.deepEqual(d.check(450, 250), { x: 300, y: 500 });
});

test("pause: slow drift under 20 px/s inside the radius still confirms", () => {
  const d = createPauseDetector();
  // 1 px per 100 ms = 10 px/s, total drift 3 px < 8 px radius.
  for (let t = 0; t <= 300; t += 100) d.feed(mouse(500 + t / 100, 400, t));
  assert.deepEqual(d.check(360, 9999), { x: 500, y: 400 });
});

test("pause: oscillating jitter never confirms", () => {
  const d = createPauseDetector();
  // ±3 px every 50 ms: net displacement ~0, path rate ~120 px/s.
  for (let t = 0; t <= 2000; t += 50) {
    d.feed(mouse((t / 50) % 2 === 0 ? 500 : 506, 400, t));
  }
  assert.equal(d.check(1000, 9999), null);
  assert.equal(d.check(2000, 9999), null);
  // (Jitter that STOPS, followed by a full window of silence, is a
  // genuine pause and does confirm — that is the desktop model.)
});

test("pause: sliding out of the radius restarts the pause", () => {
  const d = createPauseDetector();
  for (let t = 0; t <= 300; t += 50) d.feed(mouse(500, 400, t));
  d.feed(mouse(520, 400, 320)); // 20 px slide — new anchor
  assert.equal(d.check(660, 9999), null); // only 340 ms at the new spot
  assert.deepEqual(d.check(680, 9999), { x: 520, y: 400 });
});

test("pause: a second finger kills the touch candidate", () => {
  const d = createPauseDetector();
  for (let t = 0; t <= 400; t += 50) d.feed(touch(300, 500, t));
  d.feed(touch(300, 500, 420, 2)); // pinch begins
  assert.equal(d.check(900, 9999), null);
});

test("pause: mouse press (drag) is not a hover pause", () => {
  const d = createPauseDetector();
  for (let t = 0; t <= 400; t += 50) d.feed(mouse(500, 400, t, 1));
  assert.equal(d.check(900, 9999), null);
});

test("pause: post-gesture re-arm — 500 ms idle + a fresh full pause", () => {
  const d = createPauseDetector();
  d.notifyGestureStart();
  d.feed(mouse(500, 400, 900)); // ignored mid-gesture
  d.notifyGestureEnd(1000); // re-arm until 1500
  for (let t = 1100; t <= 1800; t += 50) d.feed(mouse(500, 400, t));
  // 400 ms of stillness by 1500, but the fresh pause must run its
  // full 350 ms AFTER the 1500 re-arm boundary.
  assert.equal(d.check(1849, 9999), null);
  assert.deepEqual(d.check(1850, 9999), { x: 500, y: 400 });
});

/* ------------------------------------------------------------------ */
/* Berth solver                                                        */
/* ------------------------------------------------------------------ */

const BOX = { w: 70, h: 104 };
const baseInput = (over: Partial<BerthInput> = {}): BerthInput => ({
  pausePoint: { x: 200, y: 300 },
  holmesBox: BOX,
  viewport: { w: 800, h: 600 },
  dock: { x: 12, y: 484 }, // dock centre (47, 536)
  exclusions: [],
  pointerType: "mouse",
  handSide: "right",
  ...over,
});

function centreOf(r: { x: number; y: number }) {
  return { x: r.x + BOX.w / 2, y: r.y + BOX.h / 2 };
}
function edgeDistance(cx: number, cy: number, px: number, py: number) {
  const dx = Math.max(Math.abs(px - cx) - BOX.w / 2, 0);
  const dy = Math.max(Math.abs(py - cy) - BOX.h / 2, 0);
  return Math.hypot(dx, dy);
}

test("solver: desktop berth is above the finger at legal distances, NW for right hand", () => {
  const r = berthFor(baseInput());
  assert.equal(r.kind, "berth");
  if (r.kind !== "berth") return;
  const c = centreOf(r);
  assert.ok(c.y < 300, "centre above the pause point");
  assert.ok(c.x < 200, "NW bias for a right hand");
  assert.ok(Math.hypot(c.x - 200, c.y - 300) >= 64, "centre ≥ 64 px");
  assert.ok(edgeDistance(c.x, c.y, 200, 300) >= 56, "edge ≥ 56 dp");
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + BOX.w <= 800 && r.y + BOX.h <= 600);
});

test("solver: touch berth honours the 96 dp centre minimum", () => {
  const r = berthFor(baseInput({ pointerType: "touch" }));
  assert.equal(r.kind, "berth");
  if (r.kind !== "berth") return;
  const c = centreOf(r);
  assert.ok(Math.hypot(c.x - 200, c.y - 300) >= 96, "centre ≥ 96 dp");
  assert.ok(edgeDistance(c.x, c.y, 200, 300) >= 56, "edge ≥ 56 dp");
  assert.ok(c.y < 300, "above the finger");
});

test("solver: left hand mirrors the berth to NE", () => {
  const r = berthFor(baseInput({ handSide: "left" }));
  assert.equal(r.kind, "berth");
  if (r.kind !== "berth") return;
  const c = centreOf(r);
  assert.ok(c.x > 200, "NE bias for a left hand");
  assert.ok(c.y < 300, "still above the finger");
});

test("solver: pause far from the dock is remote, not a cross-map walk", () => {
  const r = berthFor(baseInput({ pausePoint: { x: 700, y: 100 } }));
  assert.deepEqual(r, { kind: "remote" });
});

test("solver: boxed in by the viewport top → hide (never overlap)", () => {
  // 200 px-wide viewport, pause near the top: no above-the-finger
  // position can satisfy centre + edge distances inside the screen.
  const r = berthFor(
    baseInput({
      viewport: { w: 200, h: 600 },
      pausePoint: { x: 100, y: 60 },
      dock: { x: 65, y: 0 },
    }),
  );
  assert.deepEqual(r, { kind: "hide" });
});

test("solver: an exclusion over the ideal berth pushes him elsewhere, legally", () => {
  const ideal = berthFor(baseInput());
  assert.equal(ideal.kind, "berth");
  if (ideal.kind !== "berth") return;
  const ic = centreOf(ideal);
  const r = berthFor(
    baseInput({ exclusions: [{ x: ic.x, y: ic.y, r: 10 }] }),
  );
  assert.equal(r.kind, "berth");
  if (r.kind !== "berth") return;
  const c = centreOf(r);
  assert.ok(
    Math.hypot(c.x - ic.x, c.y - ic.y) >= 130,
    "centre ≥ exclusion r + 120 dp",
  );
  assert.ok(c.y < 300, "still above the finger");
});

test("solver: an exclusion covering every candidate → hide", () => {
  const r = berthFor(
    baseInput({ exclusions: [{ x: 200, y: 300, r: 250 }] }),
  );
  assert.deepEqual(r, { kind: "hide" });
});

test("solver: deterministic — identical inputs, identical outputs", () => {
  const input = baseInput({
    exclusions: [{ x: 150, y: 180, r: 24 }],
    pointerType: "touch",
  });
  assert.deepEqual(berthFor(input), berthFor(input));
});

/* ------------------------------------------------------------------ */
/* Auto-kill accumulator                                               */
/* ------------------------------------------------------------------ */

test("kill: sustained 30 fps stream fires the FPS kill and stays killed", () => {
  const k = createAutoKillTracker();
  for (let t = 33; t <= 6000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  assert.equal(k.killReason, "fps");
  // Healthy frames afterwards do not resurrect it.
  for (let t = 6017; t <= 9000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, true);
});

test("kill: healthy 60 fps stream never fires", () => {
  const k = createAutoKillTracker();
  for (let t = 17; t <= 20000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, false);
  assert.equal(k.killReason, null);
});

test("kill: 3 long tasks > 100 ms within 10 s fire; 2 do not; spread-out do not", () => {
  const two = createAutoKillTracker();
  two.feedLongTask(150, 1000);
  two.feedLongTask(150, 5000);
  assert.equal(two.killed, false);

  const three = createAutoKillTracker();
  three.feedLongTask(150, 1000);
  three.feedLongTask(150, 5000);
  three.feedLongTask(150, 9000);
  assert.equal(three.killed, true);
  assert.equal(three.killReason, "longtask");

  const spread = createAutoKillTracker();
  spread.feedLongTask(150, 0);
  spread.feedLongTask(150, 6000);
  spread.feedLongTask(150, 12000); // first is outside the 10 s window
  assert.equal(spread.killed, false);

  const short = createAutoKillTracker();
  for (let i = 0; i < 5; i++) short.feedLongTask(50, i * 1000);
  assert.equal(short.killed, false);
});
