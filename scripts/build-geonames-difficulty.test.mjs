import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  tierFor,
  applyPreservedExtras,
  PRESERVED_EXTRA_KEYS,
} from "./build-geonames-dataset.mjs";

/**
 * Difficulty-tier stamping tests (difficulty-tiers track, dataset crew).
 *
 * tierFor(pop, fcode) is the build-time rule that stamps `difficulty` (1–5)
 * onto every shipped GeoNames chunk record. Cutoffs are measured dump
 * quantiles (124,690 kept rows: p95 = 100,275; p80 = 22,593; p50 = 5,935;
 * p20 = 2,478) rounded to clean values — these tests lock the boundaries so
 * a future edit can't silently shift them.
 */

describe("tierFor — population bands", () => {
  it("tier 1 at exactly 100000", () => {
    assert.equal(tierFor(100000, "PPL"), 1);
    assert.equal(tierFor(100001, "PPL"), 1);
    assert.equal(tierFor(5000000, "PPL"), 1);
  });

  it("99999 is NOT tier 1 (falls to tier 2)", () => {
    assert.equal(tierFor(99999, "PPL"), 2);
  });

  it("tier 2 at exactly 25000", () => {
    assert.equal(tierFor(25000, "PPL"), 2);
    assert.equal(tierFor(24999, "PPL"), 3);
  });

  it("tier 3 at exactly 6000", () => {
    assert.equal(tierFor(6000, "PPL"), 3);
    assert.equal(tierFor(5999, "PPL"), 4);
  });

  it("tier 4 at exactly 2500", () => {
    assert.equal(tierFor(2500, "PPL"), 4);
    assert.equal(tierFor(2499, "PPL"), 5);
  });

  it("tier 5 below the dataset threshold", () => {
    assert.equal(tierFor(1500, "PPL"), 5);
    assert.equal(tierFor(0, "PPL"), 5);
  });
});

describe("tierFor — capital overrides", () => {
  it("PPLC country capital is tier 1 at any population", () => {
    assert.equal(tierFor(1, "PPLC"), 1);
    assert.equal(tierFor(999, "PPLC"), 1);
    assert.equal(tierFor(99999, "PPLC"), 1);
  });

  it("PPLA admin-1 capital is tier 2 at any population", () => {
    assert.equal(tierFor(1, "PPLA"), 2);
    assert.equal(tierFor(5000, "PPLA"), 2);
    assert.equal(tierFor(24999, "PPLA"), 2);
  });

  it("PPLA with big-city population still tiers by population (tier 1)", () => {
    assert.equal(tierFor(200000, "PPLA"), 1);
  });
});

describe("tierFor — PPLX neighborhood floor (never 1 or 2)", () => {
  it("floors a megacity neighborhood up to tier 3", () => {
    assert.equal(tierFor(300000, "PPLX"), 3);
  });

  it("floors a tier-2-population neighborhood up to tier 3", () => {
    assert.equal(tierFor(50000, "PPLX"), 3);
    assert.equal(tierFor(25000, "PPLX"), 3);
  });

  it("tier-3-population neighborhoods stay tier 3", () => {
    assert.equal(tierFor(8000, "PPLX"), 3);
    assert.equal(tierFor(6000, "PPLX"), 3);
  });

  it("floor never pulls SMALL places up beyond tier 3", () => {
    assert.equal(tierFor(3000, "PPLX"), 4);
    assert.equal(tierFor(2000, "PPLX"), 5);
    assert.equal(tierFor(1500, "PPLX"), 5);
  });

  it("capital neighborhoods are still floored (PPLC + PPLX is PPLX)", () => {
    // fcode is a single code per row; PPLX wins here because it IS the row's code.
    assert.equal(tierFor(200000, "PPLX"), 3);
  });
});

describe("applyPreservedExtras — rebuild carry-forward", () => {
  it("carries fact/history/wiki forward by place id", () => {
    const records = [{ id: "gn-1", name: "A" }, { id: "gn-2", name: "B" }];
    const extras = {
      fact: { text: "A kid-friendly hook sentence about A. It teaches.", kind: "x", source: "y" },
      history: "A is an old settlement on the river. It has a story.",
      wiki: "A_wiki",
    };
    applyPreservedExtras(records, new Map([["gn-1", extras]]));
    assert.deepEqual(records[0].fact, extras.fact);
    assert.equal(records[0].history, extras.history);
    assert.equal(records[0].wiki, extras.wiki);
    assert.equal(records[1].fact, undefined);
    assert.equal(records[1].history, undefined);
    assert.equal(records[1].wiki, undefined);
  });

  it("does not clobber a fresh pipeline value with a stale one", () => {
    const records = [{ id: "gn-1", history: "Fresh pipeline note from the curated notes." }];
    applyPreservedExtras(
      records,
      new Map([["gn-1", { history: "Stale old note that must not overwrite." }]]),
    );
    assert.equal(records[0].history, "Fresh pipeline note from the curated notes.");
  });

  it("no previous entry leaves the record untouched", () => {
    const records = [{ id: "gn-9", name: "Z" }];
    applyPreservedExtras(records, new Map());
    assert.deepEqual(records, [{ id: "gn-9", name: "Z" }]);
  });

  it("only the preserved keys travel — nothing else", () => {
    assert.deepEqual([...PRESERVED_EXTRA_KEYS].sort(), ["fact", "history", "wiki"]);
    const records = [{ id: "gn-1" }];
    // difficulty is stamped fresh every rebuild; it must never be preserved.
    applyPreservedExtras(records, new Map([["gn-1", { difficulty: 1, id: "gn-x" }]]));
    assert.equal(records[0].difficulty, undefined);
    assert.equal(records[0].id, "gn-1");
  });
});
