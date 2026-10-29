import assert from "node:assert/strict";
import test from "node:test";
import {
  challengeRunFields,
  decodeChallengeLink,
  encodeChallenge2,
  resolveChallengeRoute,
} from "./challenge.ts";

/**
 * The receive chain as a PURE seam (manifest 2026-10-28 §2, contract 3):
 * decode -> gates -> membership, fail-closed at every step, testable
 * without a boot. The sharp case matters most: an id can exist in the
 * country aggregate yet NOT be a member of the one state's pool —
 * global existence is not membership, and only membership in the named
 * (edition, region) catalog may pass.
 */
const NEBRASKA_IDS = ["gn-5073706", "gn-5074472", "gn-5697551", "gn-5072683", "gn-5083794"];
const TEXAS_ONLY_ID = "gn-4736286";

const nebraskaCatalog = new Set([...NEBRASKA_IDS, "gn-5080685", "gn-5073527"]);

function nebraskaFragment(ids: string[] = NEBRASKA_IDS): string {
  return encodeChallenge2(
    { edition: "state", regionId: "nebraska", radiusKm: 87, ids },
    3,
  );
}

test("a valid mc2 route resolves against its own region catalog", () => {
  const resolved = resolveChallengeRoute(nebraskaFragment(), 3, nebraskaCatalog);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.route.edition, "state");
  assert.equal(resolved.route.regionId, "nebraska");
  assert.equal(resolved.route.regionName, "Nebraska");
  assert.equal(resolved.route.radiusKm, 87);
  assert.equal(resolved.route.originFormat, "mc2");
  assert.deepEqual(resolved.route.ids, NEBRASKA_IDS);
});

test("sharp membership: an id from another region's pool is rejected even though it exists", () => {
  // TEXAS_ONLY_ID is a real catalog place — in Texas's pool, not Nebraska's.
  const mixed = [...NEBRASKA_IDS.slice(0, 4), TEXAS_ONLY_ID];
  const resolved = resolveChallengeRoute(nebraskaFragment(mixed), 3, nebraskaCatalog);
  assert.deepEqual(resolved, { ok: false, reason: "region" });
  // The same fragment resolves fine against a catalog that contains it.
  const texasCatalog = new Set([...mixed]);
  const ok = resolveChallengeRoute(nebraskaFragment(mixed), 3, texasCatalog);
  assert.equal(ok.ok, true);
});

test("decode failures pass through untouched; membership never rescues them", () => {
  assert.deepEqual(resolveChallengeRoute("#c=mc2.!!!", 3, nebraskaCatalog), {
    ok: false,
    reason: "format",
  });
  const wrongVersion = encodeChallenge2(
    { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
    4,
  );
  assert.deepEqual(resolveChallengeRoute(wrongVersion, 3, nebraskaCatalog), {
    ok: false,
    reason: "scoring",
  });
});

test("an mc1 link resolves through the same seam as a globe route", () => {
  const resolved = decodeChallengeLink(
    "#c=mc1.eyJ2IjoxLCJlIjoiZ2xvYmUiLCJzIjozLCJpZHMiOlsiZ24tMTAiLCJnbi0yIiwiZ24tMzAiLCJnbi00IiwiZ24tNSJdLCJzZWVkIjoxOTEwNTMwOTcyfQ",
    3,
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.route.originFormat, "mc1");
  assert.equal(resolved.route.regionId, "globe");
  assert.equal(resolved.route.radiusKm, 750);
});

test("run derivation: mc2 keeps the sentinel, carries region, radius, and origin", () => {
  const resolved = resolveChallengeRoute(nebraskaFragment(), 3, nebraskaCatalog);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const fields = challengeRunFields(resolved.route);
  assert.deepEqual(fields, {
    edition: "state",
    regionId: "challenge",
    regionName: "Nebraska challenge",
    challengeRegionId: "nebraska",
    challengeRadiusKm: 87,
    challengeOrigin: "mc2",
  });
});

test("run derivation: an mc1 route stays the shipped globe friend challenge", () => {
  const resolved = decodeChallengeLink(
    "#c=mc1.eyJ2IjoxLCJlIjoiZ2xvYmUiLCJzIjozLCJpZHMiOlsiZ24tMTAiLCJnbi0yIiwiZ24tMzAiLCJnbi00IiwiZ24tNSJdLCJzZWVkIjoxOTEwNTMwOTcyfQ",
    3,
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const fields = challengeRunFields(resolved.route);
  assert.deepEqual(fields, {
    edition: "globe",
    regionId: "challenge",
    regionName: "Friend challenge",
    challengeRegionId: "globe",
    challengeRadiusKm: 750,
    challengeOrigin: "mc1",
  });
});
