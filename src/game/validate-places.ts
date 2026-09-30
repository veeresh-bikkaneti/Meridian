/**
 * Coordinate validation — the Hyderabad rule (F7).
 *
 * Every place's coordinates must match its claimed location. A place that
 * says "Hyderabad, India" but plots somewhere in America is a game-breaking
 * bug — worse than a repeat. This module is the hard gate:
 *
 * - The one-time audit of the 106-place catalog (2026-09-30) found zero
 *   mismatches; `validate-places.test.ts` locks that in permanently.
 * - The F6b dataset import pipeline (`scripts/build-places.mjs`) must call
 *   `validateGeneratedPlace` for every imported place and REJECT mismatches —
 *   never silently import them.
 *
 * Bounding boxes are intentionally generous: they catch "wrong continent /
 * wrong country / wrong state" errors, not "a few blocks off" imprecision.
 * Tighter checks belong in human review, not the automated gate.
 */
import type { RingId, LonLat } from "./types.ts";

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export function inBox(lon: number, lat: number, box: BoundingBox): boolean {
  return (
    lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat
  );
}

/**
 * Expected coordinate bounds per ring. Generous by design — the gate catches
 * "wrong region entirely", not survey-grade precision.
 */
export const RING_BOXES: Record<RingId, BoundingBox> = {
  // Lincoln, NE metro.
  lincoln: { minLon: -97.0, minLat: 40.6, maxLon: -96.4, maxLat: 41.05 },
  // Day-trip region around Lincoln (~75 mi radius).
  region: { minLon: -98.0, minLat: 40.2, maxLon: -95.0, maxLat: 41.8 },
  // State of Nebraska.
  nebraska: { minLon: -104.1, minLat: 39.9, maxLon: -95.2, maxLat: 43.1 },
  // USA including Alaska and Hawaii.
  usa: { minLon: -180.0, minLat: 18.0, maxLon: -66.0, maxLat: 72.0 },
  // Whole planet — world places are checked per-country below.
  world: { minLon: -180.0, minLat: -90.0, maxLon: 180.0, maxLat: 90.0 },
};

/**
 * World-ring place → expected country bounding box. Keyed by the place's
 * `name` as it appears in the catalog. When a world place is added or
 * renamed, add its country box here — the permanent test fails otherwise,
 * which is the point: no world place ships without a declared country.
 */
export const WORLD_COUNTRY_BOXES: Record<string, { country: string; box: BoundingBox }> = {
  "Eiffel Tower": { country: "France", box: { minLon: -5.0, minLat: 41.0, maxLon: 10.0, maxLat: 51.5 } },
  "Colosseum": { country: "Italy", box: { minLon: 6.5, minLat: 35.0, maxLon: 19.0, maxLat: 47.5 } },
  "Statue of Liberty": { country: "USA", box: { minLon: -180.0, minLat: 18.0, maxLon: -66.0, maxLat: 72.0 } },
  "Taj Mahal": { country: "India", box: { minLon: 68.0, minLat: 6.0, maxLon: 98.0, maxLat: 36.0 } },
  "Sydney Opera House": { country: "Australia", box: { minLon: 112.0, minLat: -44.0, maxLon: 154.0, maxLat: -10.0 } },
  "Christ the Redeemer": { country: "Brazil", box: { minLon: -74.0, minLat: -34.0, maxLon: -34.0, maxLat: 6.0 } },
  "Sagrada Família": { country: "Spain", box: { minLon: -10.0, minLat: 35.5, maxLon: 4.5, maxLat: 44.0 } },
  "Great Pyramid of Giza": { country: "Egypt", box: { minLon: 24.0, minLat: 22.0, maxLon: 36.0, maxLat: 32.0 } },
  "CN Tower": { country: "Canada", box: { minLon: -142.0, minLat: 41.5, maxLon: -52.0, maxLat: 84.0 } },
  "Machu Picchu": { country: "Peru", box: { minLon: -81.5, minLat: -18.5, maxLon: -68.5, maxLat: 0.5 } },
  "Mount Fuji": { country: "Japan", box: { minLon: 128.0, minLat: 30.0, maxLon: 146.0, maxLat: 46.0 } },
  "Chichén Itzá": { country: "Mexico", box: { minLon: -118.0, minLat: 14.0, maxLon: -86.0, maxLat: 33.0 } },
  "Stonehenge": { country: "UK", box: { minLon: -6.0, minLat: 49.5, maxLon: 2.0, maxLat: 59.0 } },
  "Neuschwanstein": { country: "Germany", box: { minLon: 5.5, minLat: 47.0, maxLon: 15.5, maxLat: 55.5 } },
  "Angkor Wat": { country: "Cambodia", box: { minLon: 102.0, minLat: 9.5, maxLon: 108.0, maxLat: 14.5 } },
  "Petra": { country: "Jordan", box: { minLon: 34.5, minLat: 29.0, maxLon: 39.5, maxLat: 33.5 } },
  "Table Mountain": { country: "South Africa", box: { minLon: 16.0, minLat: -35.5, maxLon: 33.0, maxLat: -22.0 } },
  "Uluru": { country: "Australia", box: { minLon: 112.0, minLat: -44.0, maxLon: 154.0, maxLat: -10.0 } },
  "Victoria Falls": { country: "Zambia/Zimbabwe", box: { minLon: 21.5, minLat: -18.5, maxLon: 34.0, maxLat: -8.0 } },
  "Fushimi Inari": { country: "Japan", box: { minLon: 128.0, minLat: 30.0, maxLon: 146.0, maxLat: 46.0 } },
  "Iguazú Falls": { country: "Argentina/Brazil", box: { minLon: -74.0, minLat: -56.0, maxLon: -34.0, maxLat: 6.0 } },
  "Ahu Tongariki": { country: "Chile/Easter Island", box: { minLon: -110.0, minLat: -28.0, maxLon: -108.0, maxLat: -26.0 } },
  "Potala Palace": { country: "China/Tibet", box: { minLon: 73.0, minLat: 17.5, maxLon: 136.0, maxLat: 54.0 } },
  "Timbuktu": { country: "Mali", box: { minLon: -12.5, minLat: 10.0, maxLon: 4.5, maxLat: 25.5 } },
  "Puerto Ayora": { country: "Ecuador/Galápagos", box: { minLon: -92.0, minLat: -2.0, maxLon: -89.0, maxLat: 1.0 } },
};

export type ValidatablePlace = {
  id: string;
  name: string;
  ring: RingId;
  reveal: LonLat;
};

/**
 * Validate one catalog place. Returns a list of human-readable violations;
 * empty means the place passes. Never throws — the gate collects every
 * violation so one bad place doesn't hide another.
 */
export function validatePlaceCoordinates(place: ValidatablePlace): string[] {
  const violations: string[] = [];
  const [lon, lat] = place.reveal;

  const ringBox = RING_BOXES[place.ring];
  if (!inBox(lon, lat, ringBox)) {
    violations.push(
      `${place.name} (${place.id}): [${lon}, ${lat}] is outside the ${place.ring} ring bounds`,
    );
  }

  if (place.ring === "world") {
    const expected = WORLD_COUNTRY_BOXES[place.name];
    if (!expected) {
      violations.push(
        `${place.name} (${place.id}): world-ring place has no declared country box — add one to WORLD_COUNTRY_BOXES`,
      );
    } else if (!inBox(lon, lat, expected.box)) {
      violations.push(
        `${place.name} (${place.id}): [${lon}, ${lat}] is outside ${expected.country} — the Hyderabad rule`,
      );
    }
  }

  return violations;
}

/**
 * Hard gate for the F6b import pipeline. Every generated place carries its
 * declared country/region box from the Natural Earth source row; this
 * rejects any place whose coordinates disagree with its declaration.
 * Returns violations (empty = pass). The pipeline must treat ANY violation
 * as a build failure, never a warning.
 */
export function validateGeneratedPlace(place: {
  id: string;
  name: string;
  lon: number;
  lat: number;
  declaredCountry: string;
  countryBox: BoundingBox;
}): string[] {
  const violations: string[] = [];
  if (!inBox(place.lon, place.lat, place.countryBox)) {
    violations.push(
      `${place.name} (${place.id}): [${place.lon}, ${place.lat}] is outside declared ${place.declaredCountry} — rejected by the Hyderabad rule`,
    );
  }
  return violations;
}

/**
 * Starter-schema coverage (starters.ts — the 327 hand-curated state /
 * country / globe edition places). Same Hyderabad rule, different schema:
 * starters declare `edition` + `regionId` instead of `ring`.
 *
 * Audited 2026-09-30: all 327 pass (250 state, 65 country, 12 globe).
 * Three audit-script false positives during the pass were box errors, not
 * data errors (Utah's 42°N northern border, Northern Ireland's western
 * extent, Okinawa) — the boxes below include those corrections.
 */

/** US state bounding boxes, keyed by starters.ts regionId. Generous. */
export const STARTER_STATE_BOXES: Record<string, BoundingBox> = {
  alabama: { minLon: -88.5, minLat: 30.1, maxLon: -84.8, maxLat: 35.1 },
  alaska: { minLon: -180, minLat: 51, maxLon: -129, maxLat: 72 },
  arizona: { minLon: -114.9, minLat: 31.3, maxLon: -109, maxLat: 37.1 },
  arkansas: { minLon: -94.7, minLat: 32.9, maxLon: -89.6, maxLat: 36.6 },
  california: { minLon: -124.5, minLat: 32.4, maxLon: -114, maxLat: 42.1 },
  colorado: { minLon: -109.1, minLat: 36.9, maxLon: -102, maxLat: 41.1 },
  connecticut: { minLon: -73.8, minLat: 40.9, maxLon: -71.7, maxLat: 42.1 },
  delaware: { minLon: -75.8, minLat: 38.4, maxLon: -74.9, maxLat: 39.9 },
  florida: { minLon: -87.7, minLat: 24.3, maxLon: -79.9, maxLat: 31.1 },
  georgia: { minLon: -85.7, minLat: 30.3, maxLon: -80.7, maxLat: 35.7 },
  hawaii: { minLon: -161, minLat: 18.8, maxLon: -154.7, maxLat: 22.3 },
  idaho: { minLon: -117.3, minLat: 41.9, maxLon: -111, maxLat: 49.1 },
  illinois: { minLon: -91.6, minLat: 36.9, maxLon: -87.4, maxLat: 42.6 },
  indiana: { minLon: -88.2, minLat: 37.7, maxLon: -84.7, maxLat: 41.8 },
  iowa: { minLon: -96.7, minLat: 40.3, maxLon: -90, maxLat: 43.6 },
  kansas: { minLon: -102.1, minLat: 36.9, maxLon: -94.5, maxLat: 40.1 },
  kentucky: { minLon: -89.7, minLat: 36.4, maxLon: -81.9, maxLat: 39.2 },
  louisiana: { minLon: -94.1, minLat: 28.8, maxLon: -88.7, maxLat: 33.1 },
  maine: { minLon: -71.2, minLat: 42.9, maxLon: -66.9, maxLat: 47.6 },
  maryland: { minLon: -79.6, minLat: 37.8, maxLon: -74.9, maxLat: 39.8 },
  massachusetts: { minLon: -73.6, minLat: 41.1, maxLon: -69.8, maxLat: 43 },
  michigan: { minLon: -90.5, minLat: 41.6, maxLon: -82.1, maxLat: 48.3 },
  minnesota: { minLon: -97.3, minLat: 43.4, maxLon: -89.4, maxLat: 49.5 },
  mississippi: { minLon: -91.7, minLat: 30.1, maxLon: -88.3, maxLat: 35.1 },
  missouri: { minLon: -95.8, minLat: 35.9, maxLon: -89, maxLat: 40.7 },
  montana: { minLon: -116.1, minLat: 44.3, maxLon: -104, maxLat: 49.1 },
  nebraska: { minLon: -104.1, minLat: 39.9, maxLon: -95.2, maxLat: 43.1 },
  nevada: { minLon: -120.1, minLat: 34.9, maxLon: -113.9, maxLat: 42.1 },
  "new-hampshire": { minLon: -72.6, minLat: 42.6, maxLon: -70.6, maxLat: 45.4 },
  "new-jersey": { minLon: -75.7, minLat: 38.8, maxLon: -73.8, maxLat: 41.4 },
  "new-mexico": { minLon: -109.1, minLat: 31.7, maxLon: -103, maxLat: 37.1 },
  "new-york": { minLon: -79.9, minLat: 40.4, maxLon: -71.7, maxLat: 45.1 },
  "north-carolina": { minLon: -84.4, minLat: 33.7, maxLon: -75.3, maxLat: 36.7 },
  "north-dakota": { minLon: -104.1, minLat: 45.8, maxLon: -96.8, maxLat: 49.1 },
  ohio: { minLon: -84.9, minLat: 38.3, maxLon: -80.4, maxLat: 42 },
  oklahoma: { minLon: -103.1, minLat: 33.5, maxLon: -94.3, maxLat: 37.1 },
  oregon: { minLon: -124.7, minLat: 41.9, maxLon: -116.3, maxLat: 46.3 },
  pennsylvania: { minLon: -80.6, minLat: 39.6, maxLon: -74.6, maxLat: 42.4 },
  "rhode-island": { minLon: -71.9, minLat: 41.1, maxLon: -71.1, maxLat: 42.1 },
  "south-carolina": { minLon: -83.4, minLat: 32, maxLon: -78.5, maxLat: 35.3 },
  "south-dakota": { minLon: -104.1, minLat: 42.4, maxLon: -96.4, maxLat: 45.9 },
  tennessee: { minLon: -90.4, minLat: 34.9, maxLon: -81.6, maxLat: 36.8 },
  texas: { minLon: -106.5, minLat: 25.7, maxLon: -93.4, maxLat: 36.6 },
  utah: { minLon: -114.1, minLat: 36.9, maxLon: -109, maxLat: 42.1 },
  vermont: { minLon: -73.5, minLat: 42.6, maxLon: -71.4, maxLat: 45.1 },
  virginia: { minLon: -83.7, minLat: 36.4, maxLon: -75.1, maxLat: 39.6 },
  washington: { minLon: -124.8, minLat: 45.4, maxLon: -116.8, maxLat: 49.1 },
  "west-virginia": { minLon: -82.7, minLat: 37.1, maxLon: -77.6, maxLat: 39.9 },
  wisconsin: { minLon: -92.9, minLat: 42.4, maxLon: -86.7, maxLat: 47.1 },
  wyoming: { minLon: -111.1, minLat: 40.9, maxLon: -104, maxLat: 45.1 },
};

/** Country bounding boxes for the country edition, keyed by regionId. */
export const STARTER_COUNTRY_BOXES: Record<string, BoundingBox> = {
  "united-states": { minLon: -180, minLat: 18, maxLon: -66, maxLat: 72 },
  canada: { minLon: -142, minLat: 41.5, maxLon: -52, maxLat: 84 },
  mexico: { minLon: -118, minLat: 14, maxLon: -86, maxLat: 33 },
  brazil: { minLon: -74, minLat: -34, maxLon: -34, maxLat: 6 },
  "united-kingdom": { minLon: -8.5, minLat: 49.5, maxLon: 2, maxLat: 59 },
  france: { minLon: -5, minLat: 41, maxLon: 10, maxLat: 51.5 },
  germany: { minLon: 5.5, minLat: 47, maxLon: 15.5, maxLat: 55.5 },
  italy: { minLon: 6.5, minLat: 35, maxLon: 19, maxLat: 47.5 },
  egypt: { minLon: 24, minLat: 22, maxLon: 36, maxLat: 32 },
  india: { minLon: 68, minLat: 6, maxLon: 98, maxLat: 36 },
  china: { minLon: 73, minLat: 17.5, maxLon: 136, maxLat: 54 },
  japan: { minLon: 122, minLat: 24, maxLon: 146, maxLat: 46 },
  australia: { minLon: 112, minLat: -44, maxLon: 154, maxLat: -10 },
};

/** Globe-edition starter → expected country box, keyed by place name. */
export const STARTER_GLOBE_COUNTRY_BOXES: Record<string, { country: string; box: BoundingBox }> = {
  "Giza Plateau": { country: "Egypt", box: { minLon: 24, minLat: 22, maxLon: 36, maxLat: 32 } },
  Uluru: { country: "Australia", box: { minLon: 112, minLat: -44, maxLon: 154, maxLat: -10 } },
  "Machu Picchu": { country: "Peru", box: { minLon: -81.5, minLat: -18.5, maxLon: -68.5, maxLat: 0.5 } },
  Petra: { country: "Jordan", box: { minLon: 34.5, minLat: 29, maxLon: 39.5, maxLat: 33.5 } },
  "Angkor Wat": { country: "Cambodia", box: { minLon: 102, minLat: 9.5, maxLon: 108, maxLat: 14.5 } },
  "Mount Everest": { country: "Nepal/China", box: { minLon: 80, minLat: 26, maxLon: 95, maxLat: 31 } },
  "Victoria Falls": { country: "Zambia/Zimbabwe", box: { minLon: 21.5, minLat: -18.5, maxLon: 34, maxLat: -8 } },
  "Ahu Tongariki": { country: "Chile/Easter Island", box: { minLon: -110, minLat: -28, maxLon: -108, maxLat: -26 } },
  Oia: { country: "Greece", box: { minLon: 19, minLat: 34.5, maxLon: 30, maxLat: 42 } },
  "Puerto Ayora": { country: "Ecuador/Galápagos", box: { minLon: -92, minLat: -2, maxLon: -89, maxLat: 1 } },
  Serengeti: { country: "Tanzania", box: { minLon: 29, minLat: -12, maxLon: 41, maxLat: -1 } },
  Gullfoss: { country: "Iceland", box: { minLon: -25, minLat: 63, maxLon: -13, maxLat: 67 } },
};

export type ValidatableStarter = {
  id: string;
  name: string;
  edition: "state" | "country" | "globe";
  regionId: string;
  lon: number;
  lat: number;
};

/**
 * Validate one starter place. Returns violations (empty = pass), never
 * throws. Like the catalog validator, globe places without a declared
 * country box fail closed.
 */
export function validateStarterCoordinates(starter: ValidatableStarter): string[] {
  const violations: string[] = [];
  const { lon, lat } = starter;

  if (starter.edition === "state") {
    const box = STARTER_STATE_BOXES[starter.regionId];
    if (!box) {
      violations.push(
        `${starter.name} (${starter.id}): unknown state regionId "${starter.regionId}" — add a box to STARTER_STATE_BOXES`,
      );
    } else if (!inBox(lon, lat, box)) {
      violations.push(
        `${starter.name} (${starter.id}): [${lon}, ${lat}] is outside ${starter.regionId} — the Hyderabad rule`,
      );
    }
  } else if (starter.edition === "country") {
    const box = STARTER_COUNTRY_BOXES[starter.regionId];
    if (!box) {
      violations.push(
        `${starter.name} (${starter.id}): unknown country regionId "${starter.regionId}" — add a box to STARTER_COUNTRY_BOXES`,
      );
    } else if (!inBox(lon, lat, box)) {
      violations.push(
        `${starter.name} (${starter.id}): [${lon}, ${lat}] is outside ${starter.regionId} — the Hyderabad rule`,
      );
    }
  } else {
    const expected = STARTER_GLOBE_COUNTRY_BOXES[starter.name];
    if (!expected) {
      violations.push(
        `${starter.name} (${starter.id}): globe-edition starter has no declared country box — add one to STARTER_GLOBE_COUNTRY_BOXES`,
      );
    } else if (!inBox(lon, lat, expected.box)) {
      violations.push(
        `${starter.name} (${starter.id}): [${lon}, ${lat}] is outside ${expected.country} — the Hyderabad rule`,
      );
    }
  }

  return violations;
}
