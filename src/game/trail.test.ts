import assert from "node:assert/strict";
import test from "node:test";
import { orderPlaces, placeAt, dealPlace } from "./trail.ts";

test("a date orders the same ids the same way and the next date can differ", () => {
  const places = [{ id: "c" }, { id: "a" }, { id: "b" }, { id: "d" }];
  const once = orderPlaces(places, "2026-09-28", "state", "nebraska");
  assert.deepEqual(once, orderPlaces(places, "2026-09-28", "state", "nebraska"));
  assert.deepEqual(once.map((place) => place.id).sort(), ["a", "b", "c", "d"]);
  assert.notDeepEqual(once, orderPlaces(places, "2026-09-29", "state", "nebraska"));
  assert.equal(placeAt(once, 0)?.id, once[0]?.id);
  assert.equal(placeAt(once, 4), null);
  assert.deepEqual(
    places.map((place) => place.id),
    ["c", "a", "b", "d"],
  );
});

test("dealPlace cycles endlessly; null only for an empty trail", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(dealPlace(places, 0)?.id, "a");
  assert.equal(dealPlace(places, 2)?.id, "c");
  assert.equal(dealPlace(places, 3)?.id, "a");
  assert.equal(dealPlace(places, 4)?.id, "b");
  assert.equal(dealPlace(places, 100)?.id, places[100 % 3]?.id);
  assert.equal(dealPlace([], 0), null);
  assert.equal(dealPlace([], 5), null);
});
