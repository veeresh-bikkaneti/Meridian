import assert from "node:assert/strict";
import test from "node:test";
import { COUNTRIES, STATES } from "./regions.ts";
import { STARTERS } from "./starters.ts";

const STATE_NAMES = new Set(STATES.map((state) => state.name));

function sentenceCount(story: string): number {
  return story
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

test("starters cover every state, launch country, and the globe", () => {
  const ids = new Set<string>();
  for (const place of STARTERS) {
    assert.equal(ids.has(place.id), false, place.id);
    ids.add(place.id);
    assert.equal(place.story.trim().length > 0, true, place.id);
    const sentences = sentenceCount(place.story);
    assert.ok(sentences === 2 || sentences === 3, `${place.id} has ${sentences} sentences`);
    assert.ok(place.sourceHref.startsWith("https://"), place.id);
    assert.equal(Number.isFinite(place.lon), true, place.id);
    assert.equal(Number.isFinite(place.lat), true, place.id);
    if (place.edition === "globe") continue;
    if (place.edition === "country" && place.regionId === "united-states") {
      assert.equal(STATE_NAMES.has(place.name), false, place.name);
    }
    const region =
      place.edition === "state"
        ? STATES.find((item) => item.id === place.regionId)
        : COUNTRIES.find((item) => item.id === place.regionId);
    assert.ok(region, place.id);
    const [west, south, east, north] = region.bounds;
    assert.ok(place.lon >= west && place.lon <= east && place.lat >= south && place.lat <= north);
  }

  for (const state of STATES) {
    const count = STARTERS.filter(
      (place) => place.edition === "state" && place.regionId === state.id,
    ).length;
    assert.ok(count >= 5, `${state.id} has ${count}`);
  }
  for (const country of COUNTRIES) {
    const count = STARTERS.filter(
      (place) => place.edition === "country" && place.regionId === country.id,
    ).length;
    assert.ok(count >= 5, `${country.id} has ${count}`);
  }
  const globe = STARTERS.filter((place) => place.edition === "globe").length;
  assert.ok(globe >= 12, `globe has ${globe}`);
});
