import assert from "node:assert/strict";
import test from "node:test";
import { GestureController, TOUCH_LIFT, nearPin } from "./gesture.ts";

function controller() {
  return new GestureController(() => ({ width: 400, height: 600 }));
}

test("a mouse tap places the pin on the point", () => {
  const gestures = controller();
  gestures.down(1, 120, 200, "mouse", false);
  const effects = gestures.up(1, 122, 201);
  assert.deepEqual(effects[0], { type: "place", x: 122, y: 201 });
});

test("a finger tap places the pin above the fingertip", () => {
  const gestures = controller();
  gestures.down(1, 80, 300, "touch", false);
  const effects = gestures.up(1, 82, 304);
  assert.equal(effects[0]?.type, "place");
  if (effects[0]?.type === "place") {
    assert.equal(effects[0].y, 304 - TOUCH_LIFT);
    assert.equal(effects[0].x, 82);
  }
});

test("a drag pans and does not drop a pin", () => {
  const gestures = controller();
  gestures.down(1, 40, 40, "mouse", false);
  const moved = gestures.move(1, 70, 48);
  assert.equal(moved.some((effect) => effect.type === "pan"), true);
  const up = gestures.up(1, 90, 50);
  assert.equal(up.some((effect) => effect.type === "place"), false);
});

test("a tap on the pin confirms, a drag of the pin moves it", () => {
  const gestures = controller();
  gestures.down(1, 10, 10, "mouse", true);
  const tap = gestures.up(1, 12, 11);
  assert.equal(tap[0]?.type, "confirm");

  const drag = controller();
  drag.down(1, 10, 10, "touch", true);
  drag.move(1, 40, 80);
  const up = drag.up(1, 48, 90);
  assert.equal(up[0]?.type, "place");
  if (up[0]?.type === "place") assert.equal(up[0].y, 90 - TOUCH_LIFT);
});

test("a pinch zooms instead of placing", () => {
  const gestures = controller();
  gestures.down(1, 100, 100, "touch", false);
  gestures.down(2, 140, 100, "touch", false);
  const zoomed = gestures.move(2, 180, 100);
  assert.equal(zoomed[0]?.type, "zoom");
  if (zoomed[0]?.type === "zoom") assert.ok(zoomed[0].factor > 1);
  const up = gestures.up(2, 180, 100);
  assert.equal(up.some((effect) => effect.type === "place"), false);
});

test("the pin's head and tip are both easy to hit", () => {
  assert.equal(nearPin(100, 100, 100, 110), true);
  assert.equal(nearPin(100, 80, 100, 100), true);
  assert.equal(nearPin(10, 10, 100, 100), false);
});
