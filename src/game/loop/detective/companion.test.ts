import assert from "node:assert/strict";
import test from "node:test";

import {
  createAutoKillTracker,
  createPauseDetector,
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
/* Auto-kill accumulator                                               */
/* ------------------------------------------------------------------ */

test("kill: sustained 30 fps stream fires the FPS kill; a SHORT healthy burst does not resurrect it", () => {
  const k = createAutoKillTracker();
  for (let t = 33; t <= 6000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  assert.equal(k.killReason, "fps");
  // ~3 s of healthy frames is under the 5 s re-qualification
  // sustain — the companion stays docked (berth cure, 2026-11-07:
  // the kill is no longer a session latch, but recovery is earned
  // on a sustained window, never on a brief burst).
  for (let t = 6017; t <= 9000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, true);
  assert.equal(k.requalifiedCount, 0);
});

test("requalify: a sustained healthy window (5 s at 60 fps) resurrects after an FPS kill", () => {
  const k = createAutoKillTracker();
  for (let t = 33; t <= 6000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  // 6 s of clean 60 fps frames: the full sustain window is healthy.
  for (let t = 6017; t <= 12000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, false);
  assert.equal(k.killReason, null);
  assert.equal(k.requalifiedCount, 1);
  // And a fresh bad run can kill it again — recovery is not immunity.
  for (let t = 12033; t <= 18000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  assert.equal(k.killReason, "fps");
});

test("requalify: borderline frames (50 fps, above the kill line, below the healthy line) do NOT resurrect", () => {
  const k = createAutoKillTracker();
  for (let t = 33; t <= 6000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  // 50 fps for 8 s: the hysteresis band holds — no dock/berth flap.
  for (let t = 6020; t <= 14000; t += 20) k.feedFrame(20, t);
  assert.equal(k.killed, true);
});

test("requalify: a long task inside the healthy window restarts the sustain", () => {
  const k = createAutoKillTracker();
  for (let t = 33; t <= 6000; t += 33) k.feedFrame(33, t);
  assert.equal(k.killed, true);
  // 4 s healthy, then a long task, then only 2 s more healthy:
  // the sustain was broken, so still killed.
  for (let t = 6017; t <= 10000; t += 17) k.feedFrame(17, t);
  k.feedLongTask(150, 10050);
  for (let t = 10067; t <= 12000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, true);
  // A further unbroken healthy run past the sustain resurrects.
  for (let t = 12017; t <= 16000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, false);
});

test("reset: clears a latched kill and every window (the host's case-change cure)", () => {
  const k = createAutoKillTracker();
  k.feedLongTask(150, 1000);
  k.feedLongTask(150, 5000);
  k.feedLongTask(150, 9000);
  assert.equal(k.killed, true);
  k.reset();
  assert.equal(k.killed, false);
  assert.equal(k.killReason, null);
  // Windows are cleared too: two long tasks after reset do not kill.
  k.feedLongTask(150, 10000);
  k.feedLongTask(150, 11000);
  assert.equal(k.killed, false);
});

test("noteGate: a gated gap inside the window does not dilute the measured rate into a kill", () => {
  const k = createAutoKillTracker();
  // ~1.5 s of honest 60 fps frames.
  for (let t = 17; t <= 1500; t += 17) k.feedFrame(17, t);
  // A motion-gated stretch: the host feeds nothing for 900 ms,
  // marks the transition, then resumes at 60 fps. Without the
  // gate mark, the resumed window's span would include the gap
  // (~2.4 s span over ~1.5 s of frames \u2248 34 fps) and trip the
  // kill on a healthy device \u2014 the landing-kill pattern of
  // PR #364's cure rounds 5-6.
  k.noteGate(2400);
  for (let t = 2417; t <= 6000; t += 17) k.feedFrame(17, t);
  assert.equal(k.killed, false);
  assert.equal(k.killReason, null);
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
