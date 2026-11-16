/**
 * Item 8 (INV3/INV5): the screen ↔ hash map is a round-trip, and
 * fragments that are not screens — challenge links, home section
 * scroll targets, a bare `#` — name no screen.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hashForScreen, screenForHash } from "./screen-hash.ts";

test("every mapped screen round-trips through its hash", () => {
  for (const screen of [
    "home",
    "geodetective",
    "coldtrail",
    "subjects",
    "menu:countries",
    "menu:states",
  ]) {
    const hash = hashForScreen(screen);
    assert.notEqual(hash, null, `${screen} has a hash`);
    assert.equal(screenForHash(hash!), screen);
  }
});

test("unmapped screens push nothing", () => {
  for (const screen of ["boot", "globe", "starting", "menu:admin1", "menu:challengeRegions"]) {
    assert.equal(hashForScreen(screen), null, screen);
  }
});

test("non-screen fragments name no screen", () => {
  for (const hash of ["", "#", "#c=abc", "#home-about", "#home-involved", "#case/math"]) {
    assert.equal(screenForHash(hash), null, hash || "(empty)");
  }
});
