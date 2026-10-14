import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTileFallbackAction, TILE_RETRY_LIMIT } from "./tile-fallback.ts";

test("retry limit is one: a single 'Try again' per visit", () => {
  assert.equal(TILE_RETRY_LIMIT, 1);
});

test("a ready verdict never asks for anything", () => {
  assert.equal(nextTileFallbackAction({ verdict: "ready", retriesUsed: 0 }), "none");
  assert.equal(nextTileFallbackAction({ verdict: "ready", retriesUsed: 1 }), "none");
});

test("first failure offers 'Try again'", () => {
  assert.equal(
    nextTileFallbackAction({ verdict: "failed", retriesUsed: 0 }),
    "show-try-again",
  );
});

test("failure after the one retry switches to Scout Map", () => {
  assert.equal(
    nextTileFallbackAction({ verdict: "failed", retriesUsed: 1 }),
    "switch-to-scout",
  );
});

test("a count past the limit still switches (never a second 'Try again')", () => {
  assert.equal(
    nextTileFallbackAction({ verdict: "failed", retriesUsed: 2 }),
    "switch-to-scout",
  );
});
