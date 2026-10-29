import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHALLENGE_CHILD_COPY,
  CHALLENGE_EDITION,
  CHALLENGE_GLOBE_RADIUS_KM,
  CHALLENGE_REGION_ID,
  dealChallenge,
  decodeChallenge,
  encodeChallenge,
  playOrder,
} from "./challenge.ts";

const GOLDEN_IDS = ["gn-10", "gn-2", "gn-30", "gn-4", "gn-5"] as const;
const GOLDEN_SEED = 1910530972;
const GOLDEN_FRAGMENT =
  "#c=mc1.eyJ2IjoxLCJlIjoiZ2xvYmUiLCJzIjozLCJpZHMiOlsiZ24tMTAiLCJnbi0yIiwiZ24tMzAiLCJnbi00IiwiZ24tNSJdLCJzZWVkIjoxOTEwNTMwOTcyfQ";

const DEAL_ENTRIES = [
  { id: "gn-1", w: 1 },
  { id: "gn-2", w: 5 },
  { id: "gn-3", w: 2 },
  { id: "gn-4", w: 1 },
  { id: "gn-5", w: 8 },
  { id: "gn-6", w: 3 },
];

function b64url(json: string): string {
  return "#c=mc1." + Buffer.from(json, "utf8").toString("base64url");
}

test("locked child copy, region id, edition, and 750 km globe radius", () => {
  assert.equal(CHALLENGE_CHILD_COPY, "Could not load this challenge.");
  assert.equal(CHALLENGE_REGION_ID, "challenge");
  assert.equal(CHALLENGE_EDITION, "globe");
  assert.equal(CHALLENGE_GLOBE_RADIUS_KM, 750);
});

test("encodeChallenge emits the golden fragment", () => {
  const fragment = encodeChallenge(GOLDEN_IDS, 3);
  assert.equal(fragment, GOLDEN_FRAGMENT);
  const payload = fragment.slice("#c=mc1.".length);
  assert.equal(payload.includes("="), false);
  assert.equal(payload.includes("+"), false);
  assert.equal(payload.includes("/"), false);
});

test("encodeChallenge throws TypeError for illegal ids and RangeError for invalid scoringVersion", () => {
  assert.throws(() => encodeChallenge(["gn-1", "gn-2", "gn-3", "gn-4"], 3), TypeError);
  assert.throws(
    () => encodeChallenge(["gn-1", "gn-2", "gn-3", "gn-4", "gn-5", "gn-6", "gn-7", "gn-8", "gn-9", "gn-10", "gn-11"], 3),
    TypeError,
  );
  assert.throws(() => encodeChallenge(["gn-1", "gn-1", "gn-2", "gn-3", "gn-4"], 3), TypeError);
  assert.throws(() => encodeChallenge(["gn-1", "place", "gn-2", "gn-3", "gn-4"], 3), TypeError);
  for (const badVersion of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => encodeChallenge(GOLDEN_IDS, badVersion), RangeError);
  }
});

test("encodeChallenge and decodeChallenge work without Node.js Buffer (browser runtime)", () => {
  const g = globalThis as Record<string, unknown>;
  const origBuffer = g.Buffer;
  g.Buffer = undefined;
  try {
    const encoded = encodeChallenge(GOLDEN_IDS, 3);
    assert.equal(encoded, GOLDEN_FRAGMENT);
    const decoded = decodeChallenge(encoded, 3);
    assert.deepEqual(decoded, {
      ok: true,
      v: 1,
      e: "globe",
      s: 3,
      ids: [...GOLDEN_IDS],
      seed: GOLDEN_SEED,
    });
  } finally {
    g.Buffer = origBuffer;
  }
});

test("decodeChallenge accepts the golden fragment and does not share the id array", () => {
  const decoded = decodeChallenge(GOLDEN_FRAGMENT, 3);
  assert.deepEqual(decoded, {
    ok: true,
    v: 1,
    e: "globe",
    s: 3,
    ids: [...GOLDEN_IDS],
    seed: GOLDEN_SEED,
  });
  assert.equal(Object.keys(decoded).join(","), "ok,v,e,s,ids,seed");
});

test("playOrder copies ids and does not mutate the decoded list", () => {
  const decoded = decodeChallenge(GOLDEN_FRAGMENT, 3);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  const order: string[] = playOrder(decoded);
  assert.deepEqual(order, [...GOLDEN_IDS]);
  (order as string[]).push("gn-99");
  assert.deepEqual(decoded.ids, [...GOLDEN_IDS]);
});

test("decodeChallenge length and prefix precedence", () => {
  assert.deepEqual(decodeChallenge("x".repeat(2001), 3), { ok: false, reason: "tooBig" });
  assert.deepEqual(decodeChallenge("#c=mc1." + "A".repeat(1994), 3), { ok: false, reason: "tooBig" });
  assert.deepEqual(decodeChallenge("x".repeat(2000), 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge("#c=mc2.AAAA", 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge("mc1." + GOLDEN_FRAGMENT.slice(3), 3), { ok: false, reason: "format" });
});

test("decodeChallenge rejects bad base64, non-canonical trailing bits, non-objects, and extra keys before version", () => {
  assert.deepEqual(decodeChallenge("#c=mc1.+++/", 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge("#c=mc1.A", 3), { ok: false, reason: "format" });
  // GOLDEN_FRAGMENT body length % 4 === 2 and ends with 'Q' (index 16, low 4 bits 0000);
  // mutating the final char to 'R' (index 17, low 4 bits 0001) sets non-canonical padding bits.
  const mutatedTrailing = GOLDEN_FRAGMENT.slice(0, -1) + "R";
  assert.deepEqual(decodeChallenge(mutatedTrailing, 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge("#c=mc1." + Buffer.from("{").toString("base64url"), 3), {
    ok: false,
    reason: "format",
  });
  assert.deepEqual(decodeChallenge(b64url("null"), 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge(b64url("[]"), 3), { ok: false, reason: "format" });
  assert.deepEqual(
    decodeChallenge(
      b64url(JSON.stringify({ v: 2, e: "globe", s: 3, ids: [...GOLDEN_IDS], seed: GOLDEN_SEED, name: "x" })),
      3,
    ),
    { ok: false, reason: "format" },
  );
});

test("decodeChallenge format before version, edition, and scoring", () => {
  const ids = [...GOLDEN_IDS];
  assert.deepEqual(decodeChallenge(b64url(JSON.stringify({ v: "1", e: "globe", s: 3, ids, seed: GOLDEN_SEED })), 3), {
    ok: false,
    reason: "format",
  });
  assert.deepEqual(decodeChallenge(b64url(JSON.stringify({ v: 2, e: "globe", s: 3, ids, seed: GOLDEN_SEED })), 3), {
    ok: false,
    reason: "version",
  });
  assert.deepEqual(decodeChallenge(b64url(JSON.stringify({ v: 0, e: "globe", s: 3, ids, seed: GOLDEN_SEED })), 3), {
    ok: false,
    reason: "version",
  });
  assert.deepEqual(decodeChallenge(b64url(JSON.stringify({ v: 1, e: "daily", s: 3, ids, seed: GOLDEN_SEED })), 3), {
    ok: false,
    reason: "edition",
  });
  assert.deepEqual(decodeChallenge(b64url(JSON.stringify({ v: 1, e: "Globe", s: 3, ids, seed: GOLDEN_SEED })), 3), {
    ok: false,
    reason: "edition",
  });
  assert.deepEqual(decodeChallenge(GOLDEN_FRAGMENT, 4), { ok: false, reason: "scoring" });
  const atFour = encodeChallenge(ids, 4);
  const decodedFour = decodeChallenge(atFour, 4);
  assert.equal(decodedFour.ok, true);
  if (decodedFour.ok) assert.equal(decodedFour.s, 4);
});

test("decodeChallenge rejects duplicate and illegal ids, accepts gn-0 and gn-01", () => {
  assert.deepEqual(
    decodeChallenge(b64url(JSON.stringify({ v: 1, e: "globe", s: 3, ids: ["gn-1", "gn-1", "gn-2", "gn-3", "gn-4"], seed: 1 })), 3),
    { ok: false, reason: "format" },
  );
  const odd = ["gn-0", "gn-01", "gn-2", "gn-3", "gn-4"];
  const fragment = encodeChallenge(odd, 3);
  const decoded = decodeChallenge(fragment, 3);
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.deepEqual(decoded.ids, odd);
});

test("decodeChallenge accepts pretty JSON and rejects a tampered seed", () => {
  const pretty = JSON.stringify(
    { v: 1, e: "globe", s: 3, ids: [...GOLDEN_IDS], seed: GOLDEN_SEED },
    null,
    2,
  );
  const decoded = decodeChallenge(b64url(pretty), 3);
  assert.equal(decoded.ok, true);
  const tampered = JSON.stringify({ v: 1, e: "globe", s: 3, ids: [...GOLDEN_IDS], seed: GOLDEN_SEED + 1 });
  assert.deepEqual(decodeChallenge(b64url(tampered), 3), { ok: false, reason: "format" });
});

test("ten ids round-trip with seed 4276731875", () => {
  const ids = ["gn-1", "gn-2", "gn-3", "gn-4", "gn-5", "gn-6", "gn-7", "gn-8", "gn-9", "gn-10"];
  const decoded = decodeChallenge(encodeChallenge(ids, 3), 3);
  assert.deepEqual(decoded, { ok: true, v: 1, e: "globe", s: 3, ids, seed: 4276731875 });
});

test("dealChallenge goldens are not play order and non-positive counts return empty", () => {
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, 0, 1), []);
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, -1, 1), []);
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, Number.NaN, 1), []);
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, 5, 1), ["gn-5", "gn-4", "gn-3", "gn-6", "gn-1"]);
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, 6, 1), ["gn-5", "gn-4", "gn-3", "gn-6", "gn-1", "gn-2"]);
  assert.deepEqual(dealChallenge(DEAL_ENTRIES, 5, 2), ["gn-5", "gn-6", "gn-2", "gn-1", "gn-4"]);
  assert.deepEqual(
    dealChallenge(
      [
        { id: "gn-9", w: Number.POSITIVE_INFINITY },
        { id: "gn-8", w: Number.POSITIVE_INFINITY },
        { id: "gn-7", w: Number.POSITIVE_INFINITY },
      ],
      3,
      99,
    ),
    ["gn-9", "gn-8", "gn-7"],
  );
  const equal = GOLDEN_IDS.map((id) => ({ id, w: 1 }));
  const dealt = dealChallenge(equal, 5, 1);
  assert.deepEqual(dealt, ["gn-4", "gn-5", "gn-10", "gn-30", "gn-2"]);
  const decoded = decodeChallenge(encodeChallenge(GOLDEN_IDS, 3), 3);
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.notDeepEqual(dealt, playOrder(decoded));
});

test("challenge.ts does not import trail or touch the browser or Node Buffer", () => {
  const src = readFileSync(new URL("./challenge.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from\s+["'][^"']*trail/);
  assert.doesNotMatch(src, /document|localStorage|fetch|window/);
  assert.doesNotMatch(src, /\bBuffer\b/);
  const scoring = readFileSync(new URL("./scoring.ts", import.meta.url), "utf8");
  assert.match(scoring, /export const SCORING_VERSION = 3\b/);
});

// ============================================================================
// mc2 — all-editions challenges (manifest 2026-10-28, Package A).
// Everything above this line is the frozen mc1 suite and must not change.
// mc2 fixtures below are HAND-WRITTEN payloads with an independent in-test
// FNV-1a re-implementation, so encoder and decoder cannot share a bug.
// ============================================================================
import {
  buildCreationSources,
  challengeRadiusOf,
  createChallengeRoute,
  decodeChallenge2,
  decodeChallengeLink,
  encodeChallenge2,
} from "./challenge.ts";

/** Independent FNV-1a (32-bit, charCodeAt semantics) — written from the
 * algorithm spec, not copied from challenge.ts. */
function fnv1aSpec(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mc2Canonical(e: string, r: string, rad: number, s: number, ids: readonly string[]): string {
  return `mc2|2|${e}|${r}|${rad}|${s}|${ids.join(",")}`;
}

function mc2Fragment(payload: Record<string, unknown>): string {
  return "#c=mc2." + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function mc2Payload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    v: 2, e: "state", r: "nebraska", rad: 87, s: 3,
    ids: ["gn-101", "gn-102", "gn-103", "gn-104", "gn-105"],
  };
  const merged = { ...base, ...overrides };
  if (!("seed" in overrides)) {
    merged.seed = fnv1aSpec(
      mc2Canonical(
        merged.e as string, merged.r as string, merged.rad as number,
        merged.s as number, merged.ids as string[],
      ),
    );
  }
  return merged;
}

const MC2_IDS = ["gn-101", "gn-102", "gn-103", "gn-104", "gn-105"];

test("mc2 hand-written Nebraska payload decodes exactly (independent seed)", () => {
  const decoded = decodeChallenge2(mc2Fragment(mc2Payload()), 3);
  assert.deepEqual(decoded, {
    ok: true, v: 2, e: "state", r: "nebraska", rad: 87, s: 3,
    ids: MC2_IDS, seed: fnv1aSpec(mc2Canonical("state", "nebraska", 87, 3, MC2_IDS)),
  });
  assert.equal(Object.keys(decoded).join(","), "ok,v,e,r,rad,s,ids,seed");
});

test("encodeChallenge2 reproduces the hand-written fragment byte for byte", () => {
  const fragment = encodeChallenge2(
    { edition: "state", regionId: "nebraska", radiusKm: 87, ids: MC2_IDS }, 3,
  );
  assert.equal(fragment, mc2Fragment(mc2Payload()));
  const body = fragment.slice("#c=mc2.".length);
  assert.equal(body.includes("="), false);
  assert.equal(body.includes("+"), false);
  assert.equal(body.includes("/"), false);
});

test("mc2 rejects wrong key sets before any other gate", () => {
  const extra = mc2Payload(); extra.name = "x";
  assert.deepEqual(decodeChallenge2(mc2Fragment(extra), 3), { ok: false, reason: "format" });
  const missing = mc2Payload(); delete missing.rad;
  assert.deepEqual(decodeChallenge2(mc2Fragment(missing), 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ v: "2" })), 3), { ok: false, reason: "format" });
});

test("mc2 gate order: version, edition, region, scoring", () => {
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ v: 3 })), 3), { ok: false, reason: "version" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ v: 1 })), 3), { ok: false, reason: "version" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ e: "daily" })), 3), { ok: false, reason: "edition" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ e: "state", r: "france" })), 3), { ok: false, reason: "region" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ e: "country", r: "nebraska" })), 3), { ok: false, reason: "region" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ e: "globe", r: "nebraska", rad: 750 })), 3), { ok: false, reason: "region" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ e: "state", r: "atlantis" })), 3), { ok: false, reason: "region" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ s: 4 })), 3), { ok: false, reason: "scoring" });
});

test("mc2 radius binding: globe exact, tolerance honoured, forgery rejected", () => {
  const globe = (rad: number) => mc2Payload({ e: "globe", r: "globe", rad });
  assert.equal(decodeChallenge2(mc2Fragment(globe(750)), 3).ok, true);
  assert.deepEqual(decodeChallenge2(mc2Fragment(globe(749)), 3), { ok: false, reason: "radius" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(globe(751)), 3), { ok: false, reason: "radius" });
  // In-tolerance pinned radius with a correctly recomputed seed is honoured.
  assert.equal(decodeChallenge2(mc2Fragment(mc2Payload({ rad: 95 })), 3).ok, true);
  assert.equal(decodeChallenge2(mc2Fragment(mc2Payload({ rad: 79 })), 3).ok, true);
  // Out-of-tolerance fails even with a recomputed seed.
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ rad: 96 })), 3), { ok: false, reason: "radius" });
  assert.deepEqual(decodeChallenge2(mc2Fragment(mc2Payload({ rad: 78 })), 3), { ok: false, reason: "radius" });
  // Envelope is a coarse sanity net inside the tolerance (Rhode Island floor 25).
  assert.deepEqual(
    decodeChallenge2(mc2Fragment(mc2Payload({ r: "rhode-island", rad: 24 })), 3),
    { ok: false, reason: "radius" },
  );
  assert.deepEqual(
    decodeChallenge2(mc2Fragment(mc2Payload({ e: "country", r: "united-states", rad: 451 })), 3),
    { ok: false, reason: "radius" },
  );
});

test("mc2 seed covers ids, region, and radius (the constructible seed-only failures)", () => {
  const good = mc2Payload();
  const staleSeed = good.seed as number;
  // ids mutated, seed left stale
  const idsMutated = { ...good, ids: ["gn-105", "gn-102", "gn-103", "gn-104", "gn-101"] };
  assert.deepEqual(decodeChallenge2(mc2Fragment(idsMutated), 3), { ok: false, reason: "format" });
  // region mutated to an equal-radius region (Delaware is also 25), seed stale
  const ri = mc2Payload({ r: "rhode-island", rad: 25 });
  const regionMutated: Record<string, unknown> = { ...ri, r: "delaware" };
  assert.equal(regionMutated.seed, ri.seed);
  assert.deepEqual(decodeChallenge2(mc2Fragment(regionMutated), 3), { ok: false, reason: "format" });
  // radius mutated inside tolerance, seed stale
  const radMutated = { ...mc2Payload({ r: "rhode-island", rad: 25 }), rad: 26 };
  assert.deepEqual(decodeChallenge2(mc2Fragment(radMutated), 3), { ok: false, reason: "format" });
  assert.equal(staleSeed, fnv1aSpec(mc2Canonical("state", "nebraska", 87, 3, MC2_IDS)));
});

test("mc2 decode never throws and caps length like mc1", () => {
  assert.deepEqual(decodeChallenge2("x".repeat(2001), 3), { ok: false, reason: "tooBig" });
  assert.deepEqual(decodeChallenge2("#c=mc2." + "A".repeat(1994), 3), { ok: false, reason: "tooBig" });
  for (const junk of [undefined, null, 42, {}, "#c=mc1.AAAA", "#c=mc2.", "#c=mc2.+++/", ""]) {
    const out = decodeChallenge2(junk, 3);
    assert.equal(out.ok, false, `junk input: ${String(junk)}`);
  }
});

test("encodeChallenge2 throws on illegal input instead of emitting a bad link", () => {
  assert.throws(() => encodeChallenge2({ edition: "state", regionId: "france", radiusKm: 100, ids: MC2_IDS }, 3), TypeError);
  assert.throws(() => encodeChallenge2({ edition: "globe", regionId: "globe", radiusKm: 700, ids: MC2_IDS }, 3), TypeError);
  assert.throws(() => encodeChallenge2({ edition: "state", regionId: "nebraska", radiusKm: 87.5, ids: MC2_IDS }, 3), TypeError);
  assert.throws(() => encodeChallenge2({ edition: "state", regionId: "nebraska", radiusKm: 87, ids: MC2_IDS.slice(0, 4) }, 3), TypeError);
  assert.throws(() => encodeChallenge2({ edition: "state", regionId: "nebraska", radiusKm: 87, ids: MC2_IDS }, 0), RangeError);
});

test("decodeChallengeLink dispatches per version and rejects unknown versions", () => {
  const mc2 = decodeChallengeLink(mc2Fragment(mc2Payload()), 3);
  assert.equal(mc2.ok, true);
  if (mc2.ok) {
    assert.equal(mc2.route.originFormat, "mc2");
    assert.equal(mc2.route.regionName, "Nebraska");
  }
  assert.deepEqual(decodeChallengeLink("#c=mc3.AAAA", 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallengeLink("#x=mc2.AAAA", 3), { ok: false, reason: "format" });
  assert.deepEqual(decodeChallengeLink("", 3), { ok: false, reason: "format" });
});

test("challengeRadiusOf defaults a legacy challenge run to the globe radius", () => {
  assert.equal(challengeRadiusOf({}), 750);
  assert.equal(challengeRadiusOf({ challengeRadiusKm: 87 }), 87);
});

// --- Creation helper (one pure path for picker + summary) ---
const CREATION_CATALOG = [
  { id: "gn-101", difficulty: 3 }, { id: "gn-102", difficulty: 1 },
  { id: "gn-103", difficulty: 5 }, { id: "gn-104", difficulty: 2 },
  { id: "gn-105", difficulty: 4 }, { id: "gn-106", difficulty: 1 },
  { id: "gn-107", difficulty: 2 }, { id: "gn-108", difficulty: 3 },
] as const;

test("fresh creation deals the golden five, fame-tier ascending, as mc2", () => {
  const created = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "fresh", sources: [CREATION_CATALOG], dealSeed: 7,
  });
  assert.ok(created);
  // dealChallenge(seed 7) over this catalog, then stable fame-tier order.
  assert.deepEqual(created.dealtIds, ["gn-106", "gn-104", "gn-107", "gn-105", "gn-103"]);
  assert.equal(created.placeCount, 5);
  assert.equal(created.regionName, "Nebraska");
  assert.equal(created.radiusKm, 87);
  assert.ok(created.fragment.startsWith("#c=mc2."));
  const decoded = decodeChallenge2(created.fragment, 3);
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.deepEqual(decoded.ids, created.dealtIds);
  const second = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "fresh", sources: [CREATION_CATALOG], dealSeed: 42,
  });
  assert.deepEqual(second?.dealtIds, ["gn-106", "gn-104", "gn-108", "gn-101", "gn-103"]);
});

test("fresh creation widens in-region when the first source is too thin", () => {
  const thin = CREATION_CATALOG.slice(0, 3);
  const created = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "fresh", sources: [thin, CREATION_CATALOG], dealSeed: 7,
  });
  assert.deepEqual(created?.dealtIds, ["gn-106", "gn-104", "gn-107", "gn-105", "gn-103"]);
  const starved = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "fresh", sources: [thin], dealSeed: 7,
  });
  assert.equal(starved, null);
});

test("exact creation keeps play order verbatim and caps at ten", () => {
  const played = ["gn-9", "gn-3", "gn-7", "gn-1", "gn-8", "gn-2", "gn-6", "gn-4", "gn-5", "gn-10", "gn-11", "gn-12"];
  const created = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "exact", exactIds: played,
  });
  assert.deepEqual(created?.dealtIds, played.slice(0, 10));
  assert.equal(created?.placeCount, 10);
  const tooFew = createChallengeRoute({
    edition: "state", regionId: "nebraska", scoringVersion: 3,
    mode: "exact", exactIds: played.slice(0, 4),
  });
  assert.equal(tooFew, null);
});

test("exact creation for the globe stays mc1, byte-identical to the frozen encoder", () => {
  const ids = ["gn-53654", "gn-54225", "gn-55671", "gn-57289", "gn-60149"];
  const created = createChallengeRoute({
    edition: "globe", regionId: "globe", scoringVersion: 3, mode: "exact", exactIds: ids,
  });
  assert.equal(created?.fragment, encodeChallenge(ids, 3));
  assert.equal(created?.radiusKm, 750);
  assert.equal(created?.regionName, "Globe");
});

test("fresh creation for the globe encodes mc2, never mc1", () => {
  const created = createChallengeRoute({
    edition: "globe", regionId: "globe", scoringVersion: 3,
    mode: "fresh", sources: [CREATION_CATALOG], dealSeed: 7,
  });
  assert.ok(created?.fragment.startsWith("#c=mc2."));
  assert.equal(created?.radiusKm, 750);
});

test("buildCreationSources orders the widening chain inside the region", () => {
  const catalog = CREATION_CATALOG.map((p) => ({ ...p }));
  const seen = new Set(["gn-102", "gn-106"]); // both tier 1 (easy band)
  const chain = buildCreationSources({
    catalog, choice: "easy", seenIds: seen, runPoolIds: ["gn-103", "gn-101", "gn-102"],
  });
  // 1: the run's own pool intersected with the catalog, run order kept
  assert.deepEqual(chain[0].map((p) => p.id), ["gn-103", "gn-101", "gn-102"]);
  // 2: the band minus seen ids
  assert.deepEqual(chain[1].map((p) => p.id), ["gn-104", "gn-107"]);
  // 3: the band
  assert.deepEqual(chain[2].map((p) => p.id), ["gn-102", "gn-104", "gn-106", "gn-107"]);
  // 4: the full catalog of the one region — never anything wider
  assert.deepEqual(chain[3].map((p) => p.id), catalog.map((p) => p.id));
  // Without a run pool, the chain starts at the band-minus-seen step.
  const noRun = buildCreationSources({ catalog, choice: "easy", seenIds: seen });
  assert.deepEqual(noRun[0].map((p) => p.id), ["gn-104", "gn-107"]);
});

test("re-share preserves an off-golden in-tolerance radius (manifest §6, the sharpest freeze test)", () => {
  // Nebraska's computed radius is 87; a received link pinned 90 is
  // honoured at receive — and the completion re-share must carry 90
  // forward, never silently re-pin 87.
  const created = createChallengeRoute({
    edition: "state",
    regionId: "nebraska",
    scoringVersion: 3,
    mode: "exact",
    exactIds: ["gn-5072006", "gn-5074472", "gn-5063805", "gn-5068725", "gn-5069297"],
    originFormat: "mc2",
    radiusKmOverride: 90,
  });
  assert.ok(created);
  assert.ok(created.fragment.startsWith("#c=mc2."));
  assert.equal(created.radiusKm, 90);
  const decoded = decodeChallengeLink(created.fragment, 3);
  assert.ok(decoded.ok);
  assert.equal(decoded.route.radiusKm, 90);
  assert.deepEqual(decoded.route.ids, [
    "gn-5072006",
    "gn-5074472",
    "gn-5063805",
    "gn-5068725",
    "gn-5069297",
  ]);
});

test("re-share preserves origin format: an mc2 Globe route stays mc2, an mc1 route stays mc1", () => {
  const ids = ["gn-101", "gn-102", "gn-103", "gn-104", "gn-105"];
  const mc2Globe = createChallengeRoute({
    edition: "globe",
    regionId: "globe",
    scoringVersion: 3,
    mode: "exact",
    exactIds: ids,
    originFormat: "mc2",
    radiusKmOverride: 750,
  });
  assert.ok(mc2Globe);
  assert.ok(mc2Globe.fragment.startsWith("#c=mc2."));
  const decoded2 = decodeChallengeLink(mc2Globe.fragment, 3);
  assert.ok(decoded2.ok);
  assert.equal(decoded2.route.radiusKm, 750);
  assert.equal(decoded2.route.originFormat, "mc2");
  const mc1Globe = createChallengeRoute({
    edition: "globe",
    regionId: "globe",
    scoringVersion: 3,
    mode: "exact",
    exactIds: ids,
    originFormat: "mc1",
  });
  assert.ok(mc1Globe);
  assert.ok(mc1Globe.fragment.startsWith("#c=mc1."));
});
