export const CHALLENGE_CHILD_COPY = "Could not load this challenge.";
export const CHALLENGE_REGION_ID = "challenge";
export const CHALLENGE_EDITION = "globe";

const PREFIX = "#c=mc1.";
const ID_RE = /^gn-[0-9]+$/;
const KEYS = ["v", "e", "s", "ids", "seed"] as const;

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

export function encodeChallenge(ids: readonly string[], scoringVersion: number): string {
  if (!legalIds(ids)) throw new TypeError("challenge ids");
  const seed = fnv1a(ids);
  const json = JSON.stringify({ v: 1, e: CHALLENGE_EDITION, s: scoringVersion, ids: [...ids], seed });
  return PREFIX + Buffer.from(json, "utf8").toString("base64url");
}

export function decodeChallenge(
  fragment: string,
  expectedScoringVersion: number,
): ChallengeOk | ChallengeFail {
  if (fragment.length > 2000) return fail("tooBig");
  if (!fragment.startsWith(PREFIX)) return fail("format");
  const body = fragment.slice(PREFIX.length);
  if (body.length === 0 || /[^A-Za-z0-9_-]/.test(body)) return fail("format");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
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
  const next = mulberry32(seed);
  const ranked = entries.map((entry, index) => {
    const u = next();
    const key =
      entry.w > 0 && Number.isFinite(entry.w) ? u ** (1 / entry.w) : Number.NEGATIVE_INFINITY;
    return { id: entry.id, key, index };
  });
  ranked.sort((a, b) => b.key - a.key || a.index - b.index);
  return ranked.slice(0, count).map((row) => row.id);
}
