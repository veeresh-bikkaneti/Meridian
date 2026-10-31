/**
 * Friend challenges: one player finishes a Globe run, taps "Share this
 * route with a friend", and sends a link. The friend taps the link and
 * plays the SAME places, in the same order, judged by the same 750 km
 * circle. This file is the whole link format plus the dealing helpers —
 * it is pure (no storage, no DOM beyond the base64 built-ins), so the
 * codec is unit-tested directly in challenge.test.ts.
 *
 * The wire format — what is inside a link like
 * `https://…/Meridian/#c=mc1.eyJ2Ijox…`:
 *
 * - The link carries everything in the URL fragment (the part after
 *   `#`). Fragments are never sent to a server, so a challenge needs no
 *   backend, no account, and no stored state — that is why the format
 *   exists at all. The app strips the fragment from the address bar the
 *   moment it boots (see the boot effect in game-app.tsx), so the link
 *   cannot be re-read or leaked by a later screenshot of the URL.
 * - `#c=mc1.` is the prefix: `#c=` says "challenge", `mc1` is the format
 *   name and version (Meridian Challenge 1). Anything that does not
 *   start with exactly this prefix is not a challenge link.
 * - After the prefix comes the payload: a small JSON object encoded as
 *   base64url (the URL-safe base64 alphabet, `-` and `_` instead of
 *   `+` and `/`, no `=` padding). The JSON keys are one letter each to
 *   keep links short:
 *     v    format version, currently always 1
 *     e    edition — "globe"; challenges are Globe-only for now
 *     s    the scoring version the sender's game used, so a link made
 *          by an old build cannot be judged by new scoring rules
 *     ids  the place ids to play, in play order (5–10 of them)
 *     seed an integrity check over the ids — see fnv1a below
 * - The whole fragment is capped at 2000 characters. Browsers, chat
 *   apps, and QR-ish copy/paste paths all mangle very long URLs, and a
 *   legal payload (at most 10 short ids) is nowhere near the cap — so
 *   anything longer is treated as broken, not trimmed.
 * - Decoding FAILS CLOSED: decodeChallenge never throws and never
 *   returns a half-trusted challenge. It returns either the full
 *   checked payload or `{ ok: false, reason }`, where reason is one of
 *     "format"  — not our prefix, not valid canonical base64url, not
 *                 JSON, wrong keys, illegal ids, or the seed does not
 *                 match the ids (the link was edited or corrupted)
 *     "version" — a future mc format this build does not understand
 *     "scoring" — the sender's scoring version differs from ours
 *     "edition" — not a Globe challenge
 *     "tooBig"  — over the 2000-character cap
 *   The reasons exist for tests and debugging; the player only ever
 *   sees CHALLENGE_CHILD_COPY below, never a reason.
 * - Spoiler safety: the payload holds ONLY ids and the seed. No place
 *   names, no coordinates, no scores — a friend who inspects the link
 *   learns nothing about where the places are, and the sender's result
 *   is not in it either. The receiving game looks the ids up in its own
 *   Globe catalog and refuses the run if any id is unknown.
 */
export const CHALLENGE_CHILD_COPY = "Could not load this challenge.";
export const CHALLENGE_REGION_ID = "challenge";
export const CHALLENGE_REGION_NAME = "Friend challenge";
export const CHALLENGE_EDITION = "globe";
export const CHALLENGE_GLOBE_RADIUS_KM = 750;
export const CHALLENGE_MIN_PLACES = 5;
export const CHALLENGE_MAX_PLACES = 10;
export const CHALLENGE_SHARE_LABEL = "Share this route with a friend";
/** The summary exact primary's label (manifest §1(d)): one verb for
 * every share surface — "Challenge a friend" — with the route kind
 * named after it. Applies in every edition, Globe included. */
export const CHALLENGE_EXACT_SHARE_LABEL = "Challenge a friend — play my route";
/** The completion re-share's label (manifest §1(f)): the receiver
 * passes the route along in its origin format. mc1 completions keep
 * CHALLENGE_SHARE_LABEL — that surface is frozen. */
export const CHALLENGE_RESHARE_LABEL = "Pass this challenge to a friend";
/** The mid-run run-menu item (manifest §1(b)): a fresh route in the
 * run's own region, created from the menu only — never an aim-surface
 * button. */
export function challengeMidRunLabel(regionName: string): string {
  return `Challenge a friend — new route in ${regionName}`;
}
/** The reveal text link (manifest §1(c)), in the result-card footer
 * below Next place. */
export function challengeRevealLabel(regionName: string): string {
  return `Challenge a friend in ${regionName}`;
}
/** The non-interactive line under the reveal link (manifest §1(c)):
 * the sender's own route — the summary's exact share — unlocks only
 * when the run is finished. */
export const CHALLENGE_UNLOCK_HINT = "Your route unlocks when you finish 🏁";
/** The challenge-complete secondary (manifest §1(f)): a fresh route in
 * the completed route's region, offered beside the pass-along. */
export function challengeFreshRouteLabel(regionName: string): string {
  return `Or send a new ${regionName} route`;
}
/** The review-surface entry (manifest §1(e)): deck-level, on the home
 * Review card and the review-complete screen. It opens the region
 * mini-picker and deals FRESH from the picked region — the deck's
 * cards are never a deal source (the manifest's §3 privacy rule:
 * the design council ruled never-the-deck, and a labelled "Beat my
 * misses" opt-in was deferred to the owner as an open question;
 * deck ids are decodable from any link that carries them). */
export const CHALLENGE_REVIEW_LABEL = "Challenge a friend — pick a map";

const PREFIX = "#c=mc1.";
const ID_RE = /^gn-[0-9]+$/;
const KEYS = ["v", "e", "s", "ids", "seed"] as const;
const B64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export type ChallengeOk = {
  ok: true;
  v: 1;
  e: "globe";
  s: number;
  ids: string[];
  seed: number;
};

export type ChallengeFail = {
  ok: false;
  reason: "format" | "version" | "scoring" | "edition" | "tooBig";
};

/**
 * (This header describes the mc1 format. The mc2 all-editions format
 * lives further down this file — search "mc2" — behind the same `#c=`
 * catch-all, with its own strict decoder.)
 *
 * The seed: an FNV-1a hash (a tiny, well-known non-cryptographic hash)
 * of the ids joined with commas. Its job is INTEGRITY, not security —
 * it catches a link that was truncated, mistyped, or casually edited,
 * because any change to the ids changes the hash. It is NOT a
 * signature: anyone can recompute it, so it proves nothing about who
 * made the link. That is fine here — a forged link can only make the
 * receiver play a different set of real Globe places, nothing more —
 * but never reuse this seed as a trust check for anything that matters.
 */
/** FNV-1a over arbitrary text (the mc2 seal hashes a canonical string). */
function fnv1aText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fnv1a(ids: readonly string[]): number {
  return fnv1aText(ids.join(","));
}

function legalIds(ids: readonly string[]): boolean {
  if (ids.length < 5 || ids.length > 10) return false;
  const seen = new Set<string>();
  for (const id of ids) {
    if (!ID_RE.test(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function fail(reason: ChallengeFail["reason"]): ChallengeFail {
  return { ok: false, reason };
}

function toBase64Url(utf8: string): string {
  const bytes = new TextEncoder().encode(utf8);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(body: string): string | null {
  if (body.length === 0 || body.length % 4 === 1 || /[^A-Za-z0-9_-]/.test(body)) {
    return null;
  }
  const rem = body.length % 4;
  if (rem === 2 || rem === 3) {
    // Canonical-form check: when the final base64 character carries
    // unused trailing bits (the payload length is not a multiple of 3),
    // those bits must be zero in anything our encoder produced. A link
    // with them set was hand-edited after encoding — the decoded bytes
    // would be identical, so without this check two different links
    // could carry the same challenge and "the link was changed" would
    // be undetectable. Fail closed instead.
    const lastVal = B64URL_ALPHABET.indexOf(body[body.length - 1]!);
    const mask = rem === 2 ? 0x0f : 0x03;
    if (lastVal < 0 || (lastVal & mask) !== 0) return null;
  }
  const b64 =
    body.replace(/-/g, "+").replace(/_/g, "/") + (rem === 0 ? "" : "=".repeat(4 - rem));
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeChallenge(ids: readonly string[], scoringVersion: number): string {
  if (!legalIds(ids)) throw new TypeError("challenge ids");
  if (!Number.isSafeInteger(scoringVersion) || scoringVersion < 1) {
    throw new RangeError("invalid scoringVersion");
  }
  const seed = fnv1a(ids);
  const json = JSON.stringify({ v: 1, e: CHALLENGE_EDITION, s: scoringVersion, ids: [...ids], seed });
  return PREFIX + toBase64Url(json);
}

export function decodeChallenge(
  fragment: string,
  expectedScoringVersion: number,
): ChallengeOk | ChallengeFail {
  if (fragment.length > 2000) return fail("tooBig");
  if (!fragment.startsWith(PREFIX)) return fail("format");
  const body = fragment.slice(PREFIX.length);
  const decodedUtf8 = fromBase64Url(body);
  if (decodedUtf8 === null) return fail("format");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedUtf8);
  } catch {
    return fail("format");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return fail("format");
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== KEYS.length || KEYS.some((key) => !Object.hasOwn(obj, key))) return fail("format");
  const { v, e, s, ids, seed } = obj;
  if (typeof v !== "number" || typeof e !== "string" || typeof s !== "number" || typeof seed !== "number") {
    return fail("format");
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string") || !legalIds(ids as string[])) {
    return fail("format");
  }
  if (v !== 1) return fail("version");
  if (e !== CHALLENGE_EDITION) return fail("edition");
  if (s !== expectedScoringVersion) return fail("scoring");
  if (seed !== fnv1a(ids as string[])) return fail("format");
  return { ok: true, v: 1, e: "globe", s, ids: [...(ids as string[])], seed };
}

export function playOrder(decoded: ChallengeOk): string[] {
  return decoded.ids.slice();
}

/**
 * mulberry32: a small seeded random-number generator. Why not
 * Math.random()? Dealing a challenge from a seed must be REPEATABLE —
 * the same seed must deal the same places on the sender's phone, the
 * receiver's phone, and in tests — and Math.random() can never be
 * seeded. This generator is deterministic across browsers because it
 * uses only 32-bit integer math (Math.imul and bit ops), never floats
 * whose rounding could differ between engines.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dealChallenge(
  entries: readonly { id: string; w: number }[],
  count: number,
  seed: number,
): string[] {
  if (!Number.isSafeInteger(count) || count <= 0) return [];
  const next = mulberry32(seed);
  const ranked = entries.map((entry, index) => {
    const u = next();
    // Weighted sampling without replacement, in one pass (the
    // Efraimidis–Spirakis trick): each entry draws a random u in [0, 1)
    // and scores u^(1/w). Sorting by that score, best first, picks
    // higher-weighted entries more often, with no re-rolls and no
    // duplicates. A non-positive or non-finite weight can never be
    // dealt: its key is -Infinity, so it sorts last.
    const key =
      entry.w > 0 && Number.isFinite(entry.w) ? u ** (1 / entry.w) : Number.NEGATIVE_INFINITY;
    return { id: entry.id, key, index };
  });
  ranked.sort((a, b) => b.key - a.key || a.index - b.index);
  return ranked.slice(0, count).map((row) => row.id);
}

// ============================================================================
// mc2 — all-editions challenges (manifest 2026-10-28, Package A).
//
// mc1 above is FROZEN: it stays byte-identical because family chats are
// full of mc1 links that must decode forever. mc2 is the versioned
// successor that can name any edition and region and pin a radius:
//
//   #c=mc2.<base64url(canonical JSON)>
//   keys, exactly: { v, e, r, rad, s, ids, seed }
//     v    format version, 2
//     e    edition: "globe" | "country" | "state"
//     r    region slug inside that edition ("globe" for the globe)
//     rad  hit/miss radius in whole kilometres, pinned by the sender
//     s    scoring version the route was minted under
//     ids  5–10 place ids, in play order
//     seed FNV-1a over a canonical string covering v+e+r+rad+s+ids, so
//          swapping a place, a region, or the circle breaks the seal
//
// Layers, each fail-closed: the strict per-version decoders (this file),
// the radius binding (a pinned radius is honoured only near the radius
// THIS build computes for the named region — see decodeChallenge2), the
// pure receive seam (resolveChallengeRoute: decode, then membership in
// the named region's own catalog), and only then the app boot.
// ============================================================================

import { findRegion } from "./regions.ts";
import { regionRadiusKm } from "./radius.ts";
import { asFameTier, filterByTier, type PickerDifficulty } from "./tier-filter.ts";
import type { Edition } from "./run.ts";

export const CHALLENGE_MC2_PREFIX = "#c=mc2.";
const MC2_KEYS: readonly string[] = ["v", "e", "r", "rad", "s", "ids", "seed"];

/** Locked fairness line (manifest C10) — shown on the welcome card and
 * the creation preview so both kids know the deal before anyone plays. */
export const CHALLENGE_FAIRNESS_COPY = "Same places, same circle for everyone.";
/** Welcome-card title for an mc2 receive (Package A, decision D1). */
export const CHALLENGE_WELCOME_TITLE = "A challenge from a friend!";
/** Failure class 3 (manifest C12): the link was fine but a region chunk
 * failed to load, so membership could not be checked. */
export const CHALLENGE_LOAD_FAILURE_COPY = "Check your connection and tap the link again.";
/** Failure class 2, place arm (manifest C12): a named place is unknown
 * to this build (app older than the sender's, or an id from elsewhere). */
export const CHALLENGE_UNKNOWN_CONTENT_COPY =
  "This route visits a place this version of Meridian doesn't know yet.";
/** Failure class 2, region arm (manifest C12): the region itself is
 * unknown to this build. */
export const CHALLENGE_UNKNOWN_REGION_COPY =
  "This challenge is for a part of the world this version of Meridian doesn't have yet.";
/** Failure class 1, version arm (delta 2026-10-31 §3.6): the link is a
 * well-formed challenge link from a NEWER format this build does not
 * understand. The fix is not a resend — it is the newest Meridian — so
 * the remedy says exactly that. Fires only for an unknown-version
 * prefix, never for a broken link in a known format. */
export const CHALLENGE_VERSION_COPY = "This challenge needs the newest Meridian.";

/** Every way an mc2 (or dispatched) link can fail, in gate order. */
export type ChallengeFailReason =
  | "format"
  | "version"
  | "scoring"
  | "edition"
  | "region"
  | "radius"
  | "tooBig";

export interface DecodedChallenge2 {
  ok: true;
  v: 2;
  e: Edition;
  r: string;
  rad: number;
  s: number;
  ids: string[];
  seed: number;
}

export type ChallengeDecode2 = DecodedChallenge2 | { ok: false; reason: ChallengeFailReason };

/** The canonical string the mc2 seed seals. Version-tagged so a future
 * format can never collide with this one's seals. */
function mc2Canonical(e: string, r: string, rad: number, s: number, ids: readonly string[]): string {
  return `mc2|2|${e}|${r}|${rad}|${s}|${ids.join(",")}`;
}

function mc2Seed(e: string, r: string, rad: number, s: number, ids: readonly string[]): number {
  return fnv1aText(mc2Canonical(e, r, rad, s, ids));
}

function isEdition(value: string): value is Edition {
  return value === "globe" || value === "country" || value === "state";
}

/** The (edition, region) pair must name a region this build knows. */
function legalRegionPair(e: Edition, r: string): boolean {
  return findRegion(e, r) !== null;
}

/** Coarse radius sanity per edition; mirrors the RADIUS_LIMITS clamps in
 * radius.ts. The binding check in decodeChallenge2 is the precise one. */
const MC2_RADIUS_ENVELOPE: Record<Exclude<Edition, "globe">, { minKm: number; maxKm: number }> = {
  state: { minKm: 25, maxKm: 160 },
  country: { minKm: 40, maxKm: 450 },
};

/** A pinned radius is honoured within this share of the computed one. */
const MC2_RADIUS_TOLERANCE = 0.1;

interface Mc2Payload {
  v: number;
  e: string;
  r: string;
  rad: number;
  s: number;
  ids: string[];
  seed: number;
}

function parseMc2Payload(fragment: string): Mc2Payload | { reason: ChallengeFailReason } {
  const decodedUtf8 = fromBase64Url(fragment.slice(CHALLENGE_MC2_PREFIX.length));
  if (decodedUtf8 === null) return { reason: "format" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedUtf8);
  } catch {
    return { reason: "format" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { reason: "format" };
  }
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== MC2_KEYS.length || MC2_KEYS.some((key) => !Object.hasOwn(obj, key))) {
    return { reason: "format" };
  }
  const { v, e, r, rad, s, ids, seed } = obj;
  if (
    typeof v !== "number" ||
    typeof e !== "string" ||
    typeof r !== "string" ||
    typeof rad !== "number" ||
    !Number.isFinite(rad) ||
    typeof s !== "number" ||
    typeof seed !== "number"
  ) {
    return { reason: "format" };
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string") || !legalIds(ids as string[])) {
    return { reason: "format" };
  }
  return { v, e, r, rad, s, ids: [...(ids as string[])], seed };
}

/**
 * Mint an mc2 challenge fragment. Throws on illegal input (mirroring
 * encodeChallenge's discipline): TypeError for bad ids, an unknown
 * (edition, region) pair, or a radius the format cannot pin; RangeError
 * for a non-positive-integer scoring version.
 */
export function encodeChallenge2(
  input: { edition: Edition; regionId: string; radiusKm: number; ids: readonly string[] },
  scoringVersion: number,
): string {
  if (!Number.isInteger(scoringVersion) || scoringVersion <= 0) {
    throw new RangeError("encodeChallenge2: scoringVersion must be a positive integer");
  }
  if (!legalRegionPair(input.edition, input.regionId)) {
    throw new TypeError(
      `encodeChallenge2: unknown region ${input.edition}/${input.regionId}`,
    );
  }
  if (!Number.isInteger(input.radiusKm) || input.radiusKm <= 0) {
    throw new TypeError("encodeChallenge2: radiusKm must be a positive whole number of kilometres");
  }
  if (input.edition === "globe" && input.radiusKm !== CHALLENGE_GLOBE_RADIUS_KM) {
    throw new TypeError("encodeChallenge2: the globe radius is always 750 km");
  }
  if (input.edition !== "globe") {
    const envelope = MC2_RADIUS_ENVELOPE[input.edition];
    if (input.radiusKm < envelope.minKm || input.radiusKm > envelope.maxKm) {
      throw new TypeError("encodeChallenge2: radiusKm is outside the edition envelope");
    }
  }
  if (!legalIds(input.ids)) {
    throw new TypeError("encodeChallenge2: ids must be 5-10 unique gn-<number> ids");
  }
  const payload = {
    v: 2,
    e: input.edition,
    r: input.regionId,
    rad: input.radiusKm,
    s: scoringVersion,
    ids: [...input.ids],
    seed: mc2Seed(input.edition, input.regionId, input.radiusKm, scoringVersion, input.ids),
  };
  return CHALLENGE_MC2_PREFIX + toBase64Url(JSON.stringify(payload));
}

/**
 * Strictly decode an mc2 fragment. Gate order: length → prefix → shape
 * → version → edition → region → scoring → radius → seed. The radius
 * gate binds the pinned radius to the one THIS build computes for the
 * named region: exact for the globe, within ±10% otherwise, and always
 * inside the edition envelope. That binding is what makes a received
 * route a fair contest — the sender's circle is a claim, and the
 * receiver's own map data is the referee.
 */
export function decodeChallenge2(
  fragment: unknown,
  expectedScoringVersion: number,
): ChallengeDecode2 {
  if (typeof fragment === "string" && fragment.length > 2000) {
    return { ok: false, reason: "tooBig" };
  }
  if (typeof fragment !== "string" || !fragment.startsWith(CHALLENGE_MC2_PREFIX)) {
    return { ok: false, reason: "format" };
  }
  const payload = parseMc2Payload(fragment);
  if ("reason" in payload) return { ok: false, reason: payload.reason };
  if (payload.v !== 2) return { ok: false, reason: "version" };
  if (!isEdition(payload.e)) return { ok: false, reason: "edition" };
  const edition = payload.e;
  if (!legalRegionPair(edition, payload.r)) return { ok: false, reason: "region" };
  if (payload.s !== expectedScoringVersion) return { ok: false, reason: "scoring" };
  const computed = regionRadiusKm(edition, payload.r);
  if (computed === null || !Number.isInteger(payload.rad)) {
    return { ok: false, reason: "radius" };
  }
  if (edition === "globe") {
    if (payload.rad !== CHALLENGE_GLOBE_RADIUS_KM) return { ok: false, reason: "radius" };
  } else {
    const envelope = MC2_RADIUS_ENVELOPE[edition];
    if (payload.rad < envelope.minKm || payload.rad > envelope.maxKm) {
      return { ok: false, reason: "radius" };
    }
    if (Math.abs(payload.rad - computed) > computed * MC2_RADIUS_TOLERANCE) {
      return { ok: false, reason: "radius" };
    }
  }
  if (payload.seed !== mc2Seed(edition, payload.r, payload.rad, payload.s, payload.ids)) {
    return { ok: false, reason: "format" };
  }
  return {
    ok: true,
    v: 2,
    e: edition,
    r: payload.r,
    rad: payload.rad,
    s: payload.s,
    ids: [...payload.ids],
    seed: payload.seed,
  };
}

/** A decoded link, normalized so the app never branches on wire format. */
export interface ChallengeRoute {
  edition: Edition;
  regionId: string;
  regionName: string;
  radiusKm: number;
  ids: string[];
  originFormat: "mc1" | "mc2" | "mc3";
  /** mc3 only, present iff the link carries a winner block (delta
   * 2026-10-31 §2.1): the sender-attested mark the next player plays
   * against. Package A decodes and exposes it; Package B's surfaces
   * (welcome goal, verdict, pass-along) are its consumers. */
  winner?: ChallengeWinner;
}

export type ChallengeLinkResult =
  | { ok: true; route: ChallengeRoute }
  | { ok: false; reason: ChallengeFailReason };

/**
 * The version dispatcher behind the shipped `#c=` catch-all: mc3 and
 * mc2 fragments go to their strict decoders; everything else goes to
 * the frozen mc1 decoder, whose failure reasons are a subset of
 * ChallengeFailReason. A fragment whose prefix names a version this
 * build does not know at all (`#c=mc<digits>.` with a number other
 * than 1, 2, or 3) fails as "version" — the signal the boot turns
 * into the newest-Meridian remedy (delta §3.6). That signal is
 * prefix-level only: an mc2 payload whose inner `v` is not 2 still
 * fails through the mc2 decoder's own version gate, exactly as
 * before, and a malformed mc3 keeps the ordinary broken-link path.
 */
export function decodeChallengeLink(
  fragment: unknown,
  expectedScoringVersion: number,
): ChallengeLinkResult {
  if (typeof fragment !== "string") return { ok: false, reason: "format" };
  if (fragment.startsWith(CHALLENGE_MC3_PREFIX)) {
    const decoded = decodeChallenge3(fragment, expectedScoringVersion);
    if (!decoded.ok) return decoded;
    const region = findRegion(decoded.e, decoded.r);
    if (!region) return { ok: false, reason: "region" };
    return {
      ok: true,
      route: {
        edition: decoded.e,
        regionId: decoded.r,
        regionName: region.name,
        radiusKm: decoded.rad,
        ids: [...decoded.ids],
        originFormat: "mc3",
        ...(decoded.winner ? { winner: decoded.winner } : {}),
      },
    };
  }
  if (fragment.startsWith(CHALLENGE_MC2_PREFIX)) {
    const decoded = decodeChallenge2(fragment, expectedScoringVersion);
    if (!decoded.ok) return decoded;
    const region = findRegion(decoded.e, decoded.r);
    if (!region) return { ok: false, reason: "region" };
    return {
      ok: true,
      route: {
        edition: decoded.e,
        regionId: decoded.r,
        regionName: region.name,
        radiusKm: decoded.rad,
        ids: [...decoded.ids],
        originFormat: "mc2",
      },
    };
  }
  const unknownVersion = /^#c=mc(\d+)\./.exec(fragment);
  if (unknownVersion && ![1, 2, 3].includes(Number(unknownVersion[1]))) {
    return { ok: false, reason: "version" };
  }
  const decoded = decodeChallenge(fragment, expectedScoringVersion);
  if (!decoded.ok) return { ok: false, reason: decoded.reason };
  return {
    ok: true,
    route: {
      edition: "globe",
      regionId: "globe",
      regionName: "Globe",
      radiusKm: CHALLENGE_GLOBE_RADIUS_KM,
      ids: [...decoded.ids],
      originFormat: "mc1",
    },
  };
}

/**
 * The pure receive seam (manifest §2, contract 3): decode the link, then
 * check that EVERY id is a member of the named region's own catalog.
 * Global existence is not membership — an id from another region's pool
 * fails here with "region". The caller loads the catalog for exactly
 * (edition, regionId) and passes it in; this function does no I/O, so
 * the whole chain is unit-testable without booting the app.
 */
export function resolveChallengeRoute(
  fragment: unknown,
  expectedScoringVersion: number,
  catalogIds: ReadonlySet<string> | readonly string[],
): ChallengeLinkResult {
  const link = decodeChallengeLink(fragment, expectedScoringVersion);
  if (!link.ok) return link;
  const catalog = catalogIds instanceof Set ? catalogIds : new Set(catalogIds);
  if (!link.route.ids.every((id) => catalog.has(id))) {
    return { ok: false, reason: "region" };
  }
  return link;
}

/**
 * The run fields a received route starts with. The sentinel regionId
 * stays the isolation key (isChallengeRun), the edition is the route's
 * OWN edition (so the map keeps its projection and territory), and the
 * display name says whose route it is. An mc1 route derives exactly the
 * fields the shipped mc1 boot used — that path stays byte-identical.
 */
export function challengeRunFields(route: ChallengeRoute): {
  edition: Edition;
  regionId: typeof CHALLENGE_REGION_ID;
  regionName: string;
  challengeRegionId: string;
  challengeRadiusKm: number;
  challengeOrigin: "mc1" | "mc2" | "mc3";
} {
  if (route.originFormat === "mc1") {
    return {
      edition: "globe",
      regionId: CHALLENGE_REGION_ID,
      regionName: CHALLENGE_REGION_NAME,
      challengeRegionId: "globe",
      challengeRadiusKm: CHALLENGE_GLOBE_RADIUS_KM,
      challengeOrigin: "mc1",
    };
  }
  // mc2 and mc3 routes map identically (delta §2: real edition and
  // region, the link's judged radius); only the origin tag differs,
  // so a completion re-share can forward-upgrade an mc2 route to mc3
  // while an mc3 route stays mc3.
  return {
    edition: route.edition,
    regionId: CHALLENGE_REGION_ID,
    regionName: `${route.regionName} challenge`,
    challengeRegionId: route.regionId,
    challengeRadiusKm: route.radiusKm,
    challengeOrigin: route.originFormat,
  };
}

/**
 * The ONE radius accessor both pin-judgement sites read for a challenge
 * run (manifest §3): the radius snapshotted on the run at receive time,
 * defaulting to the globe radius for legacy mc1 saves that predate the
 * field. Judging never recomputes from bounds at play time.
 */
export function challengeRadiusOf(run: { challengeRadiusKm?: number }): number {
  return run.challengeRadiusKm ?? CHALLENGE_GLOBE_RADIUS_KM;
}

// --- Creation: ONE pure helper behind the picker and summary offers ---

export interface ChallengeCreation {
  fragment: string;
  placeCount: number;
  regionName: string;
  radiusKm: number;
  dealtIds: string[];
}

export interface ChallengeCreationEntry {
  id: string;
  difficulty?: unknown;
}

/**
 * The widening chain for fresh creation (manifest §4/C1), widest step
 * last, every step inside the ONE named region's catalog:
 *   the run's own pool (summary "new route" only) → the picker's band
 *   minus places the sender has seen → the band → the full catalog.
 * It never leaves the region: fail-closed dealing is the game's core
 * promise, and a challenge must not break it.
 */
export function buildCreationSources(input: {
  catalog: readonly ChallengeCreationEntry[];
  choice: PickerDifficulty;
  seenIds?: ReadonlySet<string>;
  runPoolIds?: readonly string[] | null;
}): ChallengeCreationEntry[][] {
  const band = filterByTier([...input.catalog], input.choice);
  const chain: ChallengeCreationEntry[][] = [];
  if (input.runPoolIds && input.runPoolIds.length > 0) {
    const byId = new Map(input.catalog.map((place) => [place.id, place]));
    const runEntries: ChallengeCreationEntry[] = [];
    for (const id of input.runPoolIds) {
      const entry = byId.get(id);
      if (entry) runEntries.push(entry);
    }
    if (runEntries.length > 0) chain.push(runEntries);
  }
  const seen = input.seenIds;
  chain.push(seen ? band.filter((place) => !seen.has(place.id)) : band);
  chain.push(band);
  chain.push([...input.catalog]);
  return chain;
}

/**
 * Create a challenge for one surface, or null when no legal route
 * exists (unknown region, or every widening source thinner than the
 * minimum). Two modes:
 *   "exact" — the sender's played places, verbatim play order, first
 *     ten. A globe exact route encodes as mc1 (byte-identical shares
 *     for the shipped surface); any other edition encodes as mc3.
 *   "fresh" — deal `count` (default 5) from the first widening source
 *     that can fill it, presented fame-tier ascending so a friend meets
 *     the famous places first. Fresh routes always encode as mc3 —
 *     except that nothing here ever re-encodes an mc1 route.
 * Since the mc3 delta (2026-10-31) mc2 is decode-only: this helper
 * never emits it. An mc2-origin re-share forward-upgrades to mc3
 * (delta §3.3) — a re-share must never LOSE information, and mc3
 * carries everything mc2 did.
 * The radius is THIS build's computed radius for the region, pinned
 * into the link.
 */
export function createChallengeRoute(input: {
  edition: Edition;
  regionId: string;
  scoringVersion: number;
  mode: "fresh" | "exact";
  sources?: readonly (readonly ChallengeCreationEntry[])[];
  exactIds?: readonly string[];
  count?: number;
  dealSeed?: number;
  /**
   * Completion re-share ONLY (manifest §2.3 + §6, as amended by the
   * mc3 delta §3.3): the ORIGIN format of the route being re-encoded.
   * A received mc1 route re-shares as mc1. A received mc2 route
   * forward-upgrades to mc3 — in every edition, Globe included — and
   * a received mc3 route stays mc3. Sender-side creations (summary,
   * picker) omit it: there the format follows the edition (globe
   * exact = the shipped mc1 surface).
   */
  originFormat?: "mc1" | "mc2" | "mc3";
  /**
   * Exact mc3 emission ONLY: the winner block to seal into the link
   * (delta §2.1). Package A mints none (winner minting is Package B);
   * the field exists so the codec's one creation path can carry it.
   * Ignored when the route encodes as mc1, which has no winner block.
   */
  winner?: ChallengeWinner;
  /**
   * Completion re-share ONLY: the radius the run was actually judged
   * at (its snapshotted challengeRadiusKm). A link may pin an
   * in-tolerance off-golden radius (rad 90 vs golden 87); the re-share
   * must preserve THAT circle — "the sharpest freeze test" (§6) —
   * never silently re-pin the computed one.
   */
  radiusKmOverride?: number;
}): ChallengeCreation | null {
  const region = findRegion(input.edition, input.regionId);
  const radius = regionRadiusKm(input.edition, input.regionId);
  if (!region || radius === null) return null;
  if (input.mode === "exact") {
    const ids = (input.exactIds ?? []).slice(0, CHALLENGE_MAX_PLACES);
    if (!legalIds(ids)) return null;
    const effectiveRadius = input.radiusKmOverride ?? radius;
    // Format: an explicit origin (a re-share) wins over the edition
    // default. Without one, an EXACT globe route encodes mc1 (the
    // frozen format — a played globe route shares as the link it
    // always was) and any other edition encodes mc3. An explicit mc2
    // or mc3 origin also encodes mc3 (the delta's forward-upgrade —
    // never a downgrade to mc1, and mc2 is never emitted again).
    const useMc1 =
      input.originFormat === "mc1" ||
      (input.originFormat === undefined && input.edition === "globe");
    const fragment = useMc1
      ? encodeChallenge(ids, input.scoringVersion)
      : encodeChallenge3(
          {
            edition: input.edition,
            regionId: input.regionId,
            radiusKm: effectiveRadius,
            ids,
            winner: input.winner,
          },
          input.scoringVersion,
        );
    return { fragment, placeCount: ids.length, regionName: region.name, radiusKm: effectiveRadius, dealtIds: [...ids] };
  }
  const count = input.count ?? CHALLENGE_MIN_PLACES;
  if (!Number.isInteger(count) || count < CHALLENGE_MIN_PLACES || count > CHALLENGE_MAX_PLACES) {
    return null;
  }
  for (const source of input.sources ?? []) {
    const unique = new Map<string, ChallengeCreationEntry>();
    for (const entry of source) {
      if (ID_RE.test(entry.id) && !unique.has(entry.id)) unique.set(entry.id, entry);
    }
    if (unique.size < count) continue;
    const entries = [...unique.values()];
    const dealt = dealChallenge(
      entries.map((entry) => ({ id: entry.id, w: 1 })),
      count,
      input.dealSeed ?? 0,
    );
    const tierOf = new Map(entries.map((entry) => [entry.id, asFameTier(entry.difficulty)]));
    const ordered = dealt
      .map((id, index) => ({ id, index }))
      .sort((a, b) => (tierOf.get(a.id) ?? 3) - (tierOf.get(b.id) ?? 3) || a.index - b.index)
      .map((entry) => entry.id);
    const fragment = encodeChallenge3(
      { edition: input.edition, regionId: input.regionId, radiusKm: radius, ids: ordered },
      input.scoringVersion,
    );
    return { fragment, placeCount: ordered.length, regionName: region.name, radiusKm: radius, dealtIds: ordered };
  }
  return null;
}

/** Failure class 1 detail (manifest C12): the link itself is broken —
 * mistyped, truncated, tampered with, or minted under another scoring
 * version. The fix is a fresh link from the friend, so say exactly that. */
export const CHALLENGE_BROKEN_LINK_COPY = "Ask your friend to send the link again.";

// ============================================================================
// mc3 — compact binary challenges (delta manifest 2026-10-31, Package A).
//
// mc1 and mc2 above are FROZEN as decoders: links already sitting in
// family chats must decode forever, but neither format is emitted any
// more (mc1 survives only as the sender-side exact-Globe share, the
// shipped surface the delta expressly keeps). mc3 packs the same route
// into raw bytes instead of JSON — the owner's 274-char Nebraska mc2
// payload becomes 52 chars — and adds room for the winner block the
// winner-declaration design (Package B) rides on:
//
//   #c=mc3.<base64url(canonical, unpadded) of the packed body>
//   B0    flags: bits 7–6 edition (0 globe, 1 country, 2 state),
//         bit 5 = W (a winner block follows the ids), bits 4–0
//         reserved, must be 0
//   B1    scoring version `s`, a full byte
//   rad   hit/miss radius, canonical LEB128 varint, at most 2 bytes
//   region  one byte: an index into the per-edition FROZEN table below
//   count   5–10
//   ids   count × uint24 big-endian GeoNames numbers
//   winner (iff W): hit-mask uint16 BE, then sender / best scores as
//         varints (≤3 bytes each), then attempts (≤2 bytes, 1–255)
//   seal  FNV-1a-32 over ALL preceding bytes, uint32 big-endian
//
// The fragment is capped at 127 chars total. Decoding fails closed in
// the manifest's gate order (§2.5): the seal is checked over raw bytes
// before any field is trusted, and the body must end exactly where the
// layout says — a winner block can never be silently truncated into
// an open route, nor an open route grow a partial block.
// ============================================================================

import { PLACE_SCORE_CAP, REGION_BONUS } from "./scoring.ts";

export const CHALLENGE_MC3_PREFIX = "#c=mc3.";
const MC3_FRAGMENT_MAX_CHARS = 127;
/** 1 (B0) + 1 (s) + 1 (rad) + 1 (region) + 1 (count) + 15 (5 ids) + 4 (seal). */
const MC3_MIN_BODY_BYTES = 24;

/**
 * The frozen region-index tables (delta §2.2). The index in an mc3
 * link is read against THESE lists, in this order — an index is a
 * promise made to every link already shared, so an entry is never
 * reassigned, removed, or reordered: new regions APPEND. The lists
 * mirror regions.ts today on purpose, and a guard test
 * (challenge-mc3.test.ts) rebuilds the expected lists from regions.ts
 * live data plus a no-shrink snapshot, so plugging a new region in
 * turns the test red until the new index is appended here too.
 * Decode still resolves index → slug → findRegion, so a slug this
 * build does not know fails `region` like any other unknown region.
 */
export const MC3_COUNTRY_REGION_IDS: readonly string[] = [
  "united-states",
  "canada",
  "mexico",
  "brazil",
  "united-kingdom",
  "france",
  "germany",
  "italy",
  "egypt",
  "india",
  "china",
  "japan",
  "australia",
];

export const MC3_STATE_REGION_IDS: readonly string[] = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new-hampshire",
  "new-jersey",
  "new-mexico",
  "new-york",
  "north-carolina",
  "north-dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode-island",
  "south-carolina",
  "south-dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west-virginia",
  "wisconsin",
  "wyoming",
];

/** The winner block (delta §2.1): a sender-attested mark. `mask` is
 * the sender's hit pattern over the route in play order — bit (15−i)
 * set ⟺ the mark-setter landed inside the circle on place i. */
export interface ChallengeWinner {
  mask: number;
  sender: number;
  best: number;
  attempts: number;
}

export interface DecodedChallenge3 {
  ok: true;
  v: 3;
  e: Edition;
  r: string;
  rad: number;
  s: number;
  ids: string[];
  winner: ChallengeWinner | undefined;
}

export type ChallengeDecode3 = DecodedChallenge3 | { ok: false; reason: ChallengeFailReason };

function fail3(reason: ChallengeFailReason): { ok: false; reason: ChallengeFailReason } {
  return { ok: false, reason };
}

/**
 * FNV-1a over raw BYTES — the byte-wise sibling of fnv1aText. The text
 * version hashes charCodes (the mc1/mc2 seals cover strings); an mc3
 * body is bytes that are not text at all, so it needs its own walk.
 * The existing helpers are untouched: their seals must not change.
 */
function fnv1aBytes(bytes: Uint8Array): number {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Canonical base64url of raw bytes (the toBase64Url discipline,
 * applied to a byte array instead of a UTF-8 string). */
function toBase64UrlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Canonical base64url decode to raw bytes. This mirrors fromBase64Url
 * check for check — same alphabet, same length rule, same
 * trailing-bits-must-be-zero rule — but returns the bytes themselves:
 * fromBase64Url decodes through a UTF-8 TextDecoder, and a packed
 * binary body is not required to be valid UTF-8, so reusing it
 * literally would reject (or mangle) legal mc3 bodies.
 */
function fromBase64UrlBytes(body: string): Uint8Array | null {
  if (body.length === 0 || body.length % 4 === 1 || /[^A-Za-z0-9_-]/.test(body)) {
    return null;
  }
  const rem = body.length % 4;
  if (rem === 2 || rem === 3) {
    const lastVal = B64URL_ALPHABET.indexOf(body[body.length - 1]!);
    const mask = rem === 2 ? 0x0f : 0x03;
    if (lastVal < 0 || (lastVal & mask) !== 0) return null;
  }
  const b64 =
    body.replace(/-/g, "+").replace(/_/g, "/") + (rem === 0 ? "" : "=".repeat(4 - rem));
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/** Canonical LEB128 encoding (shortest form by construction). */
function encodeVarint(value: number): number[] {
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

/**
 * Read one canonical LEB128 varint from `bytes` starting at `offset`,
 * never reading at or past `limit` (the seal's first byte) and never
 * consuming more than `maxBytes`. Returns null — a `format` failure —
 * for an unterminated varint (the walk hits the limit or the cap with
 * the continuation bit still set) or a non-canonical one (an overlong
 * encoding: the same value in more bytes than its shortest form,
 * which includes any non-final 0x80 group).
 */
function readVarint(
  bytes: Uint8Array,
  offset: number,
  maxBytes: number,
  limit: number,
): { value: number; nextOffset: number } | null {
  let value = 0;
  let shift = 0;
  let consumed = 0;
  for (;;) {
    if (consumed >= maxBytes || offset + consumed >= limit) return null;
    const byte = bytes[offset + consumed]!;
    consumed++;
    value += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
  }
  if (encodeVarint(value).length !== consumed) return null;
  return { value, nextOffset: offset + consumed };
}

function popcount16(value: number): number {
  let count = 0;
  let v = value;
  while (v !== 0) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
}

/** The mc3 region index for one (edition, region), or null when the
 * frozen table does not name it — the encoder's side of the table. */
function mc3RegionIndex(edition: Edition, regionId: string): number | null {
  if (edition === "globe") return regionId === "globe" ? 0 : null;
  const table = edition === "country" ? MC3_COUNTRY_REGION_IDS : MC3_STATE_REGION_IDS;
  const index = table.indexOf(regionId);
  return index >= 0 ? index : null;
}

/** The per-place score ceiling the winner gates derive from (delta
 * §2.4): the distance×difficulty×combo cap plus the region bonus,
 * both imported from scoring.ts — never a literal, so a scoring
 * change re-derives the bound (and the tripwire test notices). */
const MC3_PER_PLACE_MAX = PLACE_SCORE_CAP + REGION_BONUS;

function mc3WinnerLegal(winner: ChallengeWinner, placeCount: number): boolean {
  if (!Number.isInteger(winner.mask) || winner.mask < 0 || winner.mask > 0xffff) return false;
  // Bits at or beyond the route's stops are not the sender's to claim.
  if ((winner.mask & ((1 << (16 - placeCount)) - 1)) !== 0) return false;
  if (!Number.isInteger(winner.sender) || winner.sender < 0) return false;
  if (!Number.isInteger(winner.best) || winner.best < 0) return false;
  if (!Number.isInteger(winner.attempts) || winner.attempts < 1) return false;
  if (winner.best < winner.sender) return false;
  const routeMax = placeCount * MC3_PER_PLACE_MAX;
  if (winner.sender > routeMax || winner.best > routeMax) return false;
  if (winner.sender > popcount16(winner.mask) * MC3_PER_PLACE_MAX) return false;
  return true;
}

/**
 * Mint an mc3 challenge fragment. Throws on illegal input (mirroring
 * encodeChallenge2's discipline): TypeError for bad ids, an unknown
 * (edition, region) pair, an unpinnable radius, or an implausible
 * winner block; RangeError for a scoring version a byte cannot carry.
 * Attempts above 255 saturate at 255 (delta §2.4): the count is a
 * plain fact about persistence, and the wire byte is its ceiling.
 */
export function encodeChallenge3(
  input: {
    edition: Edition;
    regionId: string;
    radiusKm: number;
    ids: readonly string[];
    winner?: ChallengeWinner;
  },
  scoringVersion: number,
): string {
  if (!Number.isInteger(scoringVersion) || scoringVersion < 1 || scoringVersion > 255) {
    throw new RangeError("encodeChallenge3: scoringVersion must be an integer in 1..255");
  }
  const regionIndex = mc3RegionIndex(input.edition, input.regionId);
  if (regionIndex === null || !legalRegionPair(input.edition, input.regionId)) {
    throw new TypeError(
      `encodeChallenge3: unknown region ${input.edition}/${input.regionId}`,
    );
  }
  if (!Number.isInteger(input.radiusKm) || input.radiusKm <= 0) {
    throw new TypeError("encodeChallenge3: radiusKm must be a positive whole number of kilometres");
  }
  if (input.edition === "globe" && input.radiusKm !== CHALLENGE_GLOBE_RADIUS_KM) {
    throw new TypeError("encodeChallenge3: the globe radius is always 750 km");
  }
  if (input.edition !== "globe") {
    const envelope = MC2_RADIUS_ENVELOPE[input.edition];
    if (input.radiusKm < envelope.minKm || input.radiusKm > envelope.maxKm) {
      throw new TypeError("encodeChallenge3: radiusKm is outside the edition envelope");
    }
  }
  if (!legalIds(input.ids)) {
    throw new TypeError("encodeChallenge3: ids must be 5-10 unique gn-<number> ids");
  }
  const nums = input.ids.map((id) => Number(id.slice("gn-".length)));
  for (let i = 0; i < nums.length; i++) {
    // A uint24 carries exactly the canonical "gn-<number>" spelling:
    // 0 is not a place, a leading zero would re-spell the id on
    // decode, and anything past 0xffffff does not fit the field.
    if (!Number.isInteger(nums[i]) || nums[i]! < 1 || nums[i]! > 0xffffff || `gn-${nums[i]}` !== input.ids[i]) {
      throw new TypeError("encodeChallenge3: ids must be canonical gn-<number> ids in 1..16777215");
    }
  }
  let winner: ChallengeWinner | undefined;
  if (input.winner) {
    if (!mc3WinnerLegal(input.winner, input.ids.length)) {
      throw new TypeError("encodeChallenge3: winner block is implausible for this route");
    }
    winner = { ...input.winner, attempts: Math.min(input.winner.attempts, 255) };
  }
  const editionCode = input.edition === "globe" ? 0 : input.edition === "country" ? 1 : 2;
  const body: number[] = [(editionCode << 6) | (winner ? 0x20 : 0), scoringVersion];
  body.push(...encodeVarint(input.radiusKm));
  body.push(regionIndex, input.ids.length);
  for (const num of nums) {
    body.push((num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff);
  }
  if (winner) {
    body.push((winner.mask >> 8) & 0xff, winner.mask & 0xff);
    body.push(...encodeVarint(winner.sender));
    body.push(...encodeVarint(winner.best));
    body.push(...encodeVarint(winner.attempts));
  }
  const seal = fnv1aBytes(Uint8Array.from(body));
  const bytes = Uint8Array.from([
    ...body,
    (seal >> 24) & 0xff,
    (seal >> 16) & 0xff,
    (seal >> 8) & 0xff,
    seal & 0xff,
  ]);
  return CHALLENGE_MC3_PREFIX + toBase64UrlBytes(bytes);
}

/**
 * Strictly decode an mc3 fragment, in the manifest's gate order
 * (§2.5): length → prefix → canonical base64 → minimum length → SEAL
 * → B0 (reserved bits, edition) → scoring byte → varint walk → region
 * → radius binding (the same envelopes and ±10% rule as mc2) → ids →
 * winner plausibility → exact end of body. The seal gates before
 * semantics because it needs no parsing — a tampered link dies there
 * whichever field was touched.
 */
export function decodeChallenge3(
  fragment: unknown,
  expectedScoringVersion: number,
): ChallengeDecode3 {
  if (typeof fragment === "string" && fragment.length > MC3_FRAGMENT_MAX_CHARS) {
    return fail3("tooBig");
  }
  if (typeof fragment !== "string" || !fragment.startsWith(CHALLENGE_MC3_PREFIX)) {
    return fail3("format");
  }
  const bytes = fromBase64UrlBytes(fragment.slice(CHALLENGE_MC3_PREFIX.length));
  if (bytes === null) return fail3("format");
  if (bytes.length < MC3_MIN_BODY_BYTES) return fail3("format");
  const sealOffset = bytes.length - 4;
  const storedSeal =
    ((bytes[sealOffset]! << 24) |
      (bytes[sealOffset + 1]! << 16) |
      (bytes[sealOffset + 2]! << 8) |
      bytes[sealOffset + 3]!) >>>
    0;
  if (fnv1aBytes(bytes.subarray(0, sealOffset)) !== storedSeal) return fail3("format");
  const b0 = bytes[0]!;
  if ((b0 & 0x1f) !== 0) return fail3("version");
  const editionCode = b0 >> 6;
  if (editionCode === 3) return fail3("edition");
  const edition: Edition = editionCode === 0 ? "globe" : editionCode === 1 ? "country" : "state";
  const hasWinner = (b0 & 0x20) !== 0;
  const s = bytes[1]!;
  if (s !== expectedScoringVersion) return fail3("scoring");
  let offset = 2;
  const radRead = readVarint(bytes, offset, 2, sealOffset);
  if (!radRead) return fail3("format");
  const rad = radRead.value;
  offset = radRead.nextOffset;
  if (offset >= sealOffset) return fail3("format");
  const regionIndex = bytes[offset]!;
  offset++;
  const regionId =
    edition === "globe"
      ? regionIndex === 0
        ? "globe"
        : null
      : edition === "country"
        ? (MC3_COUNTRY_REGION_IDS[regionIndex] ?? null)
        : (MC3_STATE_REGION_IDS[regionIndex] ?? null);
  if (regionId === null) return fail3("region");
  if (!findRegion(edition, regionId)) return fail3("region");
  const computed = regionRadiusKm(edition, regionId);
  if (computed === null) return fail3("radius");
  if (edition === "globe") {
    if (rad !== CHALLENGE_GLOBE_RADIUS_KM) return fail3("radius");
  } else {
    const envelope = MC2_RADIUS_ENVELOPE[edition];
    if (rad < envelope.minKm || rad > envelope.maxKm) return fail3("radius");
    if (Math.abs(rad - computed) > computed * MC2_RADIUS_TOLERANCE) return fail3("radius");
  }
  if (offset >= sealOffset) return fail3("format");
  const count = bytes[offset]!;
  offset++;
  if (count < CHALLENGE_MIN_PLACES || count > CHALLENGE_MAX_PLACES) return fail3("format");
  if (offset + count * 3 > sealOffset) return fail3("format");
  const ids: string[] = [];
  const seenNums = new Set<number>();
  for (let i = 0; i < count; i++) {
    const num =
      (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
    offset += 3;
    if (num === 0 || seenNums.has(num)) return fail3("format");
    seenNums.add(num);
    ids.push(`gn-${num}`);
  }
  let winner: ChallengeWinner | undefined;
  if (hasWinner) {
    if (offset + 2 > sealOffset) return fail3("format");
    const mask = (bytes[offset]! << 8) | bytes[offset + 1]!;
    offset += 2;
    const senderRead = readVarint(bytes, offset, 3, sealOffset);
    if (!senderRead) return fail3("format");
    offset = senderRead.nextOffset;
    const bestRead = readVarint(bytes, offset, 3, sealOffset);
    if (!bestRead) return fail3("format");
    offset = bestRead.nextOffset;
    const attemptsRead = readVarint(bytes, offset, 2, sealOffset);
    if (!attemptsRead) return fail3("format");
    offset = attemptsRead.nextOffset;
    const candidate: ChallengeWinner = {
      mask,
      sender: senderRead.value,
      best: bestRead.value,
      attempts: attemptsRead.value,
    };
    if (candidate.attempts > 255 || !mc3WinnerLegal(candidate, count)) {
      return fail3("format");
    }
    winner = candidate;
  }
  if (offset !== sealOffset) return fail3("format");
  return { ok: true, v: 3, e: edition, r: regionId, rad, s, ids, winner };
}
