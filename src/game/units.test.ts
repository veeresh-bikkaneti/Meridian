import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatLength,
  KM_PER_MI,
  loopGradeBand,
  scoreGradeBand,
  unitForEdition,
  unitForLoopTarget,
  unitForSessionSummary,
  USA_TERRITORY_KEY,
} from "./units.ts";

// Cartographer's Plate PR2 — Veeresh's ratified decision 4: USA plays
// show miles, the rest of the world shows kilometers, derived from
// edition/region context — NEVER device locale.
describe("units — unitForEdition", () => {
  it("state edition is always miles (USA states only)", () => {
    assert.equal(unitForEdition("state", "nebraska"), "mi");
    assert.equal(unitForEdition("state", "texas"), "mi");
  });

  it("country edition is miles only for the United States run", () => {
    assert.equal(unitForEdition("country", "united-states"), "mi");
    assert.equal(unitForEdition("country", "canada"), "km");
    assert.equal(unitForEdition("country", "france"), "km");
    assert.equal(unitForEdition("country", "india"), "km");
  });

  it("globe edition is always kilometers", () => {
    assert.equal(unitForEdition("globe", "globe"), "km");
  });
});

describe("units — unitForLoopTarget", () => {
  it("a USA mystery target reads miles", () => {
    // Detroit, MI (GeoDetective clue index 47).
    assert.equal(unitForLoopTarget([-83.05, 42.33]), "mi");
  });

  it("a non-USA mystery target reads kilometers", () => {
    // Geneva, Switzerland (GeoDetective clue index 13).
    assert.equal(unitForLoopTarget([6.14, 46.2]), "km");
    // Huntington Beach, CA is USA → miles even though the label is long.
    assert.equal(unitForLoopTarget([-117.99, 33.66]), "mi");
  });

  it("never consults device locale — the derivation is pure geography", () => {
    assert.equal(USA_TERRITORY_KEY, "840");
  });
});

describe("units — formatLength", () => {
  it("km mode mirrors formatDistance byte-for-byte", () => {
    assert.equal(formatLength(0.4, "km"), "400 m");
    assert.equal(formatLength(9.95, "km"), "9.9 km");
    assert.equal(formatLength(2073.4, "km"), "2,073 km");
    assert.equal(formatLength(NaN, "km"), "—");
  });

  it("mi mode converts with native thresholds", () => {
    // 2073.4 km ≈ 1288.4 mi.
    assert.equal(formatLength(2073.4, "mi"), "1,288 mi");
    // Sub-mile → feet.
    assert.equal(formatLength(0.4, "mi"), `${Math.round((0.4 / KM_PER_MI) * 5280)} ft`);
    // Below 100 → one decimal.
    assert.equal(formatLength(10, "mi"), `${(10 / KM_PER_MI).toFixed(1)} mi`);
    assert.equal(formatLength(NaN, "mi"), "—");
  });
});

describe("units — loopGradeBand (ratified fixed ruler, native round units)", () => {
  it("km bands: Bullseye ≤25 · So Close ≤150 · Nearly There ≤600 · On the Trail ≤1500 · Far Afield ≤3000 · Way Off beyond", () => {
    const km = (d: number) => loopGradeBand(d, "km");
    assert.deepEqual(km(0), { emoji: "🎯", name: "Bullseye" });
    assert.deepEqual(km(25), { emoji: "🎯", name: "Bullseye" });
    assert.deepEqual(km(25.1).name, "So Close");
    assert.deepEqual(km(150).name, "So Close");
    assert.deepEqual(km(600).name, "Nearly There");
    assert.deepEqual(km(1500).name, "On the Trail");
    assert.deepEqual(km(3000).name, "Far Afield");
    assert.deepEqual(km(3000.1), { emoji: "💨", name: "Way Off" });
    assert.deepEqual(km(12000).name, "Way Off");
  });

  it("mi bands: Bullseye ≤15 · So Close ≤100 · Nearly There ≤400 · On the Trail ≤1000 · Far Afield ≤2000 · Way Off beyond", () => {
    const mi = (dKm: number) => loopGradeBand(dKm, "mi");
    assert.deepEqual(mi(0), { emoji: "🎯", name: "Bullseye" });
    assert.deepEqual(mi(15 * KM_PER_MI).name, "Bullseye");
    assert.deepEqual(mi(15.1 * KM_PER_MI).name, "So Close");
    assert.deepEqual(mi(100 * KM_PER_MI).name, "So Close");
    assert.deepEqual(mi(400 * KM_PER_MI).name, "Nearly There");
    assert.deepEqual(mi(1000 * KM_PER_MI).name, "On the Trail");
    assert.deepEqual(mi(2000 * KM_PER_MI).name, "Far Afield");
    assert.deepEqual(mi(2000.1 * KM_PER_MI), { emoji: "💨", name: "Way Off" });
  });

  it("the two rulers disagree where the native rounds diverge (155 km)", () => {
    // 155 km ≈ 96.3 mi: km says Nearly There (>150), mi says So Close (≤100).
    assert.equal(loopGradeBand(155, "km").name, "Nearly There");
    assert.equal(loopGradeBand(155, "mi").name, "So Close");
  });
});

describe("units — scoreGradeBand (existing share tiers, reused language)", () => {
  it("grades the 0–415 scoring-v3 range", () => {
    assert.deepEqual(scoreGradeBand(415), { emoji: "🎯", name: "300+" });
    assert.deepEqual(scoreGradeBand(300), { emoji: "🎯", name: "300+" });
    assert.deepEqual(scoreGradeBand(299).name, "200+");
    assert.deepEqual(scoreGradeBand(200).name, "200+");
    assert.deepEqual(scoreGradeBand(120).name, "120+");
    assert.deepEqual(scoreGradeBand(60).name, "60+");
    assert.deepEqual(scoreGradeBand(1).name, "1+");
    assert.deepEqual(scoreGradeBand(0), { emoji: "💨", name: "miss" });
  });
});

describe("units — owner ruling 2026-10-11 (one unit per result)", () => {
  it("1 mi = 1.609344 km exactly", () => {
    assert.equal(KM_PER_MI, 1.609344);
  });

  it("the reported bug's distance: 411 km renders as 255 mi", () => {
    // 411 / 1.609344 = 255.387… → integer miles above 100.
    assert.equal(formatLength(411, "mi"), "255 mi");
  });

  it("USA → miles: state edition, US country run, US GeoDetective target, US Cold Trail hideout", () => {
    assert.equal(unitForEdition("state", "nebraska"), "mi");
    assert.equal(unitForEdition("country", "united-states"), "mi");
    // Detroit, MI GeoDetective target.
    assert.equal(unitForLoopTarget([-83.05, 42.33]), "mi");
    // A USA Cold-Trail hideout (Chicago, IL) — placement.ts uses the same
    // unitForLoopTarget derivation for its ring labels.
    assert.equal(unitForLoopTarget([-87.63, 41.88]), "mi");
  });

  it("rest of the world → kilometers everywhere", () => {
    assert.equal(unitForEdition("globe", "globe"), "km");
    assert.equal(unitForEdition("country", "france"), "km");
    // Geneva, Switzerland GeoDetective target.
    assert.equal(unitForLoopTarget([6.14, 46.2]), "km");
    // Non-USA Cold-Trail hideout (Paris).
    assert.equal(unitForLoopTarget([2.35, 48.85]), "km");
  });
});

describe("units — unitForSessionSummary (end-of-game card)", () => {
  it("an all-USA session reads miles", () => {
    assert.equal(
      unitForSessionSummary([
        { edition: "state", regionId: "nebraska" },
        { edition: "state", regionId: "texas" },
        { edition: "country", regionId: "united-states" },
      ]),
      "mi",
    );
  });

  it("a mixed session fails closed to kilometers", () => {
    assert.equal(
      unitForSessionSummary([
        { edition: "state", regionId: "nebraska" },
        { edition: "country", regionId: "france" },
      ]),
      "km",
    );
    assert.equal(
      unitForSessionSummary([
        { edition: "globe", regionId: "globe" },
        { edition: "country", regionId: "united-states" },
      ]),
      "km",
    );
  });

  it("an empty session fails closed to kilometers", () => {
    assert.equal(unitForSessionSummary([]), "km");
  });
});
