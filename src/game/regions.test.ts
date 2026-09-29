import assert from "node:assert/strict";
import test from "node:test";
import { COUNTRIES, STATES, greaterSideKm } from "./regions.ts";

test("the launch list is the states and the countries", () => {
  assert.equal(STATES.length, 50);
  assert.equal(
    STATES.some((state) => state.id === "district-of-columbia"),
    false,
  );
  assert.equal(STATES.find((state) => state.name === "Nebraska")?.id, "nebraska");
  assert.deepEqual(
    STATES.find((state) => state.name === "Nebraska")?.bounds,
    [-104, 40, -95.3, 43],
  );
  assert.equal(COUNTRIES[0]?.id, "united-states");
  assert.deepEqual(
    COUNTRIES.map((country) => country.name),
    [
      "United States",
      "Canada",
      "Mexico",
      "Brazil",
      "United Kingdom",
      "France",
      "Germany",
      "Italy",
      "Egypt",
      "India",
      "China",
      "Japan",
      "Australia",
    ],
  );
  const latKm = 3 * 110.574;
  const lonKm = 8.7 * 111.32 * Math.cos((41.5 * Math.PI) / 180);
  assert.equal(greaterSideKm([-104, 40, -95.3, 43]), Math.max(latKm, lonKm));
});
