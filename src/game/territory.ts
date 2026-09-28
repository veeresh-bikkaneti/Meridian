import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json" with { type: "json" };
import { CONTINENT_BY_KEY, type Continent } from "./continents.ts";
import type { BonusKind, LonLat } from "./types.ts";

type CountryFeature = {
  id?: string | number;
  properties?: { name?: string };
  type: "Feature";
  geometry: unknown;
};

type Collection = { type: "FeatureCollection"; features: CountryFeature[] };

const countries = (feature(world, world.objects.countries) as Collection).features;

function countryKey(item: CountryFeature): string {
  if (item.id !== undefined && item.id !== null && String(item.id) !== "") {
    return String(item.id).padStart(3, "0");
  }
  return item.properties?.name ?? "";
}

export type Territory = {
  key: string;
  name: string;
  continent: Continent | null;
};

export function territoryAt(point: LonLat): Territory | null {
  for (const item of countries) {
    if (!geoContains(item, point)) continue;
    const key = countryKey(item);
    return {
      key,
      name: item.properties?.name ?? key,
      continent: CONTINENT_BY_KEY[key] ?? null,
    };
  }
  return null;
}

export function bonusFor(guess: LonLat, target: LonLat): BonusKind {
  const here = territoryAt(guess);
  const there = territoryAt(target);
  if (!here || !there || !here.key || !there.key) return "none";
  if (here.key === there.key) return "country";
  if (here.continent && here.continent === there.continent) return "continent";
  return "none";
}

export function missingContinents(): string[] {
  const missing: string[] = [];
  for (const item of countries) {
    const key = countryKey(item);
    if (!CONTINENT_BY_KEY[key]) missing.push(item.properties?.name ?? key);
  }
  return missing;
}
