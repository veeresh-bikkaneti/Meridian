import type { LengthUnit } from "../game/units.ts";

/**
 * Map view types shared by the satellite map and the shell (step 8,
 * TD-06.8): these lived in src/map/satellite-map.tsx, which forced the
 * composer to import upward just for types. They are pure shapes, so
 * they sit in the domain layer; satellite-map re-exports them for its
 * existing importers. The point shape matches MapPoint in
 * src/map/variation.ts ({ lon, lat }) — structurally identical.
 */

export type MapMark = { lon: number; lat: number; tone: "aim" | "pin" | "spot" };

export type MapVariation = {
  pin: { lon: number; lat: number };
  spot: { lon: number; lat: number };
  kilometers: number;
  radiusKm: number;
  /** Unit for the miss-line map pill, from unitForEdition — same as the result headline. */
  unit: LengthUnit;
};

/**
 * PBI-5: a captured map viewport for state-preserving remounts (the
 * webglcontextlost → Scout Map switch). Re-opens mid-SPACE — center, zoom
 * AND projection — instead of replaying the intro.
 */
export interface ScoutRestoreView {
  center: [number, number];
  zoom: number;
  projection: "globe" | "mercator";
}
