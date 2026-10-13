import test from "node:test";
import assert from "node:assert/strict";
import { loadedForKey, placesLoadKey, type LoadedFor } from "./places-load-key.ts";
import { placesFor } from "./generated-places.ts";
import { filterByTier } from "./tier-filter.ts";
import { poolForNewRun, memorySeenStore } from "./trail.ts";
import { resolveRunPool } from "./pool.ts";

test("globe keys carry the band; the three bands give three different keys", () => {
  assert.equal(placesLoadKey("globe", "globe", "easy"), "globe:globe:easy");
  const keys = new Set([
    placesLoadKey("globe", "globe", "easy"),
    placesLoadKey("globe", "globe", "medium"),
    placesLoadKey("globe", "globe", "hard"),
  ]);
  assert.equal(keys.size, 3);
});

test("non-globe keys ignore the band (country, state and review runs never reload on a band change)", () => {
  assert.equal(
    placesLoadKey("state", "vermont", "easy"),
    placesLoadKey("state", "vermont", "hard"),
  );
  assert.equal(placesLoadKey("state", "vermont", "hard"), "state:vermont:");
  assert.equal(
    placesLoadKey("country", "france", "easy"),
    placesLoadKey("country", "france", "medium"),
  );
  assert.equal(placesLoadKey("country", "france", "medium"), "country:france:");
  assert.equal(placesLoadKey("globe", "review-deck", "easy"), "globe:review-deck:");
  assert.equal(
    placesLoadKey("globe", "review-deck", "easy"),
    placesLoadKey("globe", "review-deck", "hard"),
  );
});

test("different edition or regionId give different keys", () => {
  assert.notEqual(placesLoadKey("state", "vermont", "easy"), placesLoadKey("country", "vermont", "easy"));
  assert.notEqual(placesLoadKey("state", "vermont", "easy"), placesLoadKey("state", "texas", "easy"));
  assert.notEqual(placesLoadKey("globe", "globe", "easy"), placesLoadKey("globe", "review-deck", "easy"));
});

test("loadedForKey: null stays null; a matching key returns the same reference; a stale key returns null", () => {
  const k1 = "globe:globe:easy";
  const k2 = "globe:globe:medium";
  const value = [{ id: "gn-1" }];
  assert.equal(loadedForKey(null, k1), null);
  assert.equal(loadedForKey({ key: k1, value }, k1), value);
  assert.equal(loadedForKey({ key: k1, value }, k2), null);
});

test("stale-catalog regression: an Easy catalog is never handed to a Medium run", async () => {
  const easy = await placesFor("globe", "globe", "easy", true);
  const stale: LoadedFor<typeof easy> = { key: placesLoadKey("globe", "globe", "easy"), value: easy };
  const mediumKey = placesLoadKey("globe", "globe", "medium");
  const full = await placesFor("globe", "globe");
  const mediumIds = poolForNewRun(filterByTier(full, "medium"), memorySeenStore()).poolIds;

  // The hazard: the Easy catalog resolves only part of the Medium pool.
  const partial = resolveRunPool(easy, mediumIds);
  assert.ok(partial.length > 0 && partial.length < mediumIds.length, "hazard must be real");

  // The guard: a Medium run sees no catalog until its own one is loaded.
  assert.equal(loadedForKey(stale, mediumKey), null);
  assert.equal(loadedForKey(stale, placesLoadKey("globe", "globe", "easy")), easy);
});
