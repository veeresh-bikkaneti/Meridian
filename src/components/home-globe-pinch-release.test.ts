/**
 * Pinch release regression — lifting one finger of a two-finger pinch
 * (2 -> 1) must keep the drag alive for the finger that stays down.
 *
 * There is no React / canvas harness for the HomeGlobe shell in this
 * repo (node:test runs without jsdom; see home-loading-orbs.test.ts),
 * so the shell wiring is pinned by reading the source, following that
 * precedent. The pure controls layer is already covered in
 * home-globe/globe-controls.test.ts; this file pins the shell's
 * pointer lifecycle, which is where the defect lived: endDrag used to
 * dispatch dragEnd unconditionally on any pointerup/pointercancel,
 * so controls set dragging=false and idleTime=0 under a still-held
 * finger (auto-spin after 3 s and inertia between moves).
 *
 * Fail-on-old basis: on the pre-cure source endDrag has no
 * `pointers.size === 0` guard and no `pointers.size === 1` branch,
 * and onDown calls setPointerCapture bare — every assertion below
 * that looks for the guard, the 2 -> 1 branch or the try/catch fails.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const globe = readFileSync(join(here, "home-globe.tsx"), "utf8");

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = globe.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = globe.indexOf(endMarker, start);
  assert.ok(end > start, `missing ${endMarker} after ${startMarker}`);
  return globe.slice(start, end);
}

const onDown = sliceBetween("const onDown", "const onMove");
const endDrag = sliceBetween("const endDrag", "const ray");

describe("HomeGlobe shell — pinch 2 -> 1 release keeps the held finger dragging", () => {
  it("dispatches dragEnd only when the last pointer is released (size === 0)", () => {
    assert.ok(
      endDrag.indexOf("pointers.delete(e.pointerId)") <
        endDrag.indexOf("pointers.size === 0"),
      "the pointer must be deleted before the remaining count is checked",
    );
    assert.match(
      endDrag,
      /if \(pointers\.size === 0\) \{[\s\S]*?type: "dragEnd"/,
      "dragEnd must be dispatched inside the size === 0 branch only",
    );
    assert.equal(
      (endDrag.match(/type: "dragEnd"/g) || []).length,
      1,
      "exactly one dragEnd dispatch site, inside the size === 0 guard",
    );
  });

  it("on the 2 -> 1 transition clears pinch state and re-baselines without dragEnd", () => {
    const branchStart = endDrag.indexOf("if (pointers.size === 1)");
    assert.ok(branchStart >= 0, "a dedicated size === 1 (2 -> 1) branch must exist");
    const branchEnd = endDrag.indexOf("else if (pointers.size === 0)", branchStart);
    assert.ok(branchEnd > branchStart, "the 2 -> 1 branch must precede the final-release branch");
    const branch = endDrag.slice(branchStart, branchEnd);
    assert.ok(!branch.includes("dragEnd"), "the 2 -> 1 branch must not dispatch dragEnd");
    assert.ok(!branch.includes('cursor = "grab"'), "cursor stays grabbing while a finger is held");
    assert.ok(branch.includes("lastMid = null"), "the 2 -> 1 branch clears the pinch midpoint");
    assert.ok(branch.includes("pinchStartDist = 0"), "the 2 -> 1 branch clears the pinch distance");
    assert.ok(
      branch.includes("lastMoveT = performance.now()"),
      "the 2 -> 1 branch re-baselines the move clock for the remaining pointer",
    );
  });

  it("still releases pointer capture for the lifted pointer on every end", () => {
    assert.match(
      endDrag,
      /try \{\s*canvas\.releasePointerCapture\(e\.pointerId\);/,
      "releasePointerCapture stays in its try/catch for the lifted pointer",
    );
  });

  it("wraps setPointerCapture in onDown so an inactive pointer cannot kill the gesture", () => {
    assert.match(
      onDown,
      /try \{\s*canvas\.setPointerCapture\(e\.pointerId\);\s*\} catch/,
      "setPointerCapture must be wrapped in the same try/catch as releasePointerCapture",
    );
    assert.ok(
      onDown.indexOf("canvas.setPointerCapture(e.pointerId)") <
        onDown.indexOf("pointers.set(e.pointerId"),
      "capture is attempted before the pointer is recorded, as before",
    );
  });
});
