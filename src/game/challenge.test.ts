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
