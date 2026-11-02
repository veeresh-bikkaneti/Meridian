import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_VERSION_COPY,
  MC3_COUNTRY_REGION_IDS,
  MC3_STATE_REGIONS,
  MC3_STATE_REGION_IDS,
  isLegalWinnerBlock,
  routeCeiling,
  challengeRunFields,
  decodeChallenge2,
  decodeChallenge3,
  decodeChallengeLink,
  encodeChallenge3,
  type ChallengeWinner,
} from "./challenge.ts";
import { ADMIN1_BY_COUNTRY, COUNTRIES, findRegion } from "./regions.ts";
import { regionRadiusKm } from "./radius.ts";
import { SCORING_VERSION, scorePlace } from "./scoring.ts";
import { loadRegionChunk } from "./generated-places.ts";
import { STARTERS } from "./starters.ts";
import manifestJson from "./data/geonames/manifest.json" with { type: "json" };

/**
 * mc3 tests (governing council manifest 2026-10-31: the field layout,
 * §Q1 amendments A1–A6, §Q2 gates B1–B2, and the binding test-spec
 * deltas). Golden vectors are built here by an INDEPENDENT packing
 * routine — written from the byte layout in the manifest, sharing no
 * code with challenge.ts — so the encoder and decoder cannot silently
 * agree on a bug.
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

interface SpecWinner {
  senderMask: number;
  senderScore: number;
  bestScore: number;
  senderAttempts: number;
}

interface SpecPackInput {
  edition: "globe" | "country" | "state";
  regionIndex: number;
  rad: number;
  s?: number;
  ids: number[];
  winner?: SpecWinner;
  /** Raw overrides for strictness cases: replace a field's encoding. */
  radBytes?: number[];
  regionBytes?: number[];
  senderBytes?: number[];
  bestBytes?: number[];
  attemptsBytes?: number[];
  b0Override?: number;
}

function specPack(input: SpecPackInput): { bytes: number[]; fragment: string } {
  const editionCode = input.edition === "globe" ? 0 : input.edition === "country" ? 1 : 2;
  const b0 =
    input.b0Override ?? ((editionCode << 6) | (input.winner ? 0x20 : 0));
  const body: number[] = [b0, input.s ?? SCORING_VERSION];
  body.push(...(input.radBytes ?? specVarint(input.rad)));
  body.push(...(input.regionBytes ?? specVarint(input.regionIndex)));
  body.push(input.ids.length);
  for (const id of input.ids) {
    body.push((id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff);
  }
  if (input.winner) {
    body.push((input.winner.senderMask >> 8) & 0xff, input.winner.senderMask & 0xff);
    body.push(...(input.senderBytes ?? specVarint(input.winner.senderScore)));
    body.push(...(input.bestBytes ?? specVarint(input.winner.bestScore)));
    body.push(...(input.attemptsBytes ?? specVarint(input.winner.senderAttempts)));
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

// --- The owner's Nebraska route (his pasted mc2 link) ---

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
// A legal 955 on the owner's route: the first four stops hit in a row
// (sequential bound 278+290+303+315 = 1,186 ≥ 955 under §Q2-B1).
const WINNER_955: ChallengeWinner = {
  senderMask: 0xf000,
  senderScore: 955,
  bestScore: 955,
  senderAttempts: 1,
};

test("mc3 golden: the owner's Nebraska route re-minted — 52 payload chars, no winner block", () => {
  const { ids, nums } = ownerRoute();
  const golden = specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums });
  const payload = golden.fragment.slice("#c=mc3.".length);
  assert.equal(payload.length, 52, "payload length (owner's specimen, 274 → 52)");
  assert.equal(golden.fragment.length, 59);
  const decoded = decodeChallenge3(golden.fragment, SCORING_VERSION);
  assert.deepEqual(decoded, {
    ok: true, v: 3, e: "state", r: "nebraska", rad: 87, s: 3, ids, winner: null,
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
  assert.equal(payload.length, 62, "payload length with winner block");
  const decoded = decodeChallenge3(golden.fragment, SCORING_VERSION);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.ids, ids);
  assert.deepEqual(decoded.winner, WINNER_955);
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
  const winner: ChallengeWinner = {
    senderMask: 0xf800,
    senderScore: 800,
    bestScore: 900,
    senderAttempts: 2,
  };
  for (const { edition, regionId } of cases) {
    const radiusKm = regionRadiusKm(edition, regionId);
    assert.ok(radiusKm !== null);
    for (const n of [5, 10]) {
      const ids = Array.from({ length: n }, (_, i) => `gn-${1000 + i * 137}`);
      for (const w of [null, winner] as const) {
        // Mask 0xf800 = the first five stops hit in a row: legal for
        // both n (sequential bound over those streaks is 1,514 ≥ 800;
        // for n = 10 the remaining stops are misses, streak ends).
        const fragment = encodeChallenge3(
          { edition, regionId, radiusKm, ids, winner: w ?? undefined },
          SCORING_VERSION,
        );
        assert.ok(fragment.length <= 127, `${edition} n=${n} W=${!!w} within the cap`);
        const decoded = decodeChallenge3(fragment, SCORING_VERSION);
        assert.equal(decoded.ok, true, `${edition} n=${n} W=${!!w}`);
        if (!decoded.ok) return;
        assert.equal(decoded.e, edition);
        assert.equal(decoded.r, regionId);
        assert.equal(decoded.rad, radiusKm);
        assert.deepEqual(decoded.ids, ids);
        assert.deepEqual(decoded.winner, w);
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
  // An index past the end of the edition's registry fails `region`.
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

test("mc3 region registry: every slug resolves via findRegion; states resolve within their parent (§Q1-A3)", () => {
  // The registry is explicit and does NOT derive from regions.ts
  // ordering — regions.ts may re-sort freely. What must hold: every
  // registered slug still resolves, and a state slug resolves inside
  // the parent its registry entry records.
  for (const slug of MC3_COUNTRY_REGION_IDS) {
    assert.ok(findRegion("country", slug), `country slug resolves: ${slug}`);
    assert.ok(COUNTRIES.some((r) => r.id === slug), `country slug in atlas: ${slug}`);
  }
  for (const entry of MC3_STATE_REGIONS) {
    assert.ok(findRegion("state", entry.slug), `state slug resolves: ${entry.slug}`);
    assert.ok(
      (ADMIN1_BY_COUNTRY[entry.parent] ?? []).some((r) => r.id === entry.slug),
      `state ${entry.slug} is an admin-1 of its parent ${entry.parent}`,
    );
  }
  assert.equal(findRegion("globe", "globe")?.id, "globe");
});

test("mc3 region registry: no-shrink/no-reorder snapshot — frozen entries are an exact prefix", () => {
  assert.deepEqual(MC3_COUNTRY_REGION_IDS.slice(0, SPEC_COUNTRY_IDS.length), SPEC_COUNTRY_IDS);
  assert.deepEqual(MC3_STATE_REGION_IDS.slice(0, SPEC_STATE_IDS.length), SPEC_STATE_IDS);
  assert.ok(MC3_COUNTRY_REGION_IDS.length >= SPEC_COUNTRY_IDS.length);
  assert.ok(MC3_STATE_REGION_IDS.length >= SPEC_STATE_IDS.length);
});

test("mc3 tripwire: the catalog's maximum GeoNames id fits a uint24 (§Q1-A5)", async () => {
  // A dataset refresh that crosses 2^24 must turn this test red
  // deliberately instead of truncating an id at encode time.
  const manifest = manifestJson as unknown as {
    regions: Record<string, { count: number }>;
  };
  let max = 0;
  let scanned = 0;
  const scan = (id: string) => {
    const m = /^gn-(\d+)$/.exec(id);
    if (m) {
      scanned++;
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  };
  for (const regionId of Object.keys(manifest.regions)) {
    const starters = await loadRegionChunk(regionId);
    for (const s of starters) scan(s.id);
  }
  for (const s of STARTERS) scan(s.id);
  assert.ok(scanned > 100_000, `scanned the catalog (${scanned} gn- ids)`);
  assert.ok(max < 2 ** 24, `max GeoNames id ${max} must stay < ${2 ** 24}`);
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
  // A multi-byte varint whose final group is 0x00 is the overlong
  // marker (§Q1-A1) — a non-final 0x80 group, by contrast, is normal.
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
  // A two-byte rad above 127 is canonical and legal: Texas computes
  // 150, which encodes as 0x96 0x01 (a non-final 0x80-carrying group
  // is exactly how values ≥ 128 are written).
  const texas = specPack({
    edition: "state", regionIndex: SPEC_STATE_IDS.indexOf("texas"), rad: 150, ids: nums,
  });
  assert.equal(decodeChallenge3(texas.fragment, SCORING_VERSION).ok, true);
});

test("mc3 strictness: the varint dictionary fails in EVERY varint slot (§test-spec fuzz expansion)", () => {
  const nums = [101, 102, 103, 104, 105];
  const dictionary: Record<string, number[]> = {
    "80 80 80": [0x80, 0x80, 0x80],
    "FF FF 7F": [0xff, 0xff, 0x7f],
    "80 00": [0x80, 0x00],
  };
  const base: SpecPackInput = {
    edition: "state",
    regionIndex: NEBRASKA_INDEX,
    rad: 87,
    ids: nums,
    winner: { senderMask: 0xf800, senderScore: 100, bestScore: 100, senderAttempts: 1 },
  };
  assert.equal(decodeChallenge3(specPack(base).fragment, SCORING_VERSION).ok, true);
  const slots = ["radBytes", "regionBytes", "senderBytes", "bestBytes", "attemptsBytes"] as const;
  for (const slot of slots) {
    for (const [name, bytes] of Object.entries(dictionary)) {
      const packed = specPack({ ...base, [slot]: bytes });
      assert.deepEqual(
        decodeChallenge3(packed.fragment, SCORING_VERSION),
        { ok: false, reason: "format" },
        `${slot} ← ${name}`,
      );
    }
  }
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

test("mc3 strictness: duplicate ids, id 0, count outside 5–10, scoring, length cap, base64 edges", () => {
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
  // Fragment-length edges: 126/127 chars are judged on their content
  // (and fail the seal), 128 is tooBig before any decoding.
  assert.deepEqual(decodeChallenge3("#c=mc3." + "A".repeat(119), SCORING_VERSION), {
    ok: false, reason: "format",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3." + "A".repeat(120), SCORING_VERSION), {
    ok: false, reason: "format",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3." + "A".repeat(121), SCORING_VERSION), {
    ok: false, reason: "tooBig",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3.AAAA", SCORING_VERSION), { ok: false, reason: "format" });
  // Base64 edges: padding present, a %4 == 1 length, non-alphabet chars.
  const { nums } = ownerRoute();
  const golden = specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums });
  assert.deepEqual(decodeChallenge3(golden.fragment + "=", SCORING_VERSION), {
    ok: false, reason: "format",
  });
  assert.deepEqual(decodeChallenge3("#c=mc3.AAAAA", SCORING_VERSION), {
    ok: false, reason: "format",
  });
  // Non-zero spare bits in the final character: the winner golden's
  // payload is 62 chars (%4 == 2), so its last character's low 4 bits
  // must be 0; 'B' (index 1) sets one.
  const wGolden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  const payload = wGolden.fragment.slice("#c=mc3.".length);
  assert.equal(payload.length % 4, 2);
  assert.notEqual(payload[payload.length - 1], "B");
  assert.deepEqual(decodeChallenge3("#c=mc3." + payload.slice(0, -1) + "B", SCORING_VERSION), {
    ok: false, reason: "format",
  });
  for (const junk of [undefined, null, 42, {}, "", "#c=mc2.AAAA", "#c=mc3.", "#c=mc3.+++/"]) {
    assert.equal(decodeChallenge3(junk, SCORING_VERSION).ok, false, `junk: ${String(junk)}`);
  }
});

test("mc3 plausibility (§Q2-B1): the sequential bound, not a flat per-place cap", () => {
  const nums = [101, 102, 103, 104, 105];
  const pack = (winner: SpecWinner) =>
    specPack({ edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner }).fragment;
  // routeCeiling(5): five hits in a row, streaks 1–5.
  assert.equal(routeCeiling(5), 278 + 290 + 303 + 315 + 328);
  assert.equal(routeCeiling(5), 1514);
  assert.equal(routeCeiling(10), 3340);
  // best < sender is a corrupt chain.
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 900, bestScore: 800, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  // Sender exactly at the mask's sequential bound passes; +1 fails.
  // (Under the rejected flat 415n bound both would be waved through —
  // 5 × 415 = 2,075 — which is exactly the forgery this closes.)
  assert.equal(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 1514, bestScore: 1514, senderAttempts: 1 }),
      SCORING_VERSION,
    ).ok,
    true,
  );
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 1515, bestScore: 1515, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  // best above the route ceiling fails even with a modest sender.
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 100, bestScore: 1515, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  // Streak shape matters, not just the hit count: two hits in a row
  // bound at 278+290 = 568; the same two hits SPLIT (stops 1 and 5)
  // bound at 278+278 = 556.
  assert.equal(
    decodeChallenge3(
      pack({ senderMask: 0xc000, senderScore: 560, bestScore: 560, senderAttempts: 1 }),
      SCORING_VERSION,
    ).ok,
    true,
  );
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0x8800, senderScore: 560, bestScore: 560, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  // Zero target: bestScore 0 is never a mintable chain state — the
  // all-miss play chain-starts OPEN instead. (The sender scoring 0
  // with a real target stays legal: a hit can score 0.)
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0x8000, senderScore: 0, bestScore: 0, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  assert.equal(
    decodeChallenge3(
      pack({ senderMask: 0x8000, senderScore: 0, bestScore: 100, senderAttempts: 1 }),
      SCORING_VERSION,
    ).ok,
    true,
  );
  // Attempts: 0 and 256 fail; 255 passes.
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 100, bestScore: 100, senderAttempts: 0 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 100, bestScore: 100, senderAttempts: 256 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
  assert.equal(
    decodeChallenge3(
      pack({ senderMask: 0xf800, senderScore: 100, bestScore: 100, senderAttempts: 255 }),
      SCORING_VERSION,
    ).ok,
    true,
  );
  // Mask bits at or beyond n set → format (n = 5, bit 0 is place 16's slot).
  assert.deepEqual(
    decodeChallenge3(
      pack({ senderMask: 0xf801, senderScore: 100, bestScore: 100, senderAttempts: 1 }),
      SCORING_VERSION,
    ),
    { ok: false, reason: "format" },
  );
});

test("mc3 save boundary (§Q1-A4): isLegalWinnerBlock is complete-or-discard", () => {
  assert.equal(isLegalWinnerBlock(WINNER_955, 10), true);
  assert.equal(isLegalWinnerBlock(null, 10), false);
  assert.equal(isLegalWinnerBlock(undefined, 10), false);
  assert.equal(
    isLegalWinnerBlock({ senderScore: 955, bestScore: 955, senderAttempts: 1 }, 10),
    false,
    "a missing field discards the whole save",
  );
  assert.equal(
    isLegalWinnerBlock({ ...WINNER_955, bestScore: 0 }, 10),
    false,
    "a zero target is illegal in a save too",
  );
  assert.equal(
    isLegalWinnerBlock({ ...WINNER_955, senderScore: "955" }, 10),
    false,
    "non-numeric fields discard",
  );
  assert.equal(
    isLegalWinnerBlock({ ...WINNER_955, senderMask: 0xe001 }, 10),
    false,
    "mask bits beyond the route's places discard",
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

test("mc3 tripwire: routeCeiling equals the synthetic maximum route through scorePlace itself", () => {
  // The governing tripwire: deal the perfect route through the LIVE
  // scorer (distance 0, tier 5, region bonus on every stop, streak
  // growing 0→9) and require the codec's ceiling to equal the sum.
  // If a future scoring change moves the true maximum, this turns red
  // instead of the link bound silently drifting.
  let total = 0;
  for (let streakBefore = 0; streakBefore < 10; streakBefore++) {
    const scored = scorePlace({
      distanceKm: 0,
      ring: "nebraska",
      difficulty: 5,
      streakBefore,
      edition: "state",
      regionId: "nebraska",
      pin: [-100, 41.5],
      target: [-100, 41.5],
    });
    total += scored.score;
  }
  assert.equal(total, 3340);
  assert.equal(routeCeiling(10), total);
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
  assert.equal(viaLink.route.winner, null);
});

test("mc3 dispatcher: mc1/mc2/mc3 route correctly; version class needs a well-formed fragment (§Q1-A6)", () => {
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
    assert.deepEqual(mc3.route.winner, WINNER_955);
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
  // (i) A well-formed fragment of an unknown version earns the version
  // class — the friend whose app wrote it is simply newer.
  for (const unknown of ["#c=mc4.AAAA", "#c=mc9.AAAA", "#c=mc0.AAAA", "#c=mc42.AAAA"]) {
    assert.deepEqual(decodeChallengeLink(unknown, SCORING_VERSION), {
      ok: false, reason: "version",
    });
  }
  // But a malformed body is NOT well-formed, whatever its prefix says:
  // garbage earns the corrupt class, never the version remedy.
  for (const malformed of ["#c=mc4.+++", "#c=mc4.", "#c=mc4.AAAAA", "#c=mc4.AA=A"]) {
    assert.deepEqual(
      decodeChallengeLink(malformed, SCORING_VERSION),
      { ok: false, reason: "format" },
      malformed,
    );
  }
  // (ii) An mc3 body whose region index this build doesn't know is a
  // registry-skew case: the decoder reports `region` and the app maps
  // it to the version class (asserted in the E2E spec).
  const skewed = specPack({
    edition: "country", regionIndex: 13, rad: 200, ids: [101, 102, 103, 104, 105],
  });
  assert.deepEqual(decodeChallengeLink(skewed.fragment, SCORING_VERSION), {
    ok: false, reason: "region",
  });
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

test("mc3 fuzz: exhaustive truncation/extension at every length never decodes, never throws", () => {
  const { nums } = ownerRoute();
  const golden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  for (let len = 0; len < golden.bytes.length; len++) {
    const fragment = specFragmentFromBytes(golden.bytes.slice(0, len));
    let out: ReturnType<typeof decodeChallenge3> | undefined;
    assert.doesNotThrow(() => {
      out = decodeChallenge3(fragment, SCORING_VERSION);
    }, `truncated to ${len} bytes`);
    assert.equal(out?.ok, false, `truncated to ${len} bytes must not decode`);
    assert.doesNotThrow(() => decodeChallengeLink(fragment, SCORING_VERSION));
  }
  for (const extra of [0x00, 0x01, 0x80, 0xff]) {
    const fragment = specFragmentFromBytes([...golden.bytes, extra]);
    assert.equal(
      decodeChallenge3(fragment, SCORING_VERSION).ok,
      false,
      `extended with 0x${extra.toString(16)} must not decode`,
    );
  }
});

test("mc3 fuzz: ≥1000 seeded mutations never throw and never decode with altered semantics", () => {
  const { nums } = ownerRoute();
  const golden = specPack({
    edition: "state", regionIndex: NEBRASKA_INDEX, rad: 87, ids: nums, winner: WINNER_955,
  });
  const goldenDecoded = decodeChallenge3(golden.fragment, SCORING_VERSION);
  assert.equal(goldenDecoded.ok, true);
  // Deterministic LCG — the same seed sweeps the same cases every run.
  let state = 0x2f6e2b1;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    return state;
  };
  let altered = 0;
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
    assert.ok(outLink !== undefined);
    // The governing assertion: a mutation either fails, or — when the
    // "mutation" rewrote a byte with its own value and changed nothing
    // — decodes to EXACTLY the golden route. Never ok-with-altered.
    const changed = mutated.length !== golden.bytes.length
      || mutated.some((b, idx) => b !== golden.bytes[idx]);
    if (out3?.ok) {
      assert.equal(changed, false, "an altered body must never decode ok");
      assert.deepEqual(out3, goldenDecoded);
    } else if (changed) {
      altered++;
    }
  }
  assert.ok(altered >= 1000, `expected ≥1000 altered-and-rejected mutations, saw ${altered}`);
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
        {
          edition: "state", regionId: "nebraska", radiusKm: 87, ids,
          winner: { senderMask: 0xf800, senderScore: 900, bestScore: 800, senderAttempts: 1 },
        },
        3,
      ),
    TypeError,
  );
  // A zero target can never be minted (§Q2-B1): the all-miss sender
  // chain-starts open instead of writing bestScore 0.
  assert.throws(
    () =>
      encodeChallenge3(
        {
          edition: "state", regionId: "nebraska", radiusKm: 87, ids,
          winner: { senderMask: 0x8000, senderScore: 0, bestScore: 0, senderAttempts: 1 },
        },
        3,
      ),
    TypeError,
  );
});
