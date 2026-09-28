import assert from "node:assert/strict";
import test from "node:test";
import { affineTransform } from "./affine.ts";

function mercator(scale: number, center: [number, number]) {
  return {
    mode: "mercator" as const,
    scale,
    center,
  };
}

test("zoom keeps the center and only changes scale", () => {
  const from = mercator(1000, [-96.7, 40.8]);
  const to = mercator(1500, [-96.7, 40.8]);
  const affine = affineTransform(from, to);
  assert.ok(affine);
  assert.equal(affine.k, 1.5);
  assert.ok(Math.abs(affine.ox) < 1e-6);
  assert.ok(Math.abs(affine.oy) < 1e-6);
});

test("panning east shifts the baked image left", () => {
  const from = mercator(4000, [-96.7, 40.8]);
  const to = mercator(4000, [-96.4, 40.8]);
  const affine = affineTransform(from, to);
  assert.ok(affine);
  assert.ok(affine.ox < 0);
  assert.equal(affine.k, 1);
});

test("the globe is not a flat photograph", () => {
  const globe = { mode: "globe" as const, scale: 200, center: [10, 20] as [number, number] };
  assert.equal(affineTransform(globe, globe), null);
});
