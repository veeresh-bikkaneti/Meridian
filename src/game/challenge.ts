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
  originFormat: "mc1" | "mc2";
}

export type ChallengeLinkResult =
  | { ok: true; route: ChallengeRoute }
  | { ok: false; reason: ChallengeFailReason };

/**
 * The version dispatcher behind the shipped `#c=` catch-all: mc2
 * fragments go to the strict mc2 decoder; everything else goes to the
 * frozen mc1 decoder, whose failure reasons are a subset of
 * ChallengeFailReason. Unknown future versions fail closed as "format"
 * (the mc1 decoder rejects their prefix), never as a partial decode.
 */
export function decodeChallengeLink(
  fragment: unknown,
  expectedScoringVersion: number,
): ChallengeLinkResult {
  if (typeof fragment === "string" && fragment.startsWith(CHALLENGE_MC2_PREFIX)) {
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
  challengeOrigin: "mc1" | "mc2";
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
  return {
    edition: route.edition,
    regionId: CHALLENGE_REGION_ID,
    regionName: `${route.regionName} challenge`,
    challengeRegionId: route.regionId,
    challengeRadiusKm: route.radiusKm,
    challengeOrigin: "mc2",
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
 *     for the shipped surface); any other edition encodes as mc2.
 *   "fresh" — deal `count` (default 5) from the first widening source
 *     that can fill it, presented fame-tier ascending so a friend meets
 *     the famous places first. Fresh routes always encode as mc2 —
 *     except that nothing here ever re-encodes an mc1 route.
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
}): ChallengeCreation | null {
  const region = findRegion(input.edition, input.regionId);
  const radius = regionRadiusKm(input.edition, input.regionId);
  if (!region || radius === null) return null;
  if (input.mode === "exact") {
    const ids = (input.exactIds ?? []).slice(0, CHALLENGE_MAX_PLACES);
    if (!legalIds(ids)) return null;
    const fragment =
      input.edition === "globe"
        ? encodeChallenge(ids, input.scoringVersion)
        : encodeChallenge2(
            { edition: input.edition, regionId: input.regionId, radiusKm: radius, ids },
            input.scoringVersion,
          );
    return { fragment, placeCount: ids.length, regionName: region.name, radiusKm: radius, dealtIds: [...ids] };
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
    const fragment = encodeChallenge2(
      { edition: input.edition, regionId: input.regionId, radiusKm: radius, ids: ordered },
      input.scoringVersion,
    );
    return { fragment, placeCount: ordered.length, regionName: region.name, radiusKm: radius, dealtIds: ordered };
  }
  return null;
}
