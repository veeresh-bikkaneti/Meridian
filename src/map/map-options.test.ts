import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TILE_CACHE_SIZE,
  SCOUT_MAX_ZOOM_FLAT,
  SETTLE_ZOOM_CAP_COUNTRY,
  SETTLE_ZOOM_CAP_STATE,
  mapOptionsForDevice,
  settleZoomCap,
} from "./map-options.ts";

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

test("full mode: settle-zoom caps unchanged (state 6.5, country 5.0)", () => {
  assert.equal(settleZoomCap("state", "full"), SETTLE_ZOOM_CAP_STATE);
  assert.equal(settleZoomCap("country", "full"), SETTLE_ZOOM_CAP_COUNTRY);
  assert.equal(SETTLE_ZOOM_CAP_STATE, 6.5);
  assert.equal(SETTLE_ZOOM_CAP_COUNTRY, 5.0);
});

test("scout flat maxZoom frames every state: cap 8, at full-mode parity", () => {
  // The original cap of 3 clamped the intro mid-flight (no zoom into the
  // edition, desynced zoom readout, dead + button); 6 still left the 12
  // smallest states (Rhode Island needs ~9) with the same symptoms. 8
  // reaches full-mode parity for every state. The lite promise is kept by
  // DPR 1 / zero raster tiles / no starfield / no motion — and the admin-1
  // boundary band is gated out of Scout, so no lazy geometry loads.
  assert.equal(SCOUT_MAX_ZOOM_FLAT, 8);
});

test("scout mode: settle zoom never exceeds the mode cap (no mid-flight clamp)", () => {
  assert.equal(settleZoomCap("state", "scout"), SETTLE_ZOOM_CAP_STATE);
  assert.equal(settleZoomCap("country", "scout"), SETTLE_ZOOM_CAP_COUNTRY);
  assert.ok(settleZoomCap("state", "scout") <= SCOUT_MAX_ZOOM_FLAT);
  assert.ok(settleZoomCap("country", "scout") <= SCOUT_MAX_ZOOM_FLAT);
});

test("scout mode: settle zoom actually frames a state (absolute property)", () => {
  // Guards against a silent re-tightening of the cap: the intro must be
  // able to reach at least zoom 4 in Scout, or states stop filling the
  // screen again. (Nebraska settles ~4.5-5.5 on a phone.)
  assert.ok(settleZoomCap("state", "scout") >= 4);
});
