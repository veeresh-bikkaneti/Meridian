import assert from "node:assert/strict";
import test from "node:test";
import { classifyTap, DOUBLE_TAP_MS } from "./pin-tap.ts";
import { variationLine } from "./variation.ts";

test("the first tap places a pin and a quick second tap on it confirms", () => {
  const first = { x: 40, y: 80, t: 1_000 };
  assert.equal(classifyTap(null, first), "place");
  assert.equal(classifyTap(first, { x: 44, y: 76, t: 1_000 + DOUBLE_TAP_MS }), "confirm");
});

test("a later tap, or a tap somewhere else, only moves the pin", () => {
  const first = { x: 40, y: 80, t: 1_000 };
  assert.equal(classifyTap(first, { x: 42, y: 81, t: 1_000 + DOUBLE_TAP_MS + 1 }), "place");
  assert.equal(classifyTap(first, { x: 90, y: 80, t: 1_100 }), "place");
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
