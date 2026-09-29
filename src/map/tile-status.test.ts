import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_TILE_STATUS,
  tileStatusReducer,
  type TileStatus,
} from "./tile-status.ts";

function reduceFrom(
  state: TileStatus,
  ...events: Array<{ type: "tile-error" | "map-load" | "map-idle" | "load-timeout" | "retry" }>
): TileStatus {
  return events.reduce(tileStatusReducer, state);
}

test("initial state is loading with zero tile errors", () => {
  assert.deepEqual(INITIAL_TILE_STATUS, { kind: "loading", tileErrors: 0 });
});

test("a clean first idle resolves to ready", () => {
  assert.deepEqual(
    reduceFrom(INITIAL_TILE_STATUS, { type: "map-load" }, { type: "map-idle" }),
    { kind: "ready" },
  );
});

test("map-load alone is not success: errors after load still fail the set", () => {
  // the 41/41 case: "load" fires (style parsed) then every tile fails
  const state = reduceFrom(
    INITIAL_TILE_STATUS,
    { type: "map-load" },
    { type: "tile-error" },
    { type: "map-idle" },
  );
  assert.deepEqual(state, { kind: "failed", tileErrors: 1 });
});

test("tile errors before the first idle fail the set, keeping the count", () => {
  const state = reduceFrom(
    INITIAL_TILE_STATUS,
    { type: "tile-error" },
    { type: "tile-error" },
    { type: "tile-error" },
    { type: "map-idle" },
  );
  assert.deepEqual(state, { kind: "failed", tileErrors: 3 });
});

test("tile-error increments the count while loading", () => {
  const state = reduceFrom(INITIAL_TILE_STATUS, { type: "tile-error" });
  assert.deepEqual(state, { kind: "loading", tileErrors: 1 });
});

test("load-timeout while loading fails the set (dead style, not slow tiles)", () => {
  const state = reduceFrom(
    INITIAL_TILE_STATUS,
    { type: "tile-error" },
    { type: "load-timeout" },
  );
  assert.deepEqual(state, { kind: "failed", tileErrors: 1 });
});

test("load-timeout with no tile errors still fails (nothing will ever arrive)", () => {
  const state = reduceFrom(INITIAL_TILE_STATUS, { type: "load-timeout" });
  assert.deepEqual(state, { kind: "failed", tileErrors: 0 });
});

test("retry from failed returns to a fresh loading state", () => {
  const failed = reduceFrom(
    INITIAL_TILE_STATUS,
    { type: "tile-error" },
    { type: "map-idle" },
  );
  assert.equal(failed.kind, "failed");
  assert.deepEqual(reduceFrom(failed, { type: "retry" }), INITIAL_TILE_STATUS);
});

test("retry from ready starts a fresh attempt", () => {
  const ready = reduceFrom(INITIAL_TILE_STATUS, { type: "map-idle" });
  assert.equal(ready.kind, "ready");
  assert.deepEqual(reduceFrom(ready, { type: "retry" }), INITIAL_TILE_STATUS);
});

test("tile errors after ready stay ready (mid-session degradation out of scope)", () => {
  const ready = reduceFrom(INITIAL_TILE_STATUS, { type: "map-idle" });
  assert.deepEqual(reduceFrom(ready, { type: "tile-error" }), { kind: "ready" });
});

test("later idles after ready are no-ops (idle fires on every camera move)", () => {
  const ready = reduceFrom(INITIAL_TILE_STATUS, { type: "map-idle" });
  assert.deepEqual(reduceFrom(ready, { type: "map-idle" }), { kind: "ready" });
});

test("load-timeout after ready is a no-op", () => {
  const ready = reduceFrom(INITIAL_TILE_STATUS, { type: "map-idle" });
  assert.deepEqual(reduceFrom(ready, { type: "load-timeout" }), {
    kind: "ready",
  });
});

test("tile-error in failed state stays failed (no double counting)", () => {
  const failed = reduceFrom(
    INITIAL_TILE_STATUS,
    { type: "tile-error" },
    { type: "map-idle" },
  );
  assert.deepEqual(reduceFrom(failed, { type: "tile-error" }), {
    kind: "failed",
    tileErrors: 1,
  });
});
