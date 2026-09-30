/**
 * Atlas naming-drift guard: every STATES/COUNTRIES entry in
 * `src/game/regions.ts` must resolve in the vendored TopoJSON index.
 * If world-atlas/us-atlas renames a feature, this fails loudly instead of
 * silently dropping the region highlight.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { COUNTRIES, STATES } from "../game/regions.ts";
import {
  buildRegionIndex,
  lookupRegion,
  normalizeRegionName,
  REGION_NAME_ALIASES,
} from "./region-index.ts";

const index = buildRegionIndex();

test("all 50 states resolve", () => {
  assert.equal(STATES.length, 50);
  for (const region of STATES) {
    const dto = lookupRegion(index, region.name);
    assert.ok(
      dto !== null,
      `state "${region.name}" did not resolve in the atlas index`,
    );
  }
});

test("all 13 countries resolve (12 direct + 1 alias)", () => {
  assert.equal(COUNTRIES.length, 13);
  let direct = 0;
  let aliased = 0;
  for (const region of COUNTRIES) {
    const dto = lookupRegion(index, region.name);
    assert.ok(
      dto !== null,
      `country "${region.name}" did not resolve in the atlas index`,
    );
    if (REGION_NAME_ALIASES[normalizeRegionName(region.name)] !== undefined) {
      aliased += 1;
    } else {
      direct += 1;
    }
  }
  assert.equal(direct, 12);
  assert.equal(aliased, 1);
});

test('alias: "United States" resolves to the atlas "United States of America"', () => {
  const dto = lookupRegion(index, "United States");
  assert.ok(dto !== null);
  assert.equal(dto.name, "United States of America");
});

test('collision policy: "Georgia" resolves to the US state, not the country', () => {
  const dto = lookupRegion(index, "Georgia");
  assert.ok(dto !== null);
  // us-atlas FIPS codes are zero-padded strings; world-atlas ids are numeric.
  assert.equal(dto.id, "13");
});

test("unknown names resolve to null (no silent wrong-region match)", () => {
  assert.equal(lookupRegion(index, "Atlantis"), null);
  assert.equal(lookupRegion(index, ""), null);
});

test("DTOs carry sane bounds and centers", () => {
  for (const region of [...STATES, ...COUNTRIES]) {
    const dto = lookupRegion(index, region.name);
    assert.ok(dto !== null);
    const [w, s, e, n] = dto.bounds;
    const [lon, lat] = dto.center;
    for (const v of [w, s, e, n, lon, lat]) assert.ok(Number.isFinite(v));
    assert.ok(s <= n, `${region.name}: south > north`);
    assert.ok(lat >= -90 && lat <= 90, `${region.name}: center lat out of range`);
    assert.ok(lon >= -180 && lon <= 180, `${region.name}: center lon out of range`);
    assert.ok(
      dto.polygonCoords.type === "Polygon" ||
        dto.polygonCoords.type === "MultiPolygon",
    );
  }
});

test("Alaska center is antimeridian-aware (not the naive ~0 midpoint)", () => {
  const dto = lookupRegion(index, "Alaska");
  assert.ok(dto !== null);
  // Naive box midpoint of [-179.14 … 179.77] would be ≈ +0.3; the true
  // visual center of Alaska is ≈ -155.
  assert.ok(dto.center[0] < -140 && dto.center[0] > -170);
});

test("normalization is case/whitespace-insensitive", () => {
  assert.equal(normalizeRegionName("  New   Hampshire "), "new hampshire");
  const dto = lookupRegion(index, "  united STATES ");
  assert.ok(dto !== null);
  assert.equal(dto.name, "United States of America");
});
