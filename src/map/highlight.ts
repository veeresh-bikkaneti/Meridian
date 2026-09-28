import { geoContains } from "d3-geo";
import type { LonLat, RingId } from "../game/types.ts";
import { counties, countries, stateCollection } from "./atlas-data.ts";

export function locateHighlight(scope: RingId, at: LonLat): string | null {
  const features = scope === "world" ? countries.features : scope === "usa" ? stateCollection.features : null;
  if (!features) return null;
  const hit = features.find((feat) => geoContains(feat as never, at));
  return hit?.id != null ? String(hit.id) : null;
}

export async function locateCounty(at: LonLat): Promise<string | null> {
  const pack = await counties();
  const hit = pack.features.find((feat) => geoContains(feat as never, at));
  return hit?.id != null ? String(hit.id) : null;
}
