import test from "node:test";
import assert from "node:assert/strict";
import { bandForZoom, paintBoundaryBand, clearBoundaryBands } from "./boundary-bands.ts";

test("bandForZoom returns continents for zoom < 3", () => {
  assert.equal(bandForZoom(0), "continents");
  assert.equal(bandForZoom(1), "continents");
  assert.equal(bandForZoom(2.9), "continents");
});

test("bandForZoom returns countries for 3 <= zoom < 6", () => {
  assert.equal(bandForZoom(3), "countries");
  assert.equal(bandForZoom(4.5), "countries");
  assert.equal(bandForZoom(5.9), "countries");
});

test("bandForZoom returns admin1 for zoom >= 6", () => {
  assert.equal(bandForZoom(6), "admin1");
  assert.equal(bandForZoom(10), "admin1");
  assert.equal(bandForZoom(15), "admin1");
});

// Minimal MapLibre mock for testing paint logic.
function createMockMap() {
  const layers = new Map<string, any>();
  const sources = new Map<string, any>();
  const addLayerCalls: any[] = [];
  return {
    layers,
    sources,
    addLayerCalls,
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, _spec: any) => {
      sources.set(id, {});
    },
    addLayer: (spec: any, _beforeId?: string) => {
      layers.set(spec.id, spec);
      addLayerCalls.push(spec);
    },
    removeLayer: (id: string) => {
      layers.delete(id);
    },
    removeSource: (id: string) => {
      sources.delete(id);
    },
  };
}

// paintBoundaryBand is async internally (lazy data loading); wait a tick.
async function paintAndSettle(map: any, band: "continents" | "countries" | "admin1") {
  paintBoundaryBand(map, band);
  // Allow the async paint to complete (dynamic imports resolve).
  await new Promise((resolve) => setTimeout(resolve, 100));
}

test("paintBoundaryBand paints continent line layer (no symbols)", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "continents");
  const spec = map.addLayerCalls.find((c) => c.id === "boundary-continents");
  assert.ok(spec, "continent layer added");
  assert.equal(spec.type, "line");
  // No labels — line layer only, never symbol.
  for (const call of map.addLayerCalls) {
    assert.notEqual(call.type, "symbol", "no symbol layers allowed");
  }
});

test("paintBoundaryBand paints country line layer", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "countries");
  const spec = map.addLayerCalls.find((c) => c.id === "boundary-countries");
  assert.ok(spec, "country layer added");
  assert.equal(spec.type, "line");
});

test("paintBoundaryBand paints admin1 layers plus country lines", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "admin1");
  const usStates = map.addLayerCalls.find((c) => c.id === "boundary-us-states");
  assert.ok(usStates, "US states layer added");
  // Country lines kept for regions without admin-1 data (e.g. France, Japan).
  const countries = map.addLayerCalls.find((c) => c.id === "boundary-countries");
  assert.ok(countries, "country lines kept at admin1 band");
  // NE admin-1 (async) — 116 features for AU/BR/CA/CN/IN.
  const neAdmin1 = map.addLayerCalls.find((c) => c.id === "boundary-ne-admin1");
  assert.ok(neAdmin1, "NE admin-1 layer added");
});

test("paintBoundaryBand is idempotent", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "countries");
  const callsAfterFirst = map.addLayerCalls.length;
  await paintAndSettle(map as any, "countries");
  assert.equal(map.addLayerCalls.length, callsAfterFirst, "second call is no-op");
});

test("paintBoundaryBand removes old band layers and sources on switch", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "continents");
  assert.ok(map.layers.has("boundary-continents"));
  assert.ok(map.sources.has("boundary-src-continents"));
  await paintAndSettle(map as any, "countries");
  assert.ok(!map.layers.has("boundary-continents"), "old layer removed");
  assert.ok(!map.sources.has("boundary-src-continents"), "orphaned source removed");
  assert.ok(map.layers.has("boundary-countries"), "new layer added");
});

test("paintBoundaryBand uses subtle styling", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "countries");
  const spec = map.addLayerCalls[0];
  assert.equal(spec.paint["line-width"], 1, "thin line");
  assert.ok(spec.paint["line-opacity"] < 0.5, "semi-transparent");
  assert.ok(!/gold|#ffd700/i.test(spec.paint["line-color"]), "not gold");
});

test("clearBoundaryBands removes all layers and sources", async () => {
  const map = createMockMap();
  await paintAndSettle(map as any, "countries");
  assert.ok(map.layers.size > 0);
  clearBoundaryBands(map as any);
  assert.equal(map.layers.size, 0, "all layers removed");
  assert.equal(map.sources.size, 0, "all sources removed");
});
