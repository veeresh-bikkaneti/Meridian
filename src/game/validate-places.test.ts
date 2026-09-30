import test from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "./catalog.ts";
import {
  validatePlaceCoordinates,
  validateGeneratedPlace,
  WORLD_COUNTRY_BOXES,
} from "./validate-places.ts";

test("all 106 catalog places pass coordinate validation (Hyderabad rule)", () => {
  const allViolations: string[] = [];
  for (const place of PLACES) {
    allViolations.push(...validatePlaceCoordinates(place));
  }
  assert.deepEqual(allViolations, [], `coordinate violations:\n${allViolations.join("\n")}`);
});

test("every world-ring place has a declared country box", () => {
  const missing = PLACES.filter(
    (p) => p.ring === "world" && !WORLD_COUNTRY_BOXES[p.name],
  ).map((p) => `${p.name} (${p.id})`);
  assert.deepEqual(missing, [], `world places without a country box: ${missing.join(", ")}`);
});

test("validator catches a Hyderabad-style mismatch", () => {
  // A place claiming India with American coordinates must fail.
  const violations = validatePlaceCoordinates({
    id: "hyderabad",
    name: "Taj Mahal", // uses India's box
    ring: "world",
    reveal: [-98.48614, 29.42597], // San Antonio, Texas
  });
  assert.ok(violations.length > 0, "expected a violation for wrong-country coordinates");
  assert.match(violations[0], /Hyderabad rule/);
});

test("validator passes a correct world place", () => {
  const violations = validatePlaceCoordinates({
    id: "taj-mahal",
    name: "Taj Mahal",
    ring: "world",
    reveal: [78.0421, 27.17501],
  });
  assert.deepEqual(violations, []);
});

test("generated-place gate rejects mismatched imports", () => {
  const violations = validateGeneratedPlace({
    id: "ne:in-hyderabad",
    name: "Hyderabad",
    lon: -98.48614,
    lat: 29.42597,
    declaredCountry: "India",
    countryBox: { minLon: 68.0, minLat: 6.0, maxLon: 98.0, maxLat: 36.0 },
  });
  assert.ok(violations.length > 0);
  assert.match(violations[0], /Hyderabad rule/);
});

test("generated-place gate passes matching imports", () => {
  const violations = validateGeneratedPlace({
    id: "ne:in-hyderabad",
    name: "Hyderabad",
    lon: 78.4867,
    lat: 17.385,
    declaredCountry: "India",
    countryBox: { minLon: 68.0, minLat: 6.0, maxLon: 98.0, maxLat: 36.0 },
  });
  assert.deepEqual(violations, []);
});
