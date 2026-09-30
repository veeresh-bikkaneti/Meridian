import test from "node:test";
import assert from "node:assert/strict";
import { paintRegionHighlight } from "./region-highlight.ts";
import type { RegionGeometryDTO } from "./region-index.ts";

// The animated path schedules a settle via window.setTimeout; shim it.
(globalThis as any).window ??= {
  setTimeout: (...args: any[]) => setTimeout(...(args as [any, any])),
  clearTimeout: (...args: any[]) => clearTimeout(...(args as [any])),
};

// Minimal MapLibre mock for testing paint logic.
function createMockMap() {
  const layers = new Map<string, any>();
  const sources = new Map<string, any>();
  const addLayerCalls: any[] = [];
  const paintProps: Array<{ layer: string; prop: string; value: unknown }> =
    [];
  return {
    layers,
    sources,
    addLayerCalls,
    paintProps,
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, _spec: any) => {
      sources.set(id, {});
    },
    addLayer: (spec: any) => {
      layers.set(spec.id, spec);
      addLayerCalls.push(spec);
    },
    removeLayer: (id: string) => {
      layers.delete(id);
    },
    removeSource: (id: string) => {
      sources.delete(id);
    },
    setPaintProperty: (layer: string, prop: string, value: unknown) => {
      paintProps.push({ layer, prop, value });
    },
    getStyle: () => ({ layers: [...layers.keys()].map((id) => ({ id })) }),
  };
}

const dto: RegionGeometryDTO = {
  id: "nebraska",
  name: "Nebraska",
  bounds: [-104, 40, -95, 43],
  center: [-99.5, 41.5],
  polygonCoords: {
    type: "Polygon",
    coordinates: [
      [
        [-104, 40],
        [-95, 40],
        [-95, 43],
        [-104, 43],
        [-104, 40],
      ],
    ],
  },
};

/** Recursively collect keys whose value is undefined. */
function undefinedKeys(obj: unknown, path = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (v === undefined) out.push(p);
    else out.push(...undefinedKeys(v, p));
  }
  return out;
}

test("instant paint omits transition keys (no undefined values)", () => {
  // Regression test: a present-but-undefined transition value fails
  // MapLibre's style-spec validation, and Style#addLayer silently drops the
  // layer on validation failure (fires ErrorEvent, never throws). The
  // reduced-motion path used to pass `"*-transition": undefined`, so the
  // source was created but all three layers were missing.
  const map = createMockMap();
  paintRegionHighlight(map as any, dto, { instant: true });
  assert.equal(map.addLayerCalls.length, 3);
  for (const spec of map.addLayerCalls) {
    assert.deepEqual(undefinedKeys(spec), [], `undefined in ${spec.id}`);
  }
  assert.ok(map.getLayer("region-fill"));
  assert.ok(map.getLayer("region-casing"));
  assert.ok(map.getLayer("region-outline"));
});

test("animated paint includes transition objects", () => {
  const map = createMockMap();
  paintRegionHighlight(map as any, dto, { instant: false });
  assert.equal(map.addLayerCalls.length, 3);
  const fill = map.addLayerCalls.find((s: any) => s.id === "region-fill");
  assert.ok(fill);
  assert.deepEqual(fill.paint["fill-opacity-transition"], {
    duration: 650,
    delay: 0,
  });
});
