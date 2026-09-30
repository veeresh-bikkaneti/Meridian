# Scoring difficulty contract (v3)

The dataset crew (GeoNames 100k pipeline, `feat/geonames-100k`) and the
scoring system share one definition of difficulty. This document is that
definition. The 327 curated starters keep their hand-set tiers; everything
below governs the generated places.

## What difficulty means

Difficulty is **recognizability within the edition pool**, scored with a
MapTap-style multiplier on every place:

| Tier | Name       | Multiplier | Meaning                                              |
| ---- | ---------- | ---------- | ---------------------------------------------------- |
| 1    | Easy       | 1x         | Known to most people in the country (world: globally) |
| 2    | Moderate   | 1.25x      | Known to most people who follow the topic/region      |
| 3    | Challenging| 1.5x       | Known within the state / nationally aware            |
| 4    | Hard       | 2x         | Obscure even within the state                        |
| 5    | Extreme    | 2.5x       | Deep cut — known only to locals or specialists        |

Calibration examples from the curated set: Mount Rushmore is tier 1 in the
South Dakota pool and would be tier 1 anywhere; the Eiffel Tower is tier 1 in
the globe pool; Puerto Ayora (Galápagos) is tier 5 in the globe pool.

One tier per place (global, not per-pool): each place gets exactly one tier,
calibrated against the smallest pool it ships in (its home region pool).
That tier is used unchanged in every pool the place appears in (globe,
country, state). The scoring module takes a single `difficulty` per place,
so the pipeline emits a single number — never a per-edition table.

Target mix across the whole catalog: roughly **15% / 25% / 35% / 20% / 5%**.
Per-pool rule (hard): **every region pool must contain at least one tier ≤ 2
place** — no pool may open with an impossible question. (Locked by
`starters.test.ts` for the curated set; the pipeline should assert the same
for generated pools.)

## Pipeline heuristic (generated places)

Derive the tier from GeoNames fields, in this order:

1. **Population** (primary signal for populated places):
   - ≥ 1,000,000 → 1
   - 200,000 – <1,000,000 → 2
   - 50,000 – <200,000 → 3
   - 10,000 – <50,000 → 4
   - < 10,000 → 5
2. **Admin / capital status** (bumps toward easier):
   - National capital → 1 (always, regardless of population)
   - First-order admin capital (state/province capital) → min(current, 2)
3. **Prominence** (feature classes that punch above their weight):
   - UNESCO World Heritage sites → 1 or 2 by fame (hand-list; see overrides)
   - Major natural landmarks (Niagara-class waterfalls, Everest-class peaks,
     famous canyons/deserts) → 1–2 by fame (hand-list; see overrides)
   - National parks / monuments → 2
   - Lighthouses, caves, minor waterfalls, small museums → 4
4. **Default**: 3. When in doubt, tier 3 — the middle of the pool is the
   safest place for an uncertain place.

Population figures go stale; prefer rank-stability over precision. When a
place sits near a bracket boundary, prefer the tier matching its fame within
its home pool.

## Override file

`data/difficulty-overrides.json` (repo-root relative — in this
`meridian-build` checkout; the pipeline must read it from there, not from its
own working copy) — hand-reviewed corrections that always win over the
heuristic:

```json
{
  "comment": "place-id → difficulty 1-5. Reviewed by hand; pipeline must not overwrite.",
  "france-eiffel": 1,
  "globe-puerto-ayora": 5
}
```

- Keys are stable place IDs; values are integers 1–5.
- The pipeline reads this file at import time and applies it **after** the
  heuristic. Unknown keys are a build error (fail closed: a typo must not
  silently do nothing).
- Additions need one human reviewer; the curated 327 are the reference for
  what each tier feels like.

## What the pipeline must not do

- Do not re-derive tiers for the 327 curated starters (`src/game/starters.ts`
  — `difficulty` is set at the call site). Generated places only.
- Do not invent a parallel difficulty scale. The five tiers above are the
  whole vocabulary; the scoring module (`src/game/scoring.ts`) maps them to
  multipliers and the game UI renders them as chips.
- Do not ship a region pool whose easiest place is tier 3+ (same rule as the
  per-pool anchor requirement above — restated here so the pipeline's
  ship-gate and the pool-shape rule can't drift apart).
