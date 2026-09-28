import earcut from "earcut";
import type { Colors } from "./colors.ts";
import { rgbUnit, tone } from "./colors.ts";
import { countries, countryBorders, coast } from "./atlas-data.ts";
import { terrainFor } from "../game/terrain.ts";

type Ring = number[][];

/**
 * Unit-sphere globe: country triangles plus coast, border, river, and graticule lines.
 * Built once. Colors are filled in later so a theme change does not retriangulate.
 */
export type GlobeGeometry = {
  triPos: Float32Array;
  triVerts: number;
  linePos: Float32Array;
  lineVerts: number;
};

let geometryCache: GlobeGeometry | null = null;

class Grow {
  private arr = new Float32Array(4096);
  n = 0;
  push(a: number, b: number, c: number, d = 0, e = 0, f = 0, count = 3) {
    if (this.n + count > this.arr.length) {
      const next = new Float32Array(Math.max(this.arr.length * 2, this.n + count));
      next.set(this.arr);
      this.arr = next;
    }
    this.arr[this.n++] = a;
    this.arr[this.n++] = b;
    this.arr[this.n++] = c;
    if (count > 3) this.arr[this.n++] = d;
    if (count > 4) this.arr[this.n++] = e;
    if (count > 5) this.arr[this.n++] = f;
  }
  freeze() {
    return this.arr.slice(0, this.n);
  }
}

function span(a: number, b: number) {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function tooLong(ax: number, ay: number, bx: number, by: number, maxDeg: number) {
  const dx = span(ax, bx);
  const dy = by - ay;
  return dx * dx + dy * dy > maxDeg * maxDeg;
}

function subdivide(tris: number[], maxDeg: number, depth: number, out: number[]) {
  for (let i = 0; i < tris.length; i += 6) {
    const ax = tris[i];
    const ay = tris[i + 1];
    const bx = tris[i + 2];
    const by = tris[i + 3];
    const cx = tris[i + 4];
    const cy = tris[i + 5];
    const split = depth < 3 && (tooLong(ax, ay, bx, by, maxDeg) || tooLong(bx, by, cx, cy, maxDeg) || tooLong(cx, cy, ax, ay, maxDeg));
    if (!split || out.length > 900000) {
      out.push(ax, ay, bx, by, cx, cy);
      continue;
    }
    const abx = ax + span(ax, bx) / 2;
    const aby = (ay + by) / 2;
    const bcx = bx + span(bx, cx) / 2;
    const bcy = (by + cy) / 2;
    const cax = cx + span(cx, ax) / 2;
    const cay = (cy + ay) / 2;
    const next = [ax, ay, abx, aby, cax, cay, bx, by, bcx, bcy, abx, aby, cx, cy, cax, cay, bcx, bcy, abx, aby, bcx, bcy, cax, cay];
    subdivide(next, maxDeg, depth + 1, out);
  }
}

function addPolygon(rings: Ring[], id: number, sink: number[]) {
  if (!rings.length || rings[0].length < 3) return;
  const flat: number[] = [];
  const holes: number[] = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    if (ring.length < 3) continue;
    if (r > 0) holes.push(flat.length / 2);
    for (const pt of ring) {
      if (pt.length < 2) continue;
      flat.push(pt[0], pt[1]);
    }
  }
  if (flat.length < 6) return;
  let indices: number[] = [];
  try {
    indices = earcut(flat, holes.length ? holes : undefined, 2);
  } catch {
    return;
  }
  const rough: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 2;
    const b = indices[i + 1] * 2;
    const c = indices[i + 2] * 2;
    const ax = flat[a];
    const ay = flat[a + 1];
    const bx = flat[b];
    const by = flat[b + 1];
    const cx = flat[c];
    const cy = flat[c + 1];
    if (tooLong(ax, ay, bx, by, 80) || tooLong(bx, by, cx, cy, 80) || tooLong(cx, cy, ax, ay, 80)) continue;
    rough.push(ax, ay, bx, by, cx, cy);
  }
  const fine: number[] = [];
  subdivide(rough, 16, 0, fine);
  if (sink.length / 3 + fine.length / 2 > 220000) {
    for (let i = 0; i < rough.length; i += 2) sink.push(rough[i], rough[i + 1], id);
    return;
  }
  for (let i = 0; i < fine.length; i += 2) sink.push(fine[i], fine[i + 1], id);
}

function addGeometry(geometry: unknown, id: number, sink: number[]) {
  if (!geometry || typeof geometry !== "object") return;
  const geo = geometry as { type?: string; coordinates?: unknown };
  if (geo.type === "Polygon") addPolygon(geo.coordinates as Ring[], id, sink);
  else if (geo.type === "MultiPolygon") {
    for (const poly of geo.coordinates as Ring[][]) addPolygon(poly, id, sink);
  }
}

function pushLine(grow: Grow, ax: number, ay: number, bx: number, by: number, group: number) {
  if (!Number.isFinite(ax) || !Number.isFinite(bx)) return;
  if (tooLong(ax, ay, bx, by, 8)) {
    const mx = ax + span(ax, bx) / 2;
    const my = (ay + by) / 2;
    pushLine(grow, ax, ay, mx, my, group);
    pushLine(grow, mx, my, bx, by, group);
    return;
  }
  grow.push(ax, ay, bx, by, group, 0, 5);
  grow.push(bx, by, ax, ay, group, 0, 5);
}

function addLines(geometry: unknown, group: number, grow: Grow) {
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const geo = node as { type?: string; coordinates?: unknown; geometries?: unknown[] };
    if (geo.type === "LineString") {
      const line = geo.coordinates as number[][];
      for (let i = 1; i < line.length; i++) pushLine(grow, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], group);
    } else if (geo.type === "MultiLineString") {
      for (const line of geo.coordinates as number[][][]) {
        for (let i = 1; i < line.length; i++) pushLine(grow, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], group);
      }
    } else if (geo.type === "GeometryCollection" && geo.geometries) {
      for (const child of geo.geometries) walk(child);
    }
  };
  walk(geometry);
}

function graticule(grow: Grow) {
  for (let lon = -180; lon < 180; lon += 15) {
    for (let lat = -75; lat < 75; lat += 4) pushLine(grow, lon, lat, lon, lat + 4, 3);
  }
  for (let lat = -60; lat <= 60; lat += 15) {
    for (let lon = -180; lon < 180; lon += 4) pushLine(grow, lon, lat, lon + 4, lat, 3);
  }
}

export function globeGeometry(): GlobeGeometry {
  if (geometryCache) return geometryCache;
  const sink: number[] = [];
  for (const feat of countries.features) {
    const id = Number(feat.id);
    addGeometry(feat.geometry, Number.isFinite(id) ? id : 0, sink);
  }
  for (const lake of terrainFor("world")) {
    if (lake.kind !== "water" || lake.coordinates.length < 3) continue;
    addPolygon([lake.coordinates], 0, sink);
  }
  const lines = new Grow();
  addLines(coast, 0, lines);
  addLines(countryBorders, 1, lines);
  for (const river of terrainFor("world")) {
    if (river.kind !== "river") continue;
    for (let i = 1; i < river.coordinates.length; i++) {
      const a = river.coordinates[i - 1];
      const b = river.coordinates[i];
      pushLine(lines, a[0], a[1], b[0], b[1], 2);
    }
  }
  graticule(lines);
  const triPos = new Float32Array(sink);
  geometryCache = {
    triPos,
    triVerts: triPos.length / 3,
    linePos: lines.freeze(),
    lineVerts: lines.n / 5,
  };
  return geometryCache;
}

const GROUP_COLOR = ["coast", "border", "river", "border"] as const;

export function paintGlobeBuffers(colors: Colors) {
  const geo = globeGeometry();
  const triangles = new Float32Array(geo.triVerts * 6);
  for (let i = 0; i < geo.triVerts; i++) {
    const lon = geo.triPos[i * 3];
    const lat = geo.triPos[i * 3 + 1];
    const id = geo.triPos[i * 3 + 2];
    const rgb = id > 0 ? rgbUnit(tone(String(id), colors.land)) : rgbUnit(colors.lake);
    const o = i * 6;
    triangles[o] = lon;
    triangles[o + 1] = lat;
    triangles[o + 2] = rgb[0];
    triangles[o + 3] = rgb[1];
    triangles[o + 4] = rgb[2];
    triangles[o + 5] = id;
  }
  const lineColors = {
    coast: rgbUnit(colors.coast),
    border: rgbUnit(colors.border),
    river: rgbUnit(colors.river),
  };
  const lines = new Float32Array(geo.lineVerts * 8);
  const alphaFor = [1, 0.85, 1, 0.28];
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < geo.lineVerts; i++) {
    const base = i * 5;
    const group = geo.linePos[base + 4] ?? 1;
    const name = GROUP_COLOR[group] ?? "border";
    const rgb = lineColors[name];
    const o = i * 8;
    lines[o] = geo.linePos[base];
    lines[o + 1] = geo.linePos[base + 1];
    lines[o + 2] = geo.linePos[base + 2];
    lines[o + 3] = geo.linePos[base + 3];
    lines[o + 4] = rgb[0];
    lines[o + 5] = rgb[1];
    lines[o + 6] = rgb[2];
    lines[o + 7] = alphaFor[group] ?? 1;
    counts[group] += 1;
  }
  return {
    triangles,
    lines,
    triVerts: geo.triVerts,
    lineVerts: geo.lineVerts,
    coastVerts: counts[0],
    borderVerts: counts[1],
    riverVerts: counts[2],
    graticuleVerts: counts[3],
  };
}
