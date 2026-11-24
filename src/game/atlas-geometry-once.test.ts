/**
 * The countries atlas is converted once and then shared.
 *
 * Boot order on a run: `openRun` awaits `preloadTerritory()` before the
 * map chunk mounts, and the map then builds the region index. The
 * second caller must reuse the first caller's polygons (same
 * coordinate arrays, conversion count stays 1).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cachedCountriesAtlas } from "../lib/atlas-geometry.ts";
import { buildRegionIndex, lookupRegion } from "../map/region-index.ts";
import {
  preloadTerritory,
  territoryAt,
  territoryConversionRunsForTests,
} from "./territory.ts";

test("preload and the region index convert the countries atlas once", async () => {
  assert.equal(territoryConversionRunsForTests(), 0);

  await preloadTerritory();
  assert.equal(territoryConversionRunsForTests(), 1);
  assert.deepEqual(territoryAt([2.35, 48.85]), {
    key: "250",
    name: "France",
    continent: "europe",
  });
  // Hyderabad sits in India. The shared polygons must still contain it.
  assert.equal(territoryAt([78.4867, 17.385])?.name, "India");

  const index = buildRegionIndex();
  assert.equal(
    territoryConversionRunsForTests(),
    1,
    "the region index must reuse the preload conversion",
  );

  const france = lookupRegion(index, "France");
  assert.ok(france);
  const shared = cachedCountriesAtlas();
  const sharedFrance = shared?.features.find((item) => item.properties?.name === "France");
  assert.ok(sharedFrance?.geometry);
  const geometry = sharedFrance.geometry as { coordinates?: unknown };
  assert.equal(
    france.polygonCoords.coordinates,
    geometry.coordinates,
    "the region index must retain the preload polygons, not a second copy",
  );

  assert.equal(lookupRegion(index, "Georgia")?.id, "13");
  assert.equal(lookupRegion(index, "United States")?.name, "United States of America");

  buildRegionIndex();
  await preloadTerritory();
  assert.equal(territoryConversionRunsForTests(), 1);
});
