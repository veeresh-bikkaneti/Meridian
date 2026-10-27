import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUNDLED_CREDITS } from "./credits.ts";

/**
 * Guard for the /credits page data (WI-15): the bundled-library list must
 * stay checked against what the build actually bundles. Reading
 * package.json with node:fs + JSON.parse is the sanctioned fallback in
 * ADR-15 (a JSON import attribute would work too, but this keeps the test
 * independent of strip-types import-attribute support).
 */
const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { dependencies: Record<string, string> };

describe("BUNDLED_CREDITS", () => {
  it("credits MapLibre GL with a non-empty licence", () => {
    const entry = BUNDLED_CREDITS.find((c) => c.packageName === "maplibre-gl");
    assert.ok(entry, "maplibre-gl must be credited");
    assert.ok(entry.license.length > 0, "maplibre-gl licence must be non-empty");
  });

  it("covers exactly the dependencies in package.json", () => {
    const credited = new Set(BUNDLED_CREDITS.map((c) => c.packageName));
    const bundled = new Set(Object.keys(pkg.dependencies));
    assert.deepEqual(credited, bundled);
  });

  it("has no duplicate entries", () => {
    const names = BUNDLED_CREDITS.map((c) => c.packageName);
    assert.equal(new Set(names).size, names.length);
  });

  it("gives every entry a non-empty licence", () => {
    for (const entry of BUNDLED_CREDITS) {
      assert.ok(entry.license.length > 0, `${entry.packageName} licence must be non-empty`);
    }
  });
});
