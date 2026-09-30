import test from "node:test";
import assert from "node:assert/strict";
import { validateGeneratedPlace } from "./validate-places.ts";
import { STARTERS } from "./starters.ts";
import { STATES, COUNTRIES } from "./regions.ts";
import {
  generatedStartersFor,
  placesFor,
  generatedPlaceCount,
  GENERATED_SOURCE_LABEL,
  GENERATED_SOURCE_HREF,
} from "./generated-places.ts";
import datasetJson from "./data/generated-places.json" with { type: "json" };
import boxesJson from "./data/country-boxes.json" with { type: "json" };

const dataset = datasetJson as unknown as {
  places: Array<{
    id: string;
    name: string;
    lon: number;
    lat: number;
    blurb?: string;
    curated?: boolean;
    iso2?: string | null;
    country?: string;
    edition?: string;
    regionId?: string;
  }>;
};
const boxes = (
  boxesJson as unknown as {
    boxes: Record<string, { country: string; wrapped: boolean; box: unknown }>;
  }
).boxes;

/** Into the box's frame for antimeridian-wrapped countries (cf. F6a normalizeLon). */
function normalizeLon(lon: number, wrapped: boolean): number {
  return wrapped && lon < 0 ? lon + 360 : lon;
}

function boxKeyFor(place: { iso2?: string | null; country?: string }): string {
  return place.iso2 ?? `name:${place.country}`;
}

test("gate rejects a Hyderabad-style mismatch (Badville)", () => {
  // San Antonio, Texas claiming to be in India must fail loudly.
  const india = boxes["IN"];
  const violations = validateGeneratedPlace({
    id: "badville",
    name: "Badville",
    lon: -98.48614,
    lat: 29.42597,
    declaredCountry: india.country,
    countryBox: india.box as never,
  });
  assert.ok(violations.length > 0, "expected a violation for wrong-country coordinates");
  assert.match(violations[0], /Hyderabad rule/);
});

test("gate passes a correct place (Goodville)", () => {
  // Mumbai, India claiming India must pass.
  const india = boxes["IN"];
  const violations = validateGeneratedPlace({
    id: "goodville",
    name: "Goodville",
    lon: 72.8777,
    lat: 19.076,
    declaredCountry: india.country,
    countryBox: india.box as never,
  });
  assert.deepEqual(violations, []);
});

test("all 3,468 generated places pass the F7 gate", () => {
  const failures: string[] = [];
  let checked = 0;
  for (const place of dataset.places) {
    if (place.curated) continue;
    const entry = boxes[boxKeyFor(place)];
    assert.ok(entry, `${place.id}: missing reference box for key "${boxKeyFor(place)}"`);
    const v = validateGeneratedPlace({
      id: place.id,
      name: place.name,
      lon: normalizeLon(place.lon, entry.wrapped),
      lat: place.lat,
      declaredCountry: entry.country,
      countryBox: entry.box as never,
    });
    if (v.length > 0) failures.push(...v);
    checked++;
  }
  assert.equal(checked, 3468, `expected 3468 generated places, saw ${checked}`);
  assert.deepEqual(failures, [], `gate failures:\n${failures.slice(0, 10).join("\n")}`);
});

test("generated ids are unique and never collide with curated starter ids", () => {
  const starterIds = new Set(STARTERS.map((s) => s.id));
  const seen = new Set<string>();
  for (const place of dataset.places) {
    if (place.curated) continue;
    assert.ok(!seen.has(place.id), `duplicate generated id: ${place.id}`);
    seen.add(place.id);
    assert.ok(!starterIds.has(place.id), `generated id collides with a starter: ${place.id}`);
  }
});

test("every generated place carries a valid edition/regionId", () => {
  const stateIds = new Set(STATES.map((s) => s.id));
  const countryIds = new Set(COUNTRIES.map((c) => c.id));
  const bad: string[] = [];
  for (const place of dataset.places) {
    if (place.curated) continue;
    const ok =
      (place.edition === "state" && stateIds.has(place.regionId ?? "")) ||
      (place.edition === "country" && countryIds.has(place.regionId ?? "")) ||
      (place.edition === "globe" && place.regionId === "globe");
    if (!ok) bad.push(`${place.id}: edition=${place.edition} regionId=${place.regionId}`);
  }
  assert.deepEqual(bad, [], `bad assignments:\n${bad.slice(0, 10).join("\n")}`);
});

test("loader skips curated refs and returns Starter-shaped records", () => {
  const texas = generatedStartersFor("state", "texas");
  assert.ok(texas.length > 0, "expected generated Texas places");
  for (const s of texas) {
    assert.equal(s.edition, "state");
    assert.equal(s.regionId, "texas");
    assert.ok(s.story && s.story.length > 0, `${s.id}: empty story`);
    assert.equal(s.sourceLabel, GENERATED_SOURCE_LABEL);
    assert.equal(s.sourceHref, GENERATED_SOURCE_HREF);
  }
  // Spot check: Kennewick, WA landed in the Washington pool.
  const wa = generatedStartersFor("state", "washington");
  assert.ok(
    wa.some((s) => s.id === "ne:us:kennewick"),
    "ne:us:kennewick should be in the Washington pool",
  );
  // A region with no generated places yields an empty list, not an error.
  assert.deepEqual(generatedStartersFor("state", "vermont"), []);
  // The DC place (not a state) lands in the US country pool.
  const usCountry = generatedStartersFor("country", "united-states");
  assert.ok(
    usCountry.some((s) => s.regionId === "united-states"),
    "expected the District of Columbia place in the united-states pool",
  );
});

test("placesFor is curated-first: curated starters, then generated depth", () => {
  const curatedTexas = STARTERS.filter((s) => s.edition === "state" && s.regionId === "texas");
  const pool = placesFor("state", "texas");
  assert.ok(curatedTexas.length > 0, "expected curated Texas starters");
  assert.ok(pool.length > curatedTexas.length, "pool should be deeper than the curated set alone");
  assert.deepEqual(
    pool.slice(0, curatedTexas.length).map((p) => p.id),
    curatedTexas.map((p) => p.id),
    "curated starters must lead the pool",
  );
  const curatedIds = new Set(curatedTexas.map((p) => p.id));
  for (const p of pool.slice(curatedTexas.length)) {
    assert.ok(!curatedIds.has(p.id), `curated place ${p.id} appears twice`);
  }
});

test("generatedPlaceCount matches the approved dataset size", () => {
  assert.equal(generatedPlaceCount(), 3468);
});
