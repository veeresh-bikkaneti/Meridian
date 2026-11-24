import assert from "node:assert/strict";
import { test } from "node:test";
import { SEAM_MARKERS, seamMarkersIn } from "./check-seam-bundle.mjs";

test("the marker list names the inventory shortcuts", () => {
  assert.ok(SEAM_MARKERS.includes("loop-puzzle"));
  assert.ok(SEAM_MARKERS.includes("__spotScreen"));
  assert.ok(SEAM_MARKERS.includes("ForTests"));
  assert.ok(SEAM_MARKERS.includes("probeStaleBuild"));
});

test("a clean chunk passes", () => {
  assert.deepEqual(seamMarkersIn("function play(){return 1}"), []);
});

test("a marker in the chunk is named", () => {
  const found = seamMarkersIn('const q="loop-puzzle";el.__spotScreen=fn');
  assert.deepEqual(found, ["loop-puzzle", "__spotScreen"]);
});
