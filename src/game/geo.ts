import type { LonLat, Place, Shape } from "./types.ts";
import type { Octant } from "./loop/types.ts";

const EARTH_KM = 6371.0088;

export function distanceKm(a: LonLat, b: LonLat): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const sin = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(sin)));
}

/**
 * Initial great-circle bearing from `a` toward `b`, in degrees clockwise
 * from true north, normalized to [0, 360). 0 = due north, 90 = due east.
 * Used by the GeoDetective edition to point the player from their guess
 * toward the target.
 */
export function initialBearing(a: LonLat, b: LonLat): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const OCTANTS: Octant[] = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

/**
 * Snap a bearing in degrees to the nearest of the 8 winds. North covers
 * [337.5, 360) ∪ [0, 22.5); each following wind covers a 45° sector
 * centered on its direction (NE = [22.5, 67.5), etc.).
 */
export function octantOf(degrees: number): Octant {
  const norm = ((degrees % 360) + 360) % 360;
  return OCTANTS[Math.floor(((norm + 22.5) % 360) / 45)];
}

export function pointInRing(point: LonLat, ring: LonLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi === yj && yj === y && x >= Math.min(xi, xj) && x <= Math.max(xi, xj)) return true;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentKm(p: LonLat, a: LonLat, b: LonLat): number {
  const lat0 = (p[1] * Math.PI) / 180;
  const kx = 111.32 * Math.cos(lat0);
  const ky = 110.574;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToShapeKm(point: LonLat, shape: Shape): number {
  if (shape.kind === "point") return distanceKm(point, shape.coordinates);
  const ring = shape.coordinates;
  if (ring.length < 3) return distanceKm(point, shape.coordinates[0] ?? point);
  if (pointInRing(point, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    best = Math.min(best, segmentKm(point, a, b));
  }
  return best;
}

export function distanceToPlaceKm(point: LonLat, place: Place): number {
  return distanceToShapeKm(point, place.shape);
}

export function disk(lon: number, lat: number, radiusKm: number, steps = 28): LonLat[] {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: LonLat[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
  }
  ring.push(ring[0]);
  return ring;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.max(0, Math.round(km * 1000))} m`;
  if (km < 100) return `${km.toFixed(km < 10 ? 1 : 1)} km`;
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
