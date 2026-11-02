/**
 * Challenge attempts store (governing council manifest 2026-10-31,
 * §Q2-B3) — how many times THIS device has completed each challenge
 * route. The count rides inside mc3 winner blocks as `senderAttempts`:
 * when a player finishes a route and shares it onward, the share can
 * honestly say how many completions stand behind their mark.
 *
 * One JSON document under one localStorage key, like the learning
 * store: a map from the route's canonical tuple to its count, plus a
 * recency order for the LRU cap. The tuple is
 * `s|edition|region|ordered ids` — scoring version first, because a
 * route is only the same route under the same scoring rules.
 *
 * Rules the manifest pins:
 * - a completion counts when the player REACHES the completion
 *   screen; walking away mid-route is not a completion;
 * - the store is capped at 512 routes, least-recently-completed
 *   evicted first;
 * - turning the friendChallenges flag off does NOT clear it (the
 *   counts are the player's own history, not the feature's state);
 * - Reset-my-history DOES clear it (wired in reset-history.ts).
 *
 * Fail-closed like every store here: unreadable or malformed data
 * reads as empty, storage errors never surface as crashes, and a
 * store that cannot persist simply behaves as session-only.
 */

export const CHALLENGE_ATTEMPTS_KEY = "meridian.challenge.attempts.v1";
export const CHALLENGE_ATTEMPTS_CAP = 512;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function resolveStorage(explicit?: StorageLike): StorageLike | undefined {
  if (explicit) return explicit;
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** The canonical route tuple a completion count belongs to. */
export function challengeRouteTuple(input: {
  scoringVersion: number;
  edition: string;
  regionId: string;
  ids: readonly string[];
}): string {
  return `${input.scoringVersion}|${input.edition}|${input.regionId}|${input.ids.join(",")}`;
}

interface AttemptsDoc {
  /** tuple -> completions count (always ≥ 1 for present tuples). */
  counts: Record<string, number>;
  /** Tuples, most-recently-completed last. Mirrors counts' keys. */
  order: string[];
}

function emptyDoc(): AttemptsDoc {
  return { counts: {}, order: [] };
}

function parseDoc(raw: string | null): AttemptsDoc {
  if (!raw) return emptyDoc();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyDoc();
    const countsIn = (parsed as Record<string, unknown>).counts;
    const orderIn = (parsed as Record<string, unknown>).order;
    if (!countsIn || typeof countsIn !== "object" || !Array.isArray(orderIn)) {
      return emptyDoc();
    }
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(countsIn as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isInteger(v) && v >= 1) counts[k] = v;
    }
    const order = orderIn.filter(
      (t): t is string => typeof t === "string" && t in counts,
    );
    // Any counted tuple missing from the order list re-joins at the
    // front (treated as oldest) so the two never drift apart.
    for (const k of Object.keys(counts)) {
      if (!order.includes(k)) order.unshift(k);
    }
    return { counts, order };
  } catch {
    return emptyDoc();
  }
}

function readDoc(storage?: StorageLike): AttemptsDoc {
  const s = resolveStorage(storage);
  if (!s) return emptyDoc();
  try {
    return parseDoc(s.getItem(CHALLENGE_ATTEMPTS_KEY));
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc: AttemptsDoc, storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(CHALLENGE_ATTEMPTS_KEY, JSON.stringify(doc));
  } catch {
    // Storage full or blocked: the count becomes session-only rather
    // than an error in the player's face.
  }
}

/** Completions of this route recorded so far (0 when none). */
export function readRouteAttempts(tuple: string, storage?: StorageLike): number {
  return readDoc(storage).counts[tuple] ?? 0;
}

/**
 * Record one completion of this route and return the NEW count —
 * minting reads "attempts = storedCount + 1, then stored" (§Q2-B3),
 * which is exactly this function's contract. Evicts least-recently-
 * completed tuples past the cap.
 */
export function recordRouteCompletion(tuple: string, storage?: StorageLike): number {
  const doc = readDoc(storage);
  const next = (doc.counts[tuple] ?? 0) + 1;
  doc.counts[tuple] = next;
  doc.order = [...doc.order.filter((t) => t !== tuple), tuple];
  while (doc.order.length > CHALLENGE_ATTEMPTS_CAP) {
    const evicted = doc.order.shift();
    if (evicted !== undefined) delete doc.counts[evicted];
  }
  writeDoc(doc, storage);
  return next;
}

/** Clear the whole store (Reset-my-history). True when clear. */
export function clearChallengeAttempts(storage?: StorageLike): boolean {
  const s = resolveStorage(storage);
  if (!s) return true; // No storage = nothing was ever persisted.
  try {
    s.removeItem(CHALLENGE_ATTEMPTS_KEY);
  } catch {
    try {
      s.setItem(CHALLENGE_ATTEMPTS_KEY, JSON.stringify(emptyDoc()));
    } catch {
      // Both paths blocked; the verification below reports it.
    }
  }
  try {
    const after = parseDoc(s.getItem(CHALLENGE_ATTEMPTS_KEY));
    return after.order.length === 0 && Object.keys(after.counts).length === 0;
  } catch {
    return false;
  }
}
