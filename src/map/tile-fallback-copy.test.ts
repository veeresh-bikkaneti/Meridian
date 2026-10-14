import { test } from "node:test";
import assert from "node:assert/strict";
import { TILE_FALLBACK_COPY } from "./tile-fallback-copy.ts";

test("failure card copy, exactly as the owner approved", () => {
  assert.equal(
    TILE_FALLBACK_COPY.failureBody,
    "The map pictures won't load right now. Check your internet, then tap Try again.",
  );
  assert.equal(TILE_FALLBACK_COPY.tryAgain, "Try again");
});

test("switch note copy uses the product name, exactly as approved", () => {
  assert.equal(
    TILE_FALLBACK_COPY.switchNote,
    "We switched to Scout Map so you can keep playing.",
  );
});

test("GeoDetective map-hidden line, exactly as approved", () => {
  assert.equal(
    TILE_FALLBACK_COPY.loopMapOff,
    "Map pictures are off for now. Your clues and guesses still work!",
  );
});

test("no provider names and no 'lite' in any child-facing string", () => {
  for (const [key, text] of Object.entries(TILE_FALLBACK_COPY)) {
    assert.doesNotMatch(text, /arcgis/i, `${key} names a provider`);
    assert.doesNotMatch(text, /\blite\b/i, `${key} uses the banned word`);
  }
});
