/** BRAND carries no cookie config (review S10): Meridian sets no cookies. */
import assert from "node:assert/strict";
import test from "node:test";
import { BRAND } from "./brand.ts";

test("BRAND declares no cookie names", () => {
  for (const key of Object.keys(BRAND)) {
    assert.doesNotMatch(key, /cookie/i, `BRAND.${key}`);
  }
  assert.doesNotMatch(JSON.stringify(BRAND), /_session\b/);
});
