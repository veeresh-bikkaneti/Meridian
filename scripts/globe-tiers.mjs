/**
 * globe-tiers.mjs — split the 59k-place Globe chunk by fame tier.
 *
 * WHY: `chunks/globe.json` is ~13.7 MB once bundled. The Easy learning path
 * deals tiers 1–2 only (≈19% of the places) but used to download and parse
 * the whole file. The runtime now loads `tiers/globe-t<N>.json` per tier
 * (see src/game/generated-places.ts), so Easy fetches t1+t2, Medium t2+t3+t4,
 * Hard t4+t5.
 *
 * `chunks/globe.json` REMAINS the canonical, pipeline-owned file (the
 * dataset builder, enrichment merges, fact ladder, linters and the
 * Hyderabad-rule gate all read it). The tier files are DERIVED from it —
 * like `facts/` — and the prebuild gate (check-generated-places.mjs) fails
 * if they drift. Never hand-edit a tier file; run
 *   node scripts/build-globe-tiers.mjs
 * (the dataset builder does this automatically).
 *
 * Invariants this module guarantees (and the gate/tests lock):
 *  - every canonical place lands in exactly one tier, record unchanged;
 *  - a place's tier is asFameTier(difficulty): an integer 1–5, else 3 — the
 *    same guard tier-filter.ts uses, so tier files and `filterByTier` agree;
 *  - the canonical chunk is ordered by ascending numeric GeoNames id
 *    (`gn-<n>`), and each tier file keeps that relative order, so merging
 *    tiers by numeric id reproduces the canonical order exactly. Dealing
 *    shuffles the pool with a seed, so pool ORDER must not change.
 */

export const GLOBE_TIERS = [1, 2, 3, 4, 5];

/** Mirror of asFameTier() in src/game/tier-filter.ts (a unit test locks the agreement). */
export function tierOf(place) {
  const d = place.difficulty;
  return d === 1 || d === 2 || d === 3 || d === 4 || d === 5 ? d : 3;
}

/** Numeric GeoNames id of `gn-<n>`; throws on anything else (fail closed). */
export function numericId(id) {
  const m = /^gn-(\d+)$/.exec(String(id));
  if (!m) throw new Error(`globe place id ${JSON.stringify(id)} is not "gn-<digits>"`);
  return Number(m[1]);
}

export function tierFileName(tier) {
  if (!GLOBE_TIERS.includes(tier)) throw new Error(`invalid globe tier ${tier}`);
  return `globe-t${tier}.json`;
}

/** Throws unless the canonical places are in strictly ascending numeric-id order. */
export function assertCanonicalOrder(places) {
  let prev = -Infinity;
  for (const p of places) {
    const n = numericId(p.id);
    if (!(n > prev)) {
      throw new Error(`globe chunk is not in strictly ascending numeric-id order at ${p.id}`);
    }
    prev = n;
  }
}

/** Canonical globe chunk → { 1: chunk, …, 5: chunk }; every tier present (possibly empty). */
export function splitGlobe(chunk) {
  assertCanonicalOrder(chunk.places);
  const byTier = Object.fromEntries(GLOBE_TIERS.map((t) => [t, []]));
  for (const p of chunk.places) byTier[tierOf(p)].push(p);
  return Object.fromEntries(
    GLOBE_TIERS.map((t) => [
      t,
      { meta: { ...chunk.meta, tier: t, count: byTier[t].length }, places: byTier[t] },
    ]),
  );
}

/** Serialized form of each tier file (what is written to disk), keyed by tier. */
export function serializeTiers(chunk) {
  return Object.fromEntries(
    Object.entries(splitGlobe(chunk)).map(([t, c]) => [t, JSON.stringify(c) + "\n"]),
  );
}

/** Merge tier chunks back into canonical order (k-way by numeric id). */
export function mergeTiers(tierChunks) {
  const lists = tierChunks.map((c) => c.places);
  for (const l of lists) assertCanonicalOrder(l);
  const out = [];
  const idx = lists.map(() => 0);
  for (;;) {
    let best = -1;
    let bestN = Infinity;
    for (let i = 0; i < lists.length; i++) {
      if (idx[i] < lists[i].length) {
        const n = numericId(lists[i][idx[i]].id);
        if (n < bestN) {
          bestN = n;
          best = i;
        }
      }
    }
    if (best < 0) return out;
    out.push(lists[best][idx[best]++]);
  }
}
