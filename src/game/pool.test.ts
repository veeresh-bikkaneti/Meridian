import assert from "node:assert/strict";
import test from "node:test";
import { STARTERS, type Starter } from "./starters.ts";
import { buildRegionPool } from "./pool.ts";
import { createDealer, memorySeenStore, mintSeed } from "./trail.ts";

test("state pool holds only that state's places", () => {
  const pool = buildRegionPool(STARTERS, "state", "nebraska");
  assert.ok(pool.length >= 5, `expected a playable Nebraska pool, got ${pool.length}`);
  for (const place of pool) {
    assert.equal(place.edition, "state");
    assert.equal(place.regionId, "nebraska");
  }
});

test("country pool holds only that country's places", () => {
  const pool = buildRegionPool(STARTERS, "country", "india");
  assert.ok(pool.length >= 5, `expected a playable India pool, got ${pool.length}`);
  for (const place of pool) {
    assert.equal(place.edition, "country");
    assert.equal(place.regionId, "india");
  }
});

test("globe pool holds only globe places", () => {
  const pool = buildRegionPool(STARTERS, "globe", "globe");
  assert.ok(pool.length >= 1, `expected a playable globe pool, got ${pool.length}`);
  for (const place of pool) {
    assert.equal(place.edition, "globe");
    assert.equal(place.regionId, "globe");
  }
});

test("a mislabeled place fails closed instead of dealing silently", () => {
  const impostor: Starter = {
    id: "nebraska-impostor",
    edition: "country",
    regionId: "nebraska",
    name: "Impostor Butte",
    lon: -100,
    lat: 41.5,
    story: "A deliberately mis-assigned place used to prove the pool fails closed.",
    sourceLabel: "Test",
    sourceHref: "https://example.com",
    difficulty: 3,
  };
  assert.throws(() => buildRegionPool([...STARTERS, impostor], "state", "nebraska"), /nebraska-impostor/);
});

test("a duplicate place id fails closed instead of dealing silently", () => {
  const original = buildRegionPool(STARTERS, "state", "nebraska")[0]!;
  const duplicate: Starter = {
    ...original,
    name: "A deliberately duplicated place used to prove the pool fails closed.",
    story: "A deliberately duplicated place used to prove the pool fails closed.",
    sourceLabel: "Test",
    sourceHref: "https://example.com",
  };
  assert.throws(
    () => buildRegionPool([...STARTERS, duplicate], "state", "nebraska"),
    new RegExp(`duplicate place id "${original.id}"`),
  );
});

test("the starters catalog has no duplicate place ids", () => {
  const ids = new Set<string>();
  for (const place of STARTERS) {
    assert.ok(!ids.has(place.id), `duplicate starter id: ${place.id}`);
    ids.add(place.id);
  }
});

test("dealing never leaves the region across full cycles", () => {
  const pool = buildRegionPool(STARTERS, "state", "nebraska");
  const dealer = createDealer(pool, mintSeed(), memorySeenStore());
  // Deal two complete pool cycles: every dealt place must stay in Nebraska.
  for (let position = 0; position < pool.length * 2; position++) {
    const place = dealer.at(position);
    assert.ok(place, `expected a place at position ${position}`);
    assert.equal(place.regionId, "nebraska");
  }
});
