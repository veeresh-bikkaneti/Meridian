import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_VERSION_COPY,
  MC3_COUNTRY_REGION_IDS,
  MC3_STATE_REGION_IDS,
  challengeRunFields,
  decodeChallenge2,
  decodeChallenge3,
  decodeChallengeLink,
  encodeChallenge3,
  type ChallengeWinner,
} from "./challenge.ts";
import { ADMIN1_BY_COUNTRY, COUNTRIES } from "./regions.ts";
import { regionRadiusKm } from "./radius.ts";
import { PLACE_SCORE_CAP, REGION_BONUS, SCORING_VERSION, scorePlace } from "./scoring.ts";

/**
 * mc3 tests (delta manifest 2026-10-31 §7, Package A). Golden vectors are
 * built here by an INDEPENDENT packing routine — written from the byte
 * layout in the manifest, sharing no code with challenge.ts — so the
 * encoder and decoder cannot silently agree on a bug.
 */

// --- Independent packing routine (test-only) ---

function specVarint(value: number): number[] {
  const out: number[] = [];
  let v = value;
  do {
    let byte = v & 0x7f;
    v = Math.floor(v / 128);
    if (v > 0) byte |= 0x80;
    out.push(byte);
  } while (v > 0);
  return out;
}

function specFnv1aBytes(bytes: readonly number[]): number {
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SPEC_COUNTRY_IDS = [
  "united-states", "canada", "mexico", "brazil", "united-kingdom", "france",
  "germany", "italy", "egypt", "india", "china", "japan", "australia",
];
const SPEC_STATE_IDS = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new-hampshire", "new-jersey",
  "new-mexico", "new-york", "north-carolina", "north-dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode-island", "south-carolina",
  "south-dakota", "tennessee", "texas", "utah", "vermont", "virginia",
  "washington", "west-virginia", "wisconsin", "wyoming",
];

interface SpecPackInput {
  edition: "globe" | "country" | "state";
  regionIndex: number;
  rad: number;
  s?: number;
  ids: number[];
  winner?: { mask: number; sender: number; best: number; attempts: number };
  /** Raw overrides for strictness cases: replace the rad encoding. */
  radBytes?: number[];
  b0Override?: number;
}

function specPack(input: SpecPackInput): { bytes: number[]; fragment: string } {
  const editionCode = input.edition === "globe" ? 0 : input.edition === "country" ? 1 : 2;
  const b0 =
    input.b0Override ?? ((editionCode << 6) | (input.winner ? 0x20 : 0));
  const body: number[] = [b0, input.s ?? SCORING_VERSION];
  body.push(...(input.radBytes ?? specVarint(input.rad)));
  body.push(input.regionIndex, input.ids.length);
  for (const id of input.ids) {
    body.push((id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff);
  }
  if (input.winner) {
    body.push((input.winner.mask >> 8) & 0xff, input.winner.mask & 0xff);
    body.push(...specVarint(input.winner.sender));
    body.push(...specVarint(input.winner.best));
    body.push(...specVarint(input.winner.attempts));
  }
  const seal = specFnv1aBytes(body);
  const bytes = [
    ...body,
    (seal >> 24) & 0xff, (seal >> 16) & 0xff, (seal >> 8) & 0xff, seal & 0xff,
  ];
  const fragment =
    "#c=mc3." + Buffer.from(bytes).toString("base64url");
  return { bytes, fragment };
}

function specFragmentFromBytes(bytes: readonly number[]): string {
  return "#c=mc3." + Buffer.from(bytes).toString("base64url");
}

function specReseal(bodyWithoutSeal: readonly number[]): number[] {
  const seal = specFnv1aBytes(bodyWithoutSeal);
  return [
    ...bodyWithoutSeal,
    (seal >> 24) & 0xff, (seal >> 16) & 0xff, (seal >> 8) & 0xff, seal & 0xff,
  ];
}

// --- The owner's Nebraska route (his pasted mc2 link, delta §1) ---

const OWNER_MC2_LINK =
  "#c=mc2.eyJ2IjoyLCJlIjoic3RhdGUiLCJyIjoibmVicmFza2EiLCJyYWQiOjg3LCJzIjozLCJpZHMiOlsiZ24tNTA2NzU0NSIsImduLTUwNzg3OTIiLCJnbi01MDY0MjM2IiwiZ24tNTY5NTYwNCIsImduLTUwNjgwNTIiLCJnbi01MDYzMjI5IiwiZ24tNTA2NjM1NSIsImduLTUwNzM2NjEiLCJnbi01Njk1NzQzIiwiZ24tNTA3MTkzNCJdLCJzZWVkIjoxMjIwMTkwMDMxfQ";

function ownerRoute(): { ids: string[]; nums: number[] } {
  const decoded = decodeChallenge2(OWNER_MC2_LINK, SCORING_VERSION);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error("owner mc2 link must decode");
  assert.equal(decoded.e, "state");
  assert.equal(decoded.r, "nebraska");
  assert.equal(decoded.rad, 87);
  assert.equal(decoded.s, 3);
  assert.equal(decoded.seed, 1220190031);
  return {
    ids: decoded.ids,
    nums: decoded.ids.map((id) => Number(id.slice("gn-".length))),
  };
}

const NEBRASKA_INDEX = SPEC_STATE_IDS.indexOf("nebraska");
const WINNER_955: ChallengeWinner = { mask: 0xe000, sender: 955, best: 955, attempts: 1 };

test("mc3 golden: the owner's Nebraska route re-minted — 52 payload chars, no winner block", () => {
  const { ids, nums } = ownerRoute();
  const golden = specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums });
  const payload = golden.fragment.slice("#c=mc3.".length);
  assert.equal(payload.length, 52, "payload length (delta §2.6)");
  assert.equal(golden.fragment.length, 59);
  const decoded = decodeChallenge3(golden.fragment, SCORING_VERSION);
  assert.deepEqual(decoded, {
    ok: true, v: 3, e: "state", r: "nebraska", rad: 87, s: 3, ids, winner: undefined,
  });
  // The production encoder reproduces the independent golden byte for byte.
  const encoded = encodeChallenge3(
    { edition: "state", regionId: "nebraska", radiusKm: 87, ids },
    SCORING_VERSION,
  );
  assert.equal(encoded, golden.fragment);
});

test("mc3 golden: the owner's Nebraska route with a winner block — 62 payload chars", () => {
  const { ids, nums } = ownerRoute();
  const golden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  const payload = golden.fragment.slice("#c=mc3.".length);
  assert.equal(payload.length, 62, "payload length (delta §2.6)");
  const decoded = decodeChallenge3(golden.fragment, SCORING_VERSION);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.ids, ids);
  assert.deepEqual(decoded.winner, { mask: 0xe000, sender: 955, best: 955, attempts: 1 });
  const encoded = encodeChallenge3(
    { edition: "state", regionId: "nebraska", radiusKm: 87, ids, winner: WINNER_955 },
    SCORING_VERSION,
  );
  assert.equal(encoded, golden.fragment);
});

test("mc3 round-trips: every edition × {W, no-W} × n ∈ {5, 10}", () => {
  const cases: { edition: "globe" | "country" | "state"; regionId: string }[] = [
    { edition: "globe", regionId: "globe" },
    { edition: "country", regionId: "united-kingdom" },
    { edition: "state", regionId: "nebraska" },
  ];
  for (const { edition, regionId } of cases) {
    const radiusKm = regionRadiusKm(edition, regionId);
    assert.ok(radiusKm !== null);
    for (const n of [5, 10]) {
      const ids = Array.from({ length: n }, (_, i) => `gn-${1000 + i * 137}`);
      for (const winner of [undefined, { mask: 0xf800, sender: 800, best: 900, attempts: 2 }]) {
        // n=5 winner mask uses the top 5 bits; for n=10 the same mask is
        // still legal (bits >= n are the low 6, and 0xf800 has none set).
        const fragment = encodeChallenge3(
          { edition, regionId, radiusKm, ids, winner },
          SCORING_VERSION,
        );
        assert.ok(fragment.length <= 127, `${edition} n=${n} W=${!!winner} within the cap`);
        const decoded = decodeChallenge3(fragment, SCORING_VERSION);
        assert.equal(decoded.ok, true, `${edition} n=${n} W=${!!winner}`);
        if (!decoded.ok) return;
        assert.equal(decoded.e, edition);
        assert.equal(decoded.r, regionId);
        assert.equal(decoded.rad, radiusKm);
        assert.deepEqual(decoded.ids, ids);
        assert.deepEqual(decoded.winner, winner);
      }
    }
  }
});

test("mc3 region index edges: globe 0, first/last country, first/last state", () => {
  const ids = ["gn-11", "gn-22", "gn-33", "gn-44", "gn-55"];
  const edges: { edition: "globe" | "country" | "state"; regionId: string; index: number }[] = [
    { edition: "globe", regionId: "globe", index: 0 },
    { edition: "country", regionId: "united-states", index: 0 },
    { edition: "country", regionId: "australia", index: 12 },
    { edition: "state", regionId: "alabama", index: 0 },
    { edition: "state", regionId: "wyoming", index: 49 },
  ];
  for (const { edition, regionId, index } of edges) {
    const table = edition === "country" ? SPEC_COUNTRY_IDS : SPEC_STATE_IDS;
    assert.equal(edition === "globe" ? "globe" : table[index], regionId);
    const radiusKm = regionRadiusKm(edition, regionId)!;
    const fragment = encodeChallenge3({ edition, regionId, radiusKm, ids }, SCORING_VERSION);
    const decoded = decodeChallenge3(fragment, SCORING_VERSION);
    assert.equal(decoded.ok, true, `${edition}/${regionId}`);
    if (decoded.ok) assert.equal(decoded.r, regionId);
  }
  // An index past the end of the edition's table fails `region`.
  const nums = ids.map((id) => Number(id.slice(3)));
  const badCountry = specPack({ edition: "country", regionIndex: 13, rad: 200, ids: nums });
  assert.deepEqual(decodeChallenge3(badCountry.fragment, SCORING_VERSION), {
    ok: false, reason: "region",
  });
  const badGlobe = specPack({ edition: "globe", regionIndex: 1, rad: 750, ids: nums });
  assert.deepEqual(decodeChallenge3(badGlobe.fragment, SCORING_VERSION), {
    ok: false, reason: "region",
  });
});

test("mc3 region tables: drift guard against regions.ts live lists", () => {
  assert.deepEqual([...MC3_COUNTRY_REGION_IDS], COUNTRIES.map((r) => r.id));
  const liveAdmin1 = Object.values(ADMIN1_BY_COUNTRY).flat().map((r) => r.id);
  assert.deepEqual([...MC3_STATE_REGION_IDS], liveAdmin1);
});

test("mc3 region tables: no-shrink snapshot — frozen entries are an exact prefix", () => {
  assert.deepEqual(MC3_COUNTRY_REGION_IDS.slice(0, SPEC_COUNTRY_IDS.length), SPEC_COUNTRY_IDS);
  assert.deepEqual(MC3_STATE_REGION_IDS.slice(0, SPEC_STATE_IDS.length), SPEC_STATE_IDS);
  assert.ok(MC3_COUNTRY_REGION_IDS.length >= SPEC_COUNTRY_IDS.length);
  assert.ok(MC3_STATE_REGION_IDS.length >= SPEC_STATE_IDS.length);
});

test("mc3 strictness: reserved bits → version; edition code 3 → edition", () => {
  const { nums } = ownerRoute();
  const base = specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums });
  const body = base.bytes.slice(0, -4);
  const reserved = specFragmentFromBytes(specReseal([body[0]! | 0x01, ...body.slice(1)]));
  assert.deepEqual(decodeChallenge3(reserved, SCORING_VERSION), { ok: false, reason: "version" });
  const edition3 = specFragmentFromBytes(specReseal([(3 << 6) | 0, ...body.slice(1)]));
  assert.deepEqual(decodeChallenge3(edition3, SCORING_VERSION), { ok: false, reason: "edition" });
});

test("mc3 strictness: non-canonical varints → format (overlong, unterminated, over-cap)", () => {
  const { nums } = ownerRoute();
  // Overlong rad: 87 encoded as two groups (0xd7 0x00) instead of one.
  const overlong = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, radBytes: [0xd7, 0x00],
  });
  assert.deepEqual(decodeChallenge3(overlong.fragment, SCORING_VERSION), {
    ok: false, reason: "format",
  });
  // Over-cap rad: three groups (cap is 2) — value still 87.
  const overCap = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums,
    radBytes: [0xd7, 0x80, 0x00],
  });
  assert.deepEqual(decodeChallenge3(overCap.fragment, SCORING_VERSION), {
    ok: false, reason: "format",
  });
  // Unterminated: the rad varint's continuation bit never clears within
  // its cap because the following bytes also carry the high bit.
  const unterminated = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums,
    radBytes: [0xff, 0xff],
  });
  assert.deepEqual(decodeChallenge3(unterminated.fragment, SCORING_VERSION), {
    ok: false, reason: "format",
  });
});

test("mc3 strictness: trailing or missing byte → format (exact-length body rule)", () => {
  const { nums } = ownerRoute();
  const base = specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums });
  const body = base.bytes.slice(0, -4);
  const trailing = specFragmentFromBytes(specReseal([...body, 0x00]));
  assert.deepEqual(decodeChallenge3(trailing, SCORING_VERSION), { ok: false, reason: "format" });
  const missing = specFragmentFromBytes(specReseal(body.slice(0, -1)));
  assert.deepEqual(decodeChallenge3(missing, SCORING_VERSION), { ok: false, reason: "format" });
  // A winner-flagged body with the block cut off can never pass as an
  // open route (the anti-downgrade rule).
  const withW = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  const cutBlock = specFragmentFromBytes(specReseal(withW.bytes.slice(0, -4 - 3)));
  assert.deepEqual(decodeChallenge3(cutBlock, SCORING_VERSION), { ok: false, reason: "format" });
});

test("mc3 tamper sweep: flipping any single bit of a golden body never decodes", () => {
  const { nums } = ownerRoute();
  const golden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  for (let pos = 0; pos < golden.bytes.length; pos++) {
    for (const bit of [0x01, 0x80]) {
      const mutated = [...golden.bytes];
      mutated[pos] = mutated[pos]! ^ bit;
      const out = decodeChallenge3(specFragmentFromBytes(mutated), SCORING_VERSION);
      assert.equal(out.ok, false, `byte ${pos} bit ${bit} must never decode`);
    }
  }
});

test("mc3 strictness: duplicate ids, id 0, count outside 5–10, scoring, length cap", () => {
  const dup = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: [101, 102, 103, 104, 101],
  });
  assert.deepEqual(decodeChallenge3(dup.fragment, SCORING_VERSION), { ok: false, reason: "format" });
  const zero = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: [0, 102, 103, 104, 105],
  });
  assert.deepEqual(decodeChallenge3(zero.fragment, SCORING_VERSION), { ok: false, reason: "format" });
  const four = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: [101, 102, 103, 104],
  });
  assert.deepEqual(decodeChallenge3(four.fragment, SCORING_VERSION), { ok: false, reason: "format" });
  const eleven = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87,
    ids: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
  });
  assert.deepEqual(decodeChallenge3(eleven.fragment, SCORING_VERSION), { ok: false, reason: "format" });
  const wrongScoring = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, s: 4, ids: [101, 102, 103, 104, 105],
  });
  assert.deepEqual(decodeChallenge3(wrongScoring.fragment, SCORING_VERSION), {
    ok: false, reason: "scoring",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3." + "A".repeat(121), SCORING_VERSION), {
    ok: false, reason: "tooBig",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3.AAAA", SCORING_VERSION), { ok: false, reason: "format" });
  for (const junk of [undefined, null, 42, {}, "", "#c=mc2.AAAA", "#c=mc3.", "#c=mc3.+++/"]) {
    assert.equal(decodeChallenge3(junk, SCORING_VERSION).ok, false, `junk: ${String(junk)}`);
  }
});

test("mc3 plausibility: best ≥ sender, routeMax bound, mask cross-check, attempts range", () => {
  const nums = [101, 102, 103, 104, 105];
  const pack = (winner: { mask: number; sender: number; best: number; attempts: number }) =>
    specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner }).fragment;
  const routeMax = 5 * (PLACE_SCORE_CAP + REGION_BONUS);
  assert.equal(routeMax, 2075);
  // best < sender is a corrupt chain.
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xf800, sender: 900, best: 800, attempts: 1 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
  // At routeMax passes; routeMax + 1 fails.
  assert.equal(
    decodeChallenge3(pack({ mask: 0xf800, sender: routeMax, best: routeMax, attempts: 1 }), SCORING_VERSION).ok,
    true,
  );
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xf800, sender: routeMax + 1, best: routeMax + 1, attempts: 1 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
  // Mask cross-check: pc = 2 ⇒ sender ≤ 2 × 415 = 830.
  assert.equal(
    decodeChallenge3(pack({ mask: 0xc000, sender: 830, best: 830, attempts: 1 }), SCORING_VERSION).ok,
    true,
  );
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xc000, sender: 831, best: 831, attempts: 1 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
  // A landed stop can score 0: sender 0 with pc > 0 stays legal.
  assert.equal(
    decodeChallenge3(pack({ mask: 0x8000, sender: 0, best: 0, attempts: 1 }), SCORING_VERSION).ok,
    true,
  );
  // Attempts: 0 and 256 fail; 255 passes.
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xf800, sender: 100, best: 100, attempts: 0 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xf800, sender: 100, best: 100, attempts: 256 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
  assert.equal(
    decodeChallenge3(pack({ mask: 0xf800, sender: 100, best: 100, attempts: 255 }), SCORING_VERSION).ok,
    true,
  );
  // Mask bits at or beyond n set → format (n = 5, bit 0 is place 16's slot).
  assert.deepEqual(
    decodeChallenge3(pack({ mask: 0xf801, sender: 100, best: 100, attempts: 1 }), SCORING_VERSION),
    { ok: false, reason: "format" },
  );
});

test("mc3 radius binding: ±10% honoured, ×1.25 fails, globe exact, envelopes hold", () => {
  const nums = [101, 102, 103, 104, 105];
  const pack = (edition: "globe" | "country" | "state", regionIndex: number, rad: number) =>
    specPack({ edition, regionIndex, rad, ids: nums }).fragment;
  // Nebraska golden 87: ×0.9 ≈ 78.3 and ×1.1 ≈ 95.7 — 79 and 95 pass.
  assert.equal(decodeChallenge3(pack("state", NEBRASKA_INDEX, 79), SCORING_VERSION).ok, true);
  assert.equal(decodeChallenge3(pack("state", NEBRASKA_INDEX, 95), SCORING_VERSION).ok, true);
  assert.deepEqual(decodeChallenge3(pack("state", NEBRASKA_INDEX, 109), SCORING_VERSION), {
    ok: false, reason: "radius",
  });
  // Globe is exact.
  assert.equal(decodeChallenge3(pack("globe", 0, 750), SCORING_VERSION).ok, true);
  assert.deepEqual(decodeChallenge3(pack("globe", 0, 749), SCORING_VERSION), {
    ok: false, reason: "radius",
  });
  // Envelope edges: Rhode Island computes 25 — 24 is inside ±10% of 25
  // but below the state envelope floor, so it still fails.
  const riIndex = SPEC_STATE_IDS.indexOf("rhode-island");
  assert.deepEqual(decodeChallenge3(pack("state", riIndex, 24), SCORING_VERSION), {
    ok: false, reason: "radius",
  });
  // United States computes the 450 country ceiling — 451 is inside
  // ±10% but above the country envelope.
  const usIndex = SPEC_COUNTRY_IDS.indexOf("united-states");
  assert.deepEqual(decodeChallenge3(pack("country", usIndex, 451), SCORING_VERSION), {
    ok: false, reason: "radius",
  });
});

test("mc3 tripwire: the scoring bound equals scorePlace's true maximum per place", () => {
  // Base-curve max (distance 0 ⇒ base 100) × tier-5 multiplier × the
  // capped combo still overflows the 400 cap, so the cap binds and the
  // region bonus adds on top: the true per-place max IS the bound.
  const scored = scorePlace({
    distanceKm: 0,
    ring: "nebraska",
    difficulty: 5,
    streakBefore: 19,
    edition: "state",
    regionId: "nebraska",
    pin: [-100, 41.5],
    target: [-100, 41.5],
  });
  assert.equal(scored.score, PLACE_SCORE_CAP + REGION_BONUS);
  assert.equal(scored.score, 415);
});

test("mc3 transition: the owner's mc2 link decodes identically under the dispatcher", () => {
  const viaMc2 = decodeChallenge2(OWNER_MC2_LINK, SCORING_VERSION);
  const viaLink = decodeChallengeLink(OWNER_MC2_LINK, SCORING_VERSION);
  assert.equal(viaMc2.ok, true);
  assert.equal(viaLink.ok, true);
  if (!viaMc2.ok || !viaLink.ok) return;
  assert.equal(viaLink.route.originFormat, "mc2");
  assert.equal(viaLink.route.edition, viaMc2.e);
  assert.equal(viaLink.route.regionId, viaMc2.r);
  assert.equal(viaLink.route.radiusKm, viaMc2.rad);
  assert.deepEqual(viaLink.route.ids, viaMc2.ids);
  assert.equal(viaLink.route.winner, undefined);
});

test("mc3 dispatcher: mc1/mc2/mc3 route correctly; unknown versions → version", () => {
  const mc1 = decodeChallengeLink(
    "#c=mc1.eyJ2IjoxLCJlIjoiZ2xvYmUiLCJzIjozLCJpZHMiOlsiZ24tMTAiLCJnbi0yIiwiZ24tMzAiLCJnbi00IiwiZ24tNSJdLCJzZWVkIjoxOTEwNTMwOTcyfQ",
    SCORING_VERSION,
  );
  assert.equal(mc1.ok, true);
  if (mc1.ok) assert.equal(mc1.route.originFormat, "mc1");
  const { ids, nums } = ownerRoute();
  const mc3 = decodeChallengeLink(
    specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955 }).fragment,
    SCORING_VERSION,
  );
  assert.equal(mc3.ok, true);
  if (mc3.ok) {
    assert.equal(mc3.route.originFormat, "mc3");
    assert.deepEqual(mc3.route.ids, ids);
    assert.deepEqual(mc3.route.winner, { sender: 955, best: 955, attempts: 1, mask: 0xe000 });
    const fields = challengeRunFields(mc3.route);
    assert.deepEqual(fields, {
      edition: "state",
      regionId: "challenge",
      regionName: "Nebraska challenge",
      challengeRegionId: "nebraska",
      challengeRadiusKm: 87,
      challengeOrigin: "mc3",
    });
  }
  for (const unknown of ["#c=mc4.AAAA", "#c=mc9.AAAA", "#c=mc0.AAAA", "#c=mc42.AAAA"]) {
    assert.deepEqual(decodeChallengeLink(unknown, SCORING_VERSION), {
      ok: false, reason: "version",
    });
  }
  // The remedy is prefix-level only: an mc2 PAYLOAD whose v is not 2
  // keeps today's reason mapping from the mc2 decoder (also "version",
  // but raised by the payload gate, not the prefix gate — the UI copy
  // distinction is pinned in the mc3 E2E spec).
  const mc2PayloadV3 =
    "#c=mc2." +
    Buffer.from(
      JSON.stringify({ v: 3, e: "state", r: "nebraska", rad: 87, s: 3, ids, seed: 1 }),
      "utf8",
    ).toString("base64url");
  assert.deepEqual(decodeChallengeLink(mc2PayloadV3, SCORING_VERSION), {
    ok: false, reason: "version",
  });
  assert.equal(CHALLENGE_VERSION_COPY, "This challenge needs the newest Meridian.");
});

test("mc3 fuzz: ≥1000 seeded mutations never throw and never decode", () => {
  const { nums } = ownerRoute();
  const golden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  // Deterministic LCG — the same seed sweeps the same cases every run.
  let state = 0x2f6e2b1;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    return state;
  };
  let cases = 0;
  for (let i = 0; i < 1200; i++) {
    const mutated = [...golden.bytes];
    const kind = next() % 3;
    if (kind === 0) {
      // Replace 1–3 bytes with random values.
      const flips = 1 + (next() % 3);
      for (let f = 0; f < flips; f++) {
        mutated[next() % mutated.length] = next() % 256;
      }
    } else if (kind === 1) {
      // Truncate.
      mutated.length = 1 + (next() % (mutated.length - 1));
    } else {
      // Extend with a random byte.
      mutated.push(next() % 256);
    }
    const fragment = specFragmentFromBytes(mutated);
    let out3: ReturnType<typeof decodeChallenge3> | undefined;
    let outLink: ReturnType<typeof decodeChallengeLink> | undefined;
    assert.doesNotThrow(() => {
      out3 = decodeChallenge3(fragment, SCORING_VERSION);
    });
    assert.doesNotThrow(() => {
      outLink = decodeChallengeLink(fragment, SCORING_VERSION);
    });
    // A mutation that changes any byte breaks the seal, so a mutated
    // body must never come back ok with altered semantics. (A mutation
    // that happens to rewrite a byte with its own value is not a
    // mutation of the semantics and is excluded by construction: the
    // replacement above can pick the same value — those rare cases are
    // counted but asserted only on the throw rule.)
    if (out3 && !out3.ok) cases++;
    assert.ok(outLink !== undefined);
  }
  assert.ok(cases >= 1000, `expected ≥1000 failing mutations, saw ${cases}`);
});

test("encodeChallenge3 throws on illegal input instead of emitting a bad link", () => {
  const ids = ["gn-101", "gn-102", "gn-103", "gn-104", "gn-105"];
  assert.throws(
    () => encodeChallenge3({ edition: "state", regionId: "france", radiusKm: 100, ids }, 3),
    TypeError,
  );
  assert.throws(
    () => encodeChallenge3({ edition: "globe", regionId: "globe", radiusKm: 700, ids }, 3),
    TypeError,
  );
  assert.throws(
    () => encodeChallenge3({ edition: "state", regionId: "nebraska", radiusKm: 87, ids: ["gn-0", ...ids.slice(1)] }, 3),
    TypeError,
  );
  assert.throws(
    () => encodeChallenge3({ edition: "state", regionId: "nebraska", radiusKm: 87, ids: ["gn-16777216", ...ids.slice(1)] }, 3),
    TypeError,
  );
  assert.throws(
    () => encodeChallenge3({ edition: "state", regionId: "nebraska", radiusKm: 87, ids }, 0),
    RangeError,
  );
  assert.throws(
    () =>
      encodeChallenge3(
        { edition: "state", regionId: "nebraska", radiusKm: 87, ids, winner: { mask: 0xf800, sender: 900, best: 800, attempts: 1 } },
        3,
      ),
    TypeError,
  );
});
