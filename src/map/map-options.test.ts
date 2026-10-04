import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TILE_CACHE_SIZE, mapOptionsForDevice } from "./map-options.ts";

test("coarse pointer: pixelRatio capped at 1.5", () => {
  assert.equal(mapOptionsForDevice({ coarsePointer: true, devicePixelRatio: 2 }).pixelRatio, 1.5);
  assert.equal(mapOptionsForDevice({ coarsePointer: true, devicePixelRatio: 3 }).pixelRatio, 1.5);
  assert.equal(mapOptionsForDevice({ coarsePointer: true, devicePixelRatio: 1 }).pixelRatio, 1);
  assert.equal(mapOptionsForDevice({ coarsePointer: true }).pixelRatio, 1.5);
});

test("fine pointer: pixelRatio left to MapLibre default (undefined)", () => {
  const opts = mapOptionsForDevice({ coarsePointer: false, devicePixelRatio: 2 });
  assert.equal(opts.pixelRatio, undefined);
});

test("explicit maxTileCacheSize on every device class", () => {
  assert.equal(mapOptionsForDevice({ coarsePointer: true, devicePixelRatio: 2 }).maxTileCacheSize, MAX_TILE_CACHE_SIZE);
  assert.equal(mapOptionsForDevice({ coarsePointer: false }).maxTileCacheSize, MAX_TILE_CACHE_SIZE);
  assert.equal(MAX_TILE_CACHE_SIZE, 64);
});
