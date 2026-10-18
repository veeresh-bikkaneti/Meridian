import type { MapMode } from "./capability.ts";

/**
 * Map construction options that bound GPU/tile memory on phones.
 *
 * Extracted from satellite-map.tsx so the device policy is unit-testable
 * without constructing a MapLibre map. On coarse-pointer (touch) devices
 * the canvas pixel ratio is capped at 1.5 — an iPhone 11 renders at DPR 2
 * by default, and the WebGL canvas + tile textures are part of the same
 * jetsam budget that kills the page. Desktop/fine-pointer devices keep
 * MapLibre's default (full device pixel ratio).
 *
 * Scout Map (PBI-2+): when `mapMode` is "scout" the canvas pixel ratio is
 * capped at 1 (maxZoom bounds are applied at construction in
 * satellite-map.tsx, which also needs the edition). The full-mode path is
 * byte-identical in behavior — every scout branch is flag-guarded.
 */

export const COARSE_POINTER_PIXEL_RATIO_CAP = 1.5;
export const SCOUT_PIXEL_RATIO_CAP = 1;
/**
 * Scout flat maxZoom — 8, matching full mode's effective flat range. The
 * original lite-mode spec capped flat at 3, but a state edition needs ~5 on
 * a phone to frame the region (Rhode Island needs ~9); at 3 the intro
 * clamped mid-flight, the state never filled the screen, the zoom readout
 * desynced from the real camera, and the + button died at the cap — the
 * edition was unplayable in Scout Map. The lite promise is kept by what the
 * cap never touched: DPR 1, zero raster tiles, no starfield, no motion.
 * Raising the cap does NOT pull the admin-1 boundary band into Scout —
 * paintBoundaryBand is clamped to "countries" in scout mode (see
 * satellite-map.tsx), so the ~1.6 MB of lazy admin-1 geometry never loads
 * on weak devices.
 */
export const SCOUT_MAX_ZOOM_FLAT = 8;
export const SCOUT_MAX_ZOOM_GLOBE = 2;
export const MAX_TILE_CACHE_SIZE = 64;

/** Intro settle-zoom caps per flat edition, before the map-mode cap applies. */
export const SETTLE_ZOOM_CAP_STATE = 6.5;
export const SETTLE_ZOOM_CAP_COUNTRY = 5.0;

/**
 * Effective intro settle-zoom cap for an edition + map mode. Scout Map
 * clamps to its flat maxZoom so the intro targets a zoom the camera can
 * actually reach — an unreachable target clamps mid-flight, desyncs the
 * zoom readout from the real camera, and leaves the + button dead at the
 * cap. Full mode is unchanged.
 */
export function settleZoomCap(edition: "state" | "country", mapMode: MapMode): number {
  const editionCap = edition === "state" ? SETTLE_ZOOM_CAP_STATE : SETTLE_ZOOM_CAP_COUNTRY;
  if (mapMode !== "scout") return editionCap;
  return Math.min(editionCap, SCOUT_MAX_ZOOM_FLAT);
}

export interface MapOptionsForDeviceInput {
  coarsePointer: boolean;
  devicePixelRatio?: number;
  /** Game map mode — default "full". Full-mode output is unchanged. */
  mapMode?: MapMode;
}

export interface MapOptionsForDevice {
  /** Undefined = let MapLibre use the device default. */
  pixelRatio?: number;
  maxTileCacheSize: number;
}

export function mapOptionsForDevice(input: MapOptionsForDeviceInput): MapOptionsForDevice {
  if (input.mapMode === "scout") {
    const dpr =
      typeof input.devicePixelRatio === "number" && Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
        ? input.devicePixelRatio
        : SCOUT_PIXEL_RATIO_CAP;
    return {
      pixelRatio: Math.min(dpr, SCOUT_PIXEL_RATIO_CAP),
      maxTileCacheSize: MAX_TILE_CACHE_SIZE,
    };
  }
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
