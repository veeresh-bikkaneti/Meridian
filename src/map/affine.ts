import { geoAlbersUsa, geoMercator } from "d3-geo";
import type { LonLat } from "../game/types.ts";

export type FlatMode = "globe" | "albers" | "mercator";

export type Affine = { k: number; ox: number; oy: number };

type Placed = { mode: FlatMode; scale: number; center: LonLat };

/** Projected plane at scale 1. Pan and zoom of mercator and Albers are an affine of this plane. */
export function planeOf(at: LonLat, mode: FlatMode): [number, number] | null {
  if (mode === "globe") return null;
  const projection = mode === "albers" ? geoAlbersUsa().scale(1).translate([0, 0]) : geoMercator().scale(1).translate([0, 0]);
  const xy = projection(at);
  if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
  return [xy[0], xy[1]];
}

/** Maps a bitmap baked at `from` onto the screen of `to`. Null for the globe, which is not a flat photo. */
export function affineTransform(from: Placed, to: Placed): Affine | null {
  if (from.mode === "globe" || to.mode === "globe" || from.mode !== to.mode) return null;
  const a = planeOf(from.center, from.mode);
  const b = planeOf(to.center, to.mode);
  if (!a || !b || !(from.scale > 0)) return null;
  return { k: to.scale / from.scale, ox: (a[0] - b[0]) * to.scale, oy: (a[1] - b[1]) * to.scale };
}
