import casesJson from "./cases.generated.json" with { type: "json" };
import type { ColdTrailCase, ColdTrailSighting } from "./types.ts";

/**
 * Cold Trail case deck access. The deck is build-time generated
 * (scripts/build-coldtrail.mjs) and statically imported — bundled with the
 * app, never fetched at runtime (offline-first).
 *
 * Fail-closed: the generated file is validated on load; a corrupt entry
 * yields null instead of a broken case, and the screen refuses to start.
 */

function isSighting(value: unknown): value is ColdTrailSighting {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.timestamp === "string" &&
    typeof s.cityId === "string" &&
    typeof s.cityName === "string" &&
    typeof s.cityLon === "number" &&
    typeof s.cityLat === "number" &&
    typeof s.radiusKm === "number" &&
    s.radiusKm > 0 &&
    typeof s.octant === "string" &&
    typeof s.text === "string"
  );
}

function isCase(value: unknown): value is ColdTrailCase {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const hideout = c.hideout as Record<string, unknown> | undefined;
  const sightings = c.sightings;
  return (
    c.v === 1 &&
    typeof c.caseNo === "number" &&
    !!hideout &&
    typeof hideout.placeId === "string" &&
    typeof hideout.name === "string" &&
    typeof hideout.lon === "number" &&
    typeof hideout.lat === "number" &&
    Array.isArray(sightings) &&
    sightings.length === 3 &&
    sightings.every(isSighting)
  );
}

const deck: ColdTrailCase[] = (() => {
  const raw = casesJson as unknown as { v?: unknown; cases?: unknown };
  if (raw.v !== 1 || !Array.isArray(raw.cases)) return [];
  return raw.cases.filter(isCase);
})();

/** Number of playable cases in the bundled deck. */
export function coldtrailCaseCount(): number {
  return deck.length;
}

/**
 * Case by 0-based index (wraps around the deck). Returns null when the deck
 * is empty or corrupt — the screen treats that as "cannot start".
 */
export function getColdtrailCase(index: number): ColdTrailCase | null {
  if (deck.length === 0 || !Number.isInteger(index)) return null;
  return deck[((index % deck.length) + deck.length) % deck.length] ?? null;
}
