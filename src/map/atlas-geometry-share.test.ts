/**
 * The other arrival order, plus the map chunk's prebuilt collections.
 *
 * `atlas-data.ts` converts at import (the satellite-map chunk evaluates
 * it before `map_ready`). That conversion is the one the region index
 * and the territory preload must share — countries and states.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { preloadTerritory, territoryAt } from "../game/territory.ts";
import { territoryConversionRunsForTests } from "../../tests/harness/module-seams.ts";
import {
  atlasCountryConversionRuns,
  atlasStateConversionRuns,
} from "../lib/atlas-geometry.ts";
import { countries, stateCollection } from "./atlas-data.ts";
import { buildRegionIndex, lookupRegion } from "./region-index.ts";

test("the map collections, region index, and territory preload share one conversion", async () => {
  assert.equal(atlasCountryConversionRuns(), 1, "atlas-data import is the countries conversion");
  assert.equal(atlasStateConversionRuns(), 1, "atlas-data import is the states conversion");
  assert.equal(territoryConversionRunsForTests(), 1);

  const index = buildRegionIndex();
  await preloadTerritory();

  assert.equal(atlasCountryConversionRuns(), 1);
  assert.equal(atlasStateConversionRuns(), 1);
  assert.equal(territoryConversionRunsForTests(), 1);

  const france = lookupRegion(index, "France");
  const sharedFrance = countries.features.find((item) => {
    const name = (item as { properties?: { name?: string } }).properties?.name;
    return name === "France";
  });
  assert.ok(france);
  assert.ok(sharedFrance);
  const franceGeometry = sharedFrance.geometry as { coordinates?: unknown };
  assert.equal(france.polygonCoords.coordinates, franceGeometry.coordinates);

  const georgia = lookupRegion(index, "Georgia");
  const sharedGeorgia = stateCollection.features.find((item) => String(item.id) === "13");
  assert.equal(georgia?.id, "13");
  assert.ok(sharedGeorgia);
  const georgiaGeometry = sharedGeorgia.geometry as { coordinates?: unknown };
  assert.equal(georgia?.polygonCoords.coordinates, georgiaGeometry.coordinates);

  assert.equal(territoryAt([78.4867, 17.385])?.name, "India");
  assert.deepEqual(territoryAt([2.35, 48.85]), {
    key: "250",
    name: "France",
    continent: "europe",
  });
});
