import assert from "node:assert/strict";
import test from "node:test";
import {
  isDoubleTap,
  isTap,
  TAP_WINDOW_MS,
  TAP_WINDOW_PX,
  type PointerTapEndpoint,
} from "./pin-tap.ts";
import { variationLine } from "./variation.ts";

const first = { x: 40, y: 80, t: 1_000 };

test("exactly on the window edges (500ms, 48px) is a double-tap", () => {
  assert.equal(
    isDoubleTap(first, { x: 40 + TAP_WINDOW_PX, y: 80, t: 1_000 + TAP_WINDOW_MS }),
    true,
  );
  assert.equal(isDoubleTap(first, { x: 40, y: 80, t: 1_000 }), true);
});

test("1ms past the window is not a double-tap", () => {
  assert.equal(
    isDoubleTap(first, { x: 40, y: 80, t: 1_000 + TAP_WINDOW_MS + 1 }),
    false,
  );
});

test("1px past the window is not a double-tap", () => {
  assert.equal(
    isDoubleTap(first, { x: 40 + TAP_WINDOW_PX + 1, y: 80, t: 1_100 }),
    false,
  );
  // diagonal just outside the radius: 34^2 + 34^2 = 2312 > 48^2 = 2304
  assert.equal(isDoubleTap(first, { x: 74, y: 114, t: 1_100 }), false);
});

test("null previous and negative dt are not double-taps", () => {
  assert.equal(isDoubleTap(null, first), false);
  assert.equal(isDoubleTap(first, { x: 40, y: 80, t: 999 }), false);
});

test("a far or slow tap is a plain tap", () => {
  assert.equal(isDoubleTap(first, { x: 400, y: 80, t: 1_100 }), false);
  assert.equal(isDoubleTap(first, { x: 42, y: 81, t: 2_000 }), false);
});

test("the variation is the line from the player's pin to the spot", () => {
  const line = variationLine({ lon: 77.2, lat: 8.4 }, { lon: 76.1, lat: 10.8 }, 240.4);
  assert.deepEqual(line.coordinates, [
    [77.2, 8.4],
    [76.1, 10.8],
  ]);
  assert.deepEqual(line.midpoint, [76.65, 9.6]);
  assert.equal(line.label, "240 km");
});

// --- isTap: pointerdown/pointerup tap classification (P0-02 Option B) ---

function endpoint(over: Partial<PointerTapEndpoint>): PointerTapEndpoint {
  return {
    x: 100,
    y: 200,
    t: 1_000,
    pointerId: 7,
    button: 0,
    isPrimary: true,
    pointerType: "touch",
    ...over,
  };
}

const down = endpoint({});

test("a quick near primary button-0 release is a tap", () => {
  assert.equal(isTap(down, endpoint({ x: 104, y: 196, t: 1_120 })), true);
});

test("exactly on the window edges (500ms, 48px) is a tap", () => {
  assert.equal(
    isTap(down, endpoint({ x: 100 + TAP_WINDOW_PX, y: 200, t: 1_000 + TAP_WINDOW_MS })),
    true,
  );
  assert.equal(isTap(down, endpoint({ t: 1_000 })), true);
});

test("1ms past the window is not a tap", () => {
  assert.equal(isTap(down, endpoint({ t: 1_000 + TAP_WINDOW_MS + 1 })), false);
});

test("1px past the window is not a tap", () => {
  // diagonal just outside the radius: 34^2 + 34^2 = 2312 > 48^2 = 2304
  assert.equal(isTap(down, endpoint({ x: 134, y: 234, t: 1_100 })), false);
});

test("a non-primary release is not a tap", () => {
  assert.equal(isTap(down, endpoint({ isPrimary: false })), false);
});

test("a non-zero button is not a tap", () => {
  assert.equal(isTap(down, endpoint({ button: 2 })), false);
});

test("a different pointerId is not a tap", () => {
  assert.equal(isTap(down, endpoint({ pointerId: 9 })), false);
});

test("negative dt is not a tap", () => {
  assert.equal(isTap(down, endpoint({ t: 999 })), false);
});

test("a far or slow release is not a tap", () => {
  assert.equal(isTap(down, endpoint({ x: 400, y: 200, t: 1_100 })), false);
  assert.equal(isTap(down, endpoint({ x: 102, y: 201, t: 2_000 })), false);
});
