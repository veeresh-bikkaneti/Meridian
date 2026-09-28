import { geoAlbersUsa, geoMercator, geoOrthographic, type GeoProjection } from "d3-geo";
import type { LonLat, RingId } from "../game/types.ts";
import { nebraska, stateCollection } from "./atlas-data.ts";

export type { Affine } from "./affine.ts";
export { affineTransform, planeOf } from "./affine.ts";

export type Mode = "globe" | "albers" | "mercator";

export type View = {
  mode: Mode;
  width: number;
  height: number;
  scale: number;
  baseScale: number;
  center: LonLat;
  minScale: number;
  maxScale: number;
};

const LINCOLN: LonLat = [-96.69972, 40.81367];

function planarBounds(geometry: unknown): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      west = Math.min(west, node[0]);
      east = Math.max(east, node[0]);
      south = Math.min(south, node[1]);
      north = Math.max(north, node[1]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry);
  return [west, south, east, north];
}

function mercatorView(west: number, south: number, east: number, north: number, width: number, height: number): View {
  const center: LonLat = [(west + east) / 2, (south + north) / 2];
  const probe = geoMercator().scale(1).translate([0, 0]);
  const a = probe([west, south]);
  const b = probe([east, north]);
  const dx = Math.abs((b?.[0] ?? 1) - (a?.[0] ?? 0)) || 1;
  const dy = Math.abs((b?.[1] ?? 1) - (a?.[1] ?? 0)) || 1;
  const scale = Math.min((width - 48) / dx, (height - 48) / dy);
  return {
    mode: "mercator",
    width,
    height,
    scale,
    baseScale: scale,
    center,
    minScale: scale * 0.75,
    maxScale: scale * (east - west < 1 ? 18 : 10),
  };
}

export function projectionFor(view: View): GeoProjection {
  if (view.mode === "globe") {
    return geoOrthographic()
      .translate([view.width / 2, view.height / 2])
      .scale(view.scale)
      .rotate([-view.center[0], -view.center[1], 0])
      .clipAngle(90)
      .precision(0.8);
  }
  if (view.mode === "albers") {
    const projection = geoAlbersUsa().translate([0, 0]).scale(view.scale);
    const xy = projection(view.center);
    if (!xy) return geoAlbersUsa().scale(view.scale).translate([view.width / 2, view.height / 2]);
    projection.translate([view.width / 2 - xy[0], view.height / 2 - xy[1]]);
    return projection;
  }
  const projection = geoMercator().translate([0, 0]).scale(view.scale).precision(0.2);
  const xy = projection(view.center);
  if (!xy) return projection.translate([view.width / 2, view.height / 2]);
  projection.translate([view.width / 2 - xy[0], view.height / 2 - xy[1]]);
  return projection;
}

export function fitView(scope: RingId, width: number, height: number): View {
  if (scope === "world") {
    const scale = Math.min(width, height) * 0.46;
    return {
      mode: "globe",
      width,
      height,
      scale,
      baseScale: scale,
      center: [12, 18],
      minScale: scale * 0.92,
      maxScale: scale * 8,
    };
  }
  if (scope === "usa") {
    const fitted = geoAlbersUsa().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      stateCollection,
    );
    const scale = fitted.scale();
    const center = (fitted.invert?.([width / 2, height / 2]) as LonLat | null) ?? ([-97, 38] as LonLat);
    return { mode: "albers", width, height, scale, baseScale: scale, center, minScale: scale * 0.85, maxScale: scale * 8 };
  }
  const subject =
    scope === "nebraska" && nebraska
      ? planarBounds((nebraska as { geometry?: unknown }).geometry)
      : (() => {
          const radiusKm = scope === "lincoln" ? 15 : 80;
          const dLat = radiusKm / 110.574;
          const dLon = radiusKm / (111.32 * Math.cos((LINCOLN[1] * Math.PI) / 180));
          return [LINCOLN[0] - dLon, LINCOLN[1] - dLat, LINCOLN[0] + dLon, LINCOLN[1] + dLat] as [
            number,
            number,
            number,
            number,
          ];
        })();
  return mercatorView(subject[0], subject[1], subject[2], subject[3], width, height);
}

export function cloneView(view: View): View {
  return { ...view, center: [view.center[0], view.center[1]] };
}

export function panView(view: View, dx: number, dy: number) {
  const projection = projectionFor(view);
  const next = projection.invert?.([view.width / 2 - dx, view.height / 2 - dy]);
  if (next && Number.isFinite(next[0]) && Number.isFinite(next[1])) {
    view.center = [next[0], Math.max(-80, Math.min(80, next[1]))];
  }
}

export function invertView(view: View, x: number, y: number): LonLat | null {
  const at = projectionFor(view).invert?.([x, y]);
  if (!at || !Number.isFinite(at[0]) || !Number.isFinite(at[1])) return null;
  return [at[0], at[1]];
}

export function projectView(view: View, at: LonLat): [number, number] | null {
  const xy = projectionFor(view)(at);
  if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
  return [xy[0], xy[1]];
}
