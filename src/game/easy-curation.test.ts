import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { curateEasy, dealingPoolFor, EASY_MIN_POOL } from "./easy-curation.ts";

type P = { id: string; difficulty: number; curated?: boolean; history?: string };
const mk = (n: number, d: number, extra: Partial<P> = {}): P[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}-${extra.history ? "h" : extra.curated ? "c" : "p"}`, difficulty: d, ...extra }));

test("Medium and Hard are exactly the tier band (unchanged)", () => {
  const places = [...mk(5, 1), ...mk(5, 3), ...mk(5, 5)];
  assert.equal(dealingPoolFor(places, "medium").length, 5);
  assert.equal(dealingPoolFor(places, "hard").length, 5);
});

test("Easy prefers storied places (curated + tier-1 with a verified hook) when there are enough", () => {
  const places = [...mk(EASY_MIN_POOL, 1, { history: "A hook." }), ...mk(3, 2, { curated: true }), ...mk(100, 1), ...mk(400, 2)];
  const { pool, rung } = curateEasy(places.filter((p) => p.difficulty <= 2));
  assert.equal(rung, "storied");
  assert.equal(pool.length, EASY_MIN_POOL + 3);
  assert.ok(pool.every((p) => p.curated || p.history));
});

test("Easy falls back to tier 1 when too few storied places", () => {
  const places = [...mk(2, 1, { history: "hook" }), ...mk(40, 1), ...mk(400, 2)];
  const { pool, rung } = curateEasy(places);
  assert.equal(rung, "tier-1");
  assert.equal(pool.length, 42);
});

test("small regions never starve: falls back to the full Easy band", () => {
  const places = [...mk(1, 1), ...mk(6, 2)];
  const { pool, rung } = curateEasy(places);
  assert.equal(rung, "band");
  assert.equal(pool.length, 7);
});

test("never widens past the Easy band; empty stays empty", () => {
  assert.deepEqual(dealingPoolFor([], "easy"), []);
  assert.deepEqual(dealingPoolFor(mk(50, 4), "easy"), []);
});

test("order is preserved (the seeded dealer depends on it)", () => {
  const places = [...mk(30, 1, { history: "h" })].reverse();
  assert.deepEqual(dealingPoolFor(places, "easy").map((p) => p.id), places.map((p) => p.id));
});

test("Globe Easy data: the storied rung applies and drops the big-suburb long tail", () => {
  const t1 = JSON.parse(readFileSync(new URL("./data/geonames/tiers/globe-t1.json", import.meta.url), "utf8")).places as P[];
  const t2 = JSON.parse(readFileSync(new URL("./data/geonames/tiers/globe-t2.json", import.meta.url), "utf8")).places as P[];
  const { pool, rung } = curateEasy([...t1, ...t2]);
  assert.equal(rung, "storied");
  assert.ok(pool.length >= EASY_MIN_POOL);
  assert.ok(pool.length < t1.length, "curated Easy Globe is much smaller than raw tier 1");
  assert.ok(!pool.some((p) => (p as unknown as { name: string }).name === "Qarchak"));
});
