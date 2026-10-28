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
function fnv1a(ids: readonly string[]): number {
  let h = 2166136261;
  const joined = ids.join(",");
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
