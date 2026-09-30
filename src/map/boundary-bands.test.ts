import { describe, it, expect, vi, beforeEach } from "vitest";
import { bandForZoom, paintBoundaryBand, clearBoundaryBands } from "./boundary-bands";

describe("bandForZoom", () => {
  it("returns continents for zoom < 3", () => {
    expect(bandForZoom(0)).toBe("continents");
    expect(bandForZoom(1)).toBe("continents");
    expect(bandForZoom(2.9)).toBe("continents");
  });

  it("returns countries for 3 <= zoom < 6", () => {
    expect(bandForZoom(3)).toBe("countries");
    expect(bandForZoom(4.5)).toBe("countries");
    expect(bandForZoom(5.9)).toBe("countries");
  });

  it("returns admin1 for zoom >= 6", () => {
    expect(bandForZoom(6)).toBe("admin1");
    expect(bandForZoom(10)).toBe("admin1");
    expect(bandForZoom(15)).toBe("admin1");
  });
});

describe("paintBoundaryBand", () => {
  let map: any;
  let layers: Map<string, any>;
  let sources: Map<string, any>;

  beforeEach(() => {
    layers = new Map();
    sources = new Map();
    map = {
      getLayer: vi.fn((id: string) => layers.get(id)),
      getSource: vi.fn((id: string) => sources.get(id)),
      addSource: vi.fn((id: string, _spec: any) => {
        sources.set(id, {});
      }),
      addLayer: vi.fn((spec: any) => {
        layers.set(spec.id, spec);
      }),
      removeLayer: vi.fn((id: string) => {
        layers.delete(id);
      }),
      removeSource: vi.fn((id: string) => {
        sources.delete(id);
      }),
    };
  });

  it("paints continent layer for continents band", () => {
    paintBoundaryBand(map, "continents");
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "boundary-continents", type: "line" })
    );
    // No labels — line layer only, no symbol layers.
    const calls = map.addLayer.mock.calls;
    for (const [spec] of calls) {
      expect(spec.type).not.toBe("symbol");
    }
  });

  it("paints country layer for countries band", () => {
    paintBoundaryBand(map, "countries");
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "boundary-countries", type: "line" })
    );
  });

  it("paints admin1 layers (US states + NE) for admin1 band", () => {
    paintBoundaryBand(map, "admin1");
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "boundary-us-states", type: "line" })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "boundary-ne-admin1", type: "line" })
    );
  });

  it("is idempotent — second call with same band does nothing", () => {
    paintBoundaryBand(map, "countries");
    const callsAfterFirst = map.addLayer.mock.calls.length;
    paintBoundaryBand(map, "countries");
    expect(map.addLayer.mock.calls.length).toBe(callsAfterFirst);
  });

  it("removes old band layers when switching", () => {
    paintBoundaryBand(map, "continents");
    expect(layers.has("boundary-continents")).toBe(true);
    paintBoundaryBand(map, "countries");
    expect(layers.has("boundary-continents")).toBe(false);
    expect(layers.has("boundary-countries")).toBe(true);
  });

  it("uses subtle styling that does not compete with the highlight", () => {
    paintBoundaryBand(map, "countries");
    const spec = map.addLayer.mock.calls[0][0];
    // Thin, semi-transparent gray — not gold, not thick.
    expect(spec.paint["line-width"]).toBe(1);
    expect(spec.paint["line-opacity"]).toBeLessThan(0.5);
    expect(spec.paint["line-color"]).not.toMatch(/gold|#ffd700/i);
  });
});

describe("clearBoundaryBands", () => {
  it("removes all boundary layers and sources", () => {
    const layers = new Map([["boundary-countries", {}]]);
    const sources = new Map([["boundary-src-countries", {}]]);
    const map: any = {
      getLayer: (id: string) => layers.get(id),
      getSource: (id: string) => sources.get(id),
      removeLayer: vi.fn((id: string) => layers.delete(id)),
      removeSource: vi.fn((id: string) => sources.delete(id)),
    };
    clearBoundaryBands(map);
    expect(layers.size).toBe(0);
    expect(sources.size).toBe(0);
  });
});
