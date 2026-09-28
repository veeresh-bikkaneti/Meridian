import { feature, mesh } from "topojson-client";
import world from "world-atlas/countries-50m.json";
import states from "us-atlas/states-10m.json";
import { geoGraticule10 } from "d3-geo";

export type Feat = { id?: string | number; type: "Feature"; geometry: unknown };
export type Collection = { type: "FeatureCollection"; features: Feat[] };

export const countries = feature(world, world.objects.countries) as unknown as Collection;
export const coast = mesh(world, world.objects.countries, (a, b) => a === b);
export const countryBorders = mesh(world, world.objects.countries, (a, b) => a !== b);
export const stateCollection = feature(states, states.objects.states) as unknown as Collection;
export const nebraska = stateCollection.features.find((item) => item.id === "31") ?? null;
export const graticule = geoGraticule10();

let countyCache: Collection | null = null;
let countyLoad: Promise<Collection> | null = null;

export function counties(): Promise<Collection> {
  countyLoad ??= import("us-atlas/counties-10m.json").then((mod) => {
    const all = feature(mod.default, mod.default.objects.counties) as unknown as Collection;
    countyCache = {
      type: "FeatureCollection",
      features: all.features.filter((item) => String(item.id).startsWith("31")),
    };
    return countyCache;
  });
  return countyLoad;
}

export function countyPack(): Collection | null {
  return countyCache;
}
