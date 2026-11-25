import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntrySize, ENTRY_JS_GZIP_LIMIT } from "./check-entry-size.mjs";

test("limit is the Phase 0 starting measurement", () => {
  assert.equal(ENTRY_JS_GZIP_LIMIT, 323_865);
});

test("at or under the limit passes", () => {
  assert.equal(checkEntrySize(ENTRY_JS_GZIP_LIMIT).ok, true);
  assert.equal(checkEntrySize(318_410).ok, true);
});

test("one byte over the limit fails and says by how much", () => {
  const r = checkEntrySize(ENTRY_JS_GZIP_LIMIT + 1);
  assert.equal(r.ok, false);
  assert.match(r.message, /1 B over/);
});

test("a missing or zero size fails instead of passing silently", () => {
  assert.equal(checkEntrySize(undefined).ok, false);
  assert.equal(checkEntrySize(0).ok, false);
  assert.equal(checkEntrySize(Number.NaN).ok, false);
});
