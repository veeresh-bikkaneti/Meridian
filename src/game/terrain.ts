import type { LonLat } from "./types.ts";
import {
  LINCOLN_TERRAIN,
  NEBRASKA_TERRAIN,
  REGION_TERRAIN,
  USA_TERRAIN,
  WORLD_TERRAIN,
} from "./basemap-data.ts";

export type TerrainKind = "park" | "water" | "river" | "road" | "highway";

export type TerrainFeature = {
  kind: TerrainKind;
  coordinates: LonLat[];
  rank: number;
};

export function terrainFor(scope: "lincoln" | "region" | "nebraska" | "usa" | "world"): TerrainFeature[] {
  if (scope === "lincoln") return LINCOLN_TERRAIN;
  if (scope === "region") return REGION_TERRAIN;
  if (scope === "nebraska") return NEBRASKA_TERRAIN;
  if (scope === "usa") return USA_TERRAIN;
  return WORLD_TERRAIN;
}
