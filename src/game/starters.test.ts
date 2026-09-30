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

test("every starter has a reviewed difficulty 1-5 and each state pool has an anchor", () => {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const place of STARTERS) {
    assert.ok(
      place.difficulty >= 1 && place.difficulty <= 5,
      `${place.id} has difficulty ${place.difficulty}`,
    );
    dist[place.difficulty]++;
  }
  // Guardrails on the reviewed mix: easy anchors exist, the middle holds,
  // and deep cuts stay rare. Tighten deliberately, not incidentally.
  assert.ok(dist[1] >= 40, `tier 1 too thin: ${dist[1]}`);
  assert.ok(dist[2] >= 60, `tier 2 too thin: ${dist[2]}`);
  assert.ok(dist[5] <= 30, `tier 5 too fat: ${dist[5]}`);
  assert.ok(dist[5] >= 10, `tier 5 vanished: ${dist[5]}`);

  for (const state of STATES) {
    const pool = STARTERS.filter(
      (place) => place.edition === "state" && place.regionId === state.id,
    );
    const easiest = Math.min(...pool.map((place) => place.difficulty));
    assert.ok(easiest <= 2, `${state.id} has no accessible anchor`);
  }
});
