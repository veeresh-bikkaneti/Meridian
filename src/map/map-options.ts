/**
 * Map construction options that bound GPU/tile memory on phones.
 *
 * Extracted from satellite-map.tsx so the device policy is unit-testable
 * without constructing a MapLibre map. On coarse-pointer (touch) devices
 * the canvas pixel ratio is capped at 1.5 — an iPhone 11 renders at DPR 2
 * by default, and the WebGL canvas + tile textures are part of the same
 * jetsam budget that kills the page. Desktop/fine-pointer devices keep
 * MapLibre's default (full device pixel ratio).
 */

export const COARSE_POINTER_PIXEL_RATIO_CAP = 1.5;
export const MAX_TILE_CACHE_SIZE = 64;

export interface MapOptionsForDeviceInput {
  coarsePointer: boolean;
  devicePixelRatio?: number;
}

export interface MapOptionsForDevice {
  /** Undefined = let MapLibre use the device default. */
  pixelRatio?: number;
  maxTileCacheSize: number;
}

export function mapOptionsForDevice(input: MapOptionsForDeviceInput): MapOptionsForDevice {
  if (!input.coarsePointer) {
    return { maxTileCacheSize: MAX_TILE_CACHE_SIZE };
  }
  const dpr =
    typeof input.devicePixelRatio === "number" && Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
      ? input.devicePixelRatio
      : COARSE_POINTER_PIXEL_RATIO_CAP;
  return {
    pixelRatio: Math.min(dpr, COARSE_POINTER_PIXEL_RATIO_CAP),
    maxTileCacheSize: MAX_TILE_CACHE_SIZE,
  };
}

/** True when the primary pointer is coarse (touch) — guarded for SSR/tests. */
export function isCoarsePointer(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  } catch {
    return false;
  }
}
