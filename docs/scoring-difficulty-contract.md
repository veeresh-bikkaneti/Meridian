# Scoring difficulty contract (v3)

The dataset crew (GeoNames 100k pipeline, `feat/geonames-100k`) and the
scoring system share one definition of difficulty. This document is that
definition. The 327 curated starters keep their hand-set tiers; everything
below governs the generated places.

## What difficulty means

Difficulty is **recognizability within the edition pool**, scored with a
MapTap-style multiplier on every place:

| Tier | Name          | Multiplier | Meaning                                               |
| ---- | ------------- | ---------- | ----------------------------------------------------- |
| 1    | Famous        | 1x         | Known to most people in the country (world: globally) |
| 2    | Well-known    | 1.25x      | Known to most people who follow the topic/region       |
| 3    | Everyday      | 1.5x       | Known within the state / nationally aware             |
| 4    | Lesser-known  | 2x         | Obscure even within the state                         |
| 5    | Hidden        | 2.5x       | Deep cut — known only to locals or specialists         |

Don't confuse these with the learning paths: Easy / Medium / Hard on the
edition picker are **dealing paths** (Easy = tiers 1–2, Medium = tiers 2–4,
Hard = tiers 4–5) — a different vocabulary from the five tier names above.

**Easy curation (2026-10-21, review finding P1-6).** Population-derived
tiers 1–2 still include big-but-unknown suburbs on large pools (the Globe
above all), so Easy deals from the first of these rungs that holds at
least `EASY_MIN_POOL` (25) places: (1) curated starters + tier-1 places
with a verified history hook; (2) curated starters + all tier-1 places;
(3) the plain tier 1–2 band. Small regions therefore never starve, and
the pool is never widened past the band. Code: `src/game/easy-curation.ts`
(`dealingPoolFor` — the one function every run-start, Play-again, and
cleared-band check uses). Medium and Hard are unchanged.

## Score cap

`src/game/scoring.ts`: `PLACE_SCORE_CAP = 400` — the cap applies to
base × tier-multiplier × combo; the +15 region bonus is added on top, so
the per-place max is 415.

Calibration examples from the curated set: Mount Rushmore is tier 1 in the
South Dakota pool and would be tier 1 anywhere; the Eiffel Tower is tier 1 in
the globe pool; Puerto Ayora (Galápagos) is tier 5 in the globe pool.

One tier per place (global, not per-pool): each place gets exactly one tier,
calibrated against the smallest pool it ships in (its home region pool).
That tier is used unchanged in every pool the place appears in (globe,
country, state). The scoring module takes a single `difficulty` per place,
so the pipeline emits a single number — never a per-edition table.

Measured mix across all 124,690 places: **tier1 4.8% / tier2 13.2% /
tier3 32.1% / tier4 29.7% / tier5 20.3%**.
Per-pool rule (hard): **every region pool must contain at least one tier ≤ 2
place** — no pool may open with an impossible question. (Locked by
`starters.test.ts` for the curated set; the pipeline should assert the same
for generated pools.)

## Pipeline heuristic (generated places)

Shipped as `tierFor(pop, fcode)` in `scripts/build-geonames-dataset.mjs`,
run once over the measured dump (124,690 kept rows):

- `pop >= 100,000` **or** fcode `PPLC` (national capital) → tier 1
- `pop >= 25,000` **or** fcode `PPLA` (first-order admin capital) → tier 2
- `pop >= 6,000` → tier 3
- `pop >= 2,500` → tier 4
- otherwise → tier 5. Population 0 or missing lands here — fail-closed: a
  place with no population signal should never deal as Easy.
- fcode `PPLX` (section of a populated place) is floored at tier 3
  regardless of population.

No hand-lists: there is no UNESCO/Niagara-style prominence list in the
shipped pipeline — only the fcode rules above shape the heuristic.

## Hand overrides

There is no `data/difficulty-overrides.json` — the file does not exist.
The real hand-override path is the **327 curated starters** in
`src/game/starters.ts`, which carry hand-set `difficulty` values that the
pipeline never re-derives. Additions need one human reviewer; the curated
327 are the reference for what each tier feels like.

## What the pipeline must not do

- Do not re-derive tiers for the 327 curated starters (`src/game/starters.ts`
  — `difficulty` is set at the call site). Generated places only.
- Do not invent a parallel difficulty scale. The five tiers above are the
  whole vocabulary; the scoring module (`src/game/scoring.ts`) maps them to
  multipliers and the game UI renders them as chips.
- Do not ship a region pool whose easiest place is tier 3+ (same rule as the
  per-pool anchor requirement above — restated here so the pipeline's
  ship-gate and the pool-shape rule can't drift apart).
