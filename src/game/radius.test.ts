import assert from "node:assert/strict";
import test from "node:test";
import { isHit, radiusKm } from "./radius.ts";

test("radius clamps by edition and the boundary is a hit", () => {
  assert.equal(radiusKm("state", 1000), 120);
  assert.equal(radiusKm("state", 100), 25);
  assert.equal(radiusKm("state", 2000), 160);
  assert.equal(radiusKm("country", 200), 40);
  assert.equal(radiusKm("country", 5000), 450);
  assert.equal(radiusKm("globe", 1000), 750);
  assert.equal(isHit(25, 25), true);
  assert.equal(isHit(25.1, 25), false);
});

// --- All-editions challenges (manifest 2026-10-28): per-region radii ---
import { regionRadiusKm } from "./radius.ts";
import { SCORING_VERSION } from "./scoring.ts";

/**
 * GOLDEN TABLE — every playable region's challenge radius, frozen as
 * literals computed from regions.ts at b09a5c3. This is a deliberate
 * tripwire (manifest §6, amended under C item 4): if a future bounds or
 * clamp edit changes ANY region's radius, this test goes red and forces
 * the link-comparability conversation before the edit ships — old links
 * are judged at their pinned radius, but NEW links would silently get a
 * different circle. Do not update the literals without that review.
 */
const GOLDEN_RADII: Record<string, number> = {
  "state:alabama": 64, "state:alaska": 160, "state:arizona": 75, "state:arkansas": 54,
  "state:california": 126, "state:colorado": 73, "state:connecticut": 25, "state:delaware": 25,
  "state:florida": 90, "state:georgia": 62, "state:hawaii": 68, "state:idaho": 93,
  "state:illinois": 74, "state:indiana": 53, "state:iowa": 64, "state:kansas": 78,
  "state:kentucky": 80, "state:louisiana": 60, "state:maine": 58, "state:maryland": 46,
  "state:massachusetts": 36, "state:michigan": 86, "state:minnesota": 78, "state:mississippi": 64,
  "state:missouri": 70, "state:montana": 110, "state:nebraska": 87, "state:nevada": 93,
  "state:new-hampshire": 35, "state:new-jersey": 32, "state:new-mexico": 75, "state:new-york": 77,
  "state:north-carolina": 97, "state:north-dakota": 68, "state:ohio": 47, "state:oklahoma": 93,
  "state:oregon": 78, "state:pennsylvania": 59, "state:rhode-island": 25, "state:south-carolina": 54,
  "state:south-dakota": 73, "state:tennessee": 94, "state:texas": 150, "state:utah": 66,
  "state:vermont": 30, "state:virginia": 89, "state:washington": 71, "state:west-virginia": 51,
  "state:wisconsin": 61, "state:wyoming": 68,
  "country:united-states": 450, "country:canada": 450, "country:mexico": 373, "country:brazil": 450,
  "country:united-kingdom": 147, "country:france": 137, "country:germany": 105, "country:italy": 155,
  "country:egypt": 148, "country:india": 385, "country:china": 450, "country:japan": 287,
  "country:australia": 450,
  "globe:globe": 750,
};

test("golden radius table: every playable region computes its frozen challenge radius", () => {
  const keys = Object.keys(GOLDEN_RADII);
  assert.equal(keys.length, 64, "50 states + 13 countries + globe");
  for (const key of keys) {
    const [edition, regionId] = key.split(":") as ["state" | "country" | "globe", string];
    assert.equal(
      regionRadiusKm(edition, regionId),
      GOLDEN_RADII[key],
      `${key} radius drifted — see the tripwire note above before updating`,
    );
  }
});

test("golden radii are whole kilometres inside their edition envelopes", () => {
  for (const [key, radius] of Object.entries(GOLDEN_RADII)) {
    assert.ok(Number.isInteger(radius), `${key} radius must be a whole-km integer`);
    if (key.startsWith("state:")) assert.ok(radius >= 25 && radius <= 160, key);
    if (key.startsWith("country:")) assert.ok(radius >= 40 && radius <= 450, key);
  }
});

test("regionRadiusKm fails closed to null for unknown regions", () => {
  assert.equal(regionRadiusKm("state", "atlantis"), null);
  assert.equal(regionRadiusKm("country", "nebraska"), null);
  assert.equal(regionRadiusKm("state", "france"), null);
});

test("a pin at exactly the golden radius is a hit, per golden radius", () => {
  for (const radius of [25, 87, 147, 450, 750]) {
    assert.equal(isHit(radius, radius), true, `exactly ${radius} km must hit`);
    assert.equal(isHit(radius + 1, radius), false);
  }
});

test("SCORING_VERSION tripwire: bumping the constant kills live family-chat links", () => {
  assert.equal(
    SCORING_VERSION,
    3,
    "STOP: bumping SCORING_VERSION kills every live mc1 and mc2 challenge link in family chats " +
      "unless frozen-version judging (links judged under their own version's rules forever) ships " +
      "in the same PR. This tripwire is the manifest 2026-10-28 §2.5 mechanism (Councilor C item 5).",
  );
});
