import assert from "node:assert/strict";
import test from "node:test";
import { pair3dAllowed, pose3dFor } from "./pair3d.ts";
import { readFileSync } from "node:fs";
import { FRAME_3D, HOLMES_POSES_3D, WATSON_POSES_3D } from "./pair3d-poses.ts";

// The rig pose lists, read from DetectivePair.tsx's source (a .tsx this
// plain node test can't import).
const RIG_SRC = readFileSync(new URL("./DetectivePair.tsx", import.meta.url), "utf8");
function poseList(name: string): string[] {
  const m = RIG_SRC.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`));
  assert.ok(m, name);
  return [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
}
const HOLMES_POSES = poseList("HOLMES_POSES");
const WATSON_POSES = poseList("WATSON_POSES");

const ok = { flagOn: true, webgl: true, saveData: false, deviceMemory: 8, cores: 8 };

test("pair3d gate: needs the flag, WebGL and a device that isn't weak", () => {
  assert.equal(pair3dAllowed(ok), true);
  assert.equal(pair3dAllowed({ ...ok, flagOn: false }), false);
  assert.equal(pair3dAllowed({ ...ok, webgl: false }), false);
  assert.equal(pair3dAllowed({ ...ok, saveData: true }), false);
  assert.equal(pair3dAllowed({ ...ok, deviceMemory: 2 }), false);
  assert.equal(pair3dAllowed({ ...ok, cores: 2 }), false);
  // Browsers that don't report memory or cores still get it.
  assert.equal(pair3dAllowed({ ...ok, deviceMemory: undefined, cores: undefined }), true);
});

test("every rig pose has a 3D pose (no silent fallback in play)", () => {
  for (const p of HOLMES_POSES) assert.ok(HOLMES_POSES_3D[p], `holmes ${p}`);
  for (const p of WATSON_POSES) {
    if (p === "station-idle" || WATSON_POSES_3D[p]) continue;
    assert.fail(`watson ${p}`);
  }
  assert.equal(pose3dFor("holmes", "nope"), HOLMES_POSES_3D.dock);
  assert.equal(pose3dFor("watson", "nope"), WATSON_POSES_3D["station-idle"]);
});

test("the 3D frame matches each SVG rig's viewBox aspect", () => {
  assert.equal(FRAME_3D.holmes.aspect, 120 / 178);
  assert.equal(FRAME_3D.watson.aspect, 134 / 140);
});
