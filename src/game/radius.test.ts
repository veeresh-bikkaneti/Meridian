import assert from "node:assert/strict";
import test from "node:test";
import { isHit, radiusKm } from "./radius.ts";

test("radius clamps by edition and the boundary is a hit", () => {
  assert.equal(radiusKm("state", 1000), 120);
  assert.equal(radiusKm("state", 100), 25);
  assert.equal(radiusKm("state", 2000), 160);
  assert.equal(radiusKm("country", 200), 40);
  assert.equal(radiusKm("country", 5000), 450);
  assert.equal(radiusKm("globe", 1000), 750);
  assert.equal(isHit(25, 25), true);
  assert.equal(isHit(25.1, 25), false);
});
