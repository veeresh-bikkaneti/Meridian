import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIRECTION_DEAD_ZONE,
  directionCellIndex,
  directionForPointer,
  GRANDPA_DIRECTIONS,
} from "./grandpa-direction.ts";
import {
  grandpaDirectionsUrl,
  grandpaReactionsUrl,
  grandpaStaticUrl,
} from "./storyteller-lines.ts";

describe("directionForPointer — cursor-tracking sector math", () => {
  it("maps the four cardinals", () => {
    assert.equal(directionForPointer(-100, 0), "left");
    assert.equal(directionForPointer(100, 0), "right");
    assert.equal(directionForPointer(0, -100), "up");
    assert.equal(directionForPointer(0, 100), "down");
  });

  it("maps the four diagonals", () => {
    assert.equal(directionForPointer(-100, -100), "up-left");
    assert.equal(directionForPointer(100, -100), "up-right");
    assert.equal(directionForPointer(-100, 100), "down-left");
    assert.equal(directionForPointer(100, 100), "down-right");
  });

  it("returns center inside the dead zone", () => {
    assert.equal(directionForPointer(0, 0), "center");
    assert.equal(directionForPointer(10, 10), "center");
    assert.equal(directionForPointer(DIRECTION_DEAD_ZONE - 1, 0), "center");
    assert.equal(directionForPointer(0, -(DIRECTION_DEAD_ZONE - 1)), "center");
  });

  it("leaves the dead zone exactly at its radius", () => {
    assert.equal(directionForPointer(DIRECTION_DEAD_ZONE, 0), "right");
    assert.equal(directionForPointer(-DIRECTION_DEAD_ZONE, 0), "left");
  });
});

describe("directionCellIndex — sheet row-major order", () => {
  it("follows the 3x3 row-major layout", () => {
    assert.deepEqual(GRANDPA_DIRECTIONS, [
      "up-left",
      "up",
      "up-right",
      "left",
      "center",
      "right",
      "down-left",
      "down",
      "down-right",
    ]);
    assert.equal(directionCellIndex("up-left"), 0);
    assert.equal(directionCellIndex("center"), 4);
    assert.equal(directionCellIndex("down-right"), 8);
    // center cell → background-position "50% 50%" with the 300% trick.
    const i = directionCellIndex("center");
    assert.equal(`${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`, "50% 50%");
  });
});

describe("grandpa asset URLs", () => {
  it("points at the transparent webp sheets and static center cell", () => {
    // Under node --test import.meta.env is undefined → base falls back to "/".
    assert.equal(
      grandpaDirectionsUrl(),
      "/images/storyteller/grandpa-directions.webp",
    );
    assert.equal(
      grandpaReactionsUrl(),
      "/images/storyteller/grandpa-reactions.webp",
    );
    assert.equal(grandpaStaticUrl(), "/images/storyteller/grandpa-static.webp");
  });
});
