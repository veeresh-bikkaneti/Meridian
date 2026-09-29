import assert from "node:assert/strict";
import test from "node:test";
import { orderPlaces, placeAt } from "./trail.ts";

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
