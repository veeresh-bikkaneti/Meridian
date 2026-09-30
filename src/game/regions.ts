export type RegionBounds = [number, number, number, number]; // west, south, east, north
export type Region = { id: string; name: string; bounds: RegionBounds };

const LATITUDE_KM = 110.574;
const LONGITUDE_KM = 111.32;

function region(name: string, bounds: RegionBounds): Region {
  return { id: name.toLowerCase().replaceAll(" ", "-"), name, bounds };
}

/** Decimal degree span. Binary subtraction turns 8.7 into 8.700000000000003. */
function decimalSpan(end: number, start: number): number {
  return Number((end - start).toFixed(10));
}

export const STATES: Region[] = [
  region("Alabama", [-88.47, 30.22, -84.89, 35.01]),
  // The Aleutians cross the antimeridian. This box stays west of 180° so the camera does not wrap the globe.
  region("Alaska", [-179.14, 51.23, -129.98, 71.35]),
  region("Arizona", [-114.81, 31.33, -109.04, 37]),
  region("Arkansas", [-94.62, 33, -89.66, 36.5]),
  region("California", [-124.41, 32.53, -114.13, 42.01]),
  region("Colorado", [-109.06, 36.99, -102.04, 41]),
  region("Connecticut", [-73.73, 40.98, -71.79, 42.05]),
  region("Delaware", [-75.79, 38.45, -75.05, 39.84]),
  region("Florida", [-87.63, 24.51, -80.03, 31]),
  region("Georgia", [-85.61, 30.36, -80.84, 35]),
  region("Hawaii", [-160.25, 18.92, -154.81, 22.23]),
  region("Idaho", [-117.24, 41.99, -111.04, 49]),
  region("Illinois", [-91.51, 36.97, -87.49, 42.51]),
  region("Indiana", [-88.1, 37.77, -84.78, 41.76]),
  region("Iowa", [-96.63, 40.38, -90.14, 43.5]),
  region("Kansas", [-102.05, 36.99, -94.59, 40]),
  region("Kentucky", [-89.57, 36.5, -81.97, 39.15]),
  region("Louisiana", [-94.04, 28.93, -88.82, 33.02]),
  region("Maine", [-71.08, 43.06, -66.98, 47.46]),
  region("Maryland", [-79.49, 37.92, -75.05, 39.72]),
  region("Massachusetts", [-73.51, 41.24, -69.93, 42.89]),
  region("Michigan", [-90.42, 41.7, -82.42, 48.19]),
  region("Minnesota", [-97.24, 43.5, -89.49, 49.38]),
  region("Mississippi", [-91.64, 30.18, -88.1, 35]),
  region("Missouri", [-95.77, 36, -89.1, 40.61]),
  region("Montana", [-116.05, 44.36, -104.04, 49]),
  region("Nebraska", [-104, 40, -95.3, 43]),
  region("Nevada", [-120.01, 35, -114.04, 42]),
  region("New Hampshire", [-72.56, 42.7, -70.7, 45.31]),
  region("New Jersey", [-75.56, 38.93, -73.89, 41.36]),
  region("New Mexico", [-109.05, 31.33, -103, 37]),
  region("New York", [-79.76, 40.5, -71.86, 45.02]),
  region("North Carolina", [-84.32, 33.85, -75.46, 36.59]),
  region("North Dakota", [-104.05, 45.93, -96.56, 49]),
  region("Ohio", [-84.82, 38.41, -80.52, 41.98]),
  region("Oklahoma", [-103, 33.62, -94.43, 37]),
  region("Oregon", [-124.55, 41.99, -116.46, 46.27]),
  region("Pennsylvania", [-80.52, 39.72, -74.7, 42.27]),
  region("Rhode Island", [-71.86, 41.15, -71.12, 42.02]),
  region("South Carolina", [-83.35, 32.03, -78.54, 35.22]),
  region("South Dakota", [-104.06, 42.48, -96.44, 45.95]),
  region("Tennessee", [-90.31, 34.98, -81.65, 36.68]),
  region("Texas", [-106.65, 25.84, -93.52, 36.5]),
  region("Utah", [-114.05, 37, -109.04, 42]),
  region("Vermont", [-73.44, 42.73, -71.49, 45.02]),
  region("Virginia", [-83.68, 36.54, -75.24, 39.47]),
  region("Washington", [-124.73, 45.54, -116.92, 49]),
  region("West Virginia", [-82.64, 37.2, -77.72, 40.64]),
  region("Wisconsin", [-92.89, 42.49, -86.82, 47.08]),
  region("Wyoming", [-111.06, 41, -104.05, 45.01]),
];

export const COUNTRIES: Region[] = [
  region("United States", [-179.2, 18.9, -66.9, 71.4]),
  region("Canada", [-141.1, 41.6, -52.6, 83.3]),
  region("Mexico", [-117.2, 14.5, -86.7, 32.8]),
  region("Brazil", [-74, -33.8, -34.7, 5.3]),
  region("United Kingdom", [-8.7, 49.8, 1.8, 60.9]),
  region("France", [-5.2, 41.3, 9.6, 51.1]),
  region("Germany", [5.8, 47.2, 15.1, 55.1]),
  region("Italy", [6.6, 35.4, 18.6, 47.1]),
  region("Egypt", [24.6, 21.7, 37, 31.7]),
  region("India", [68.1, 6.7, 97.5, 35.7]),
  region("China", [73.5, 18.1, 135.1, 53.6]),
  region("Japan", [122.9, 24, 145.9, 45.6]),
  region("Australia", [113.1, -43.7, 153.7, -10.4]),
];

/**
 * First-level administrative subdivisions (states/provinces) per country,
 * keyed by the country's Region id.
 *
 * A country drills into its subdivisions in the picker only when it maps to
 * a non-empty list here — a non-empty list means "we have playable place
 * pools for these subdivisions". Countries mapping to [] (or absent) start
 * a country-overall run directly; they are never listed as drill targets
 * because that would be a dead end.
 *
 * The USA is currently the only entry: it is the only country with a
 * complete curated admin-1 place catalog. Additional countries plug in here
 * once their subdivision place data lands (the paused F6b dataset track);
 * until then they stay playable as countries overall.
 */
export const ADMIN1_BY_COUNTRY: Record<string, Region[]> = {
  "united-states": STATES,
};

/** Greater of the latitude side and the longitude side, in kilometers. */
export function greaterSideKm(bounds: RegionBounds): number {
  const [west, south, east, north] = bounds;
  const latKm = decimalSpan(north, south) * LATITUDE_KM;
  const centerLat = (south + north) / 2;
  const lonKm = decimalSpan(east, west) * LONGITUDE_KM * Math.cos((centerLat * Math.PI) / 180);
  return Math.max(latKm, lonKm);
}
