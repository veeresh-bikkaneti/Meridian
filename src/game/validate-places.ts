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
