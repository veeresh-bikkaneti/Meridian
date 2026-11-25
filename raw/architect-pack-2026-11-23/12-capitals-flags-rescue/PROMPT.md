# 12 — Capitals & Flags: rescue the 41 flagless cases

## Intent (one line)
Get flags onto the 41 Capitals & Flags cases that ship without one, without breaking the game's asset budget.

## Why (origin)
Capitals & Flags is LIVE (PRs #346, #354): 110 cases (50 state + 60 country). Only licence-verified flags ship — **69 of 110 have flags; 41 are flagless** because their verified flag SVGs were too heavy. The SVG-optimisation rescue has been open since the flip.

## Scope IN
- A rescue route for the 41: optimise the verified SVGs down to budget, or find an equivalently licensed lighter source, case by case.
- Flags appear only where the land's name is already on screen (the shipped v1 rule).

## Scope OUT
- Flags as targets, challenges, or shared score (excluded in v1 by design).
- Any flag without a verified licence (flags in game are PD/CC0 only) or an unverified design — never manufacture a flag.

## Locked decisions
- Licence-verified only (PD/CC0); sourced from GeoNames/Wikipedia-class sources with the licence on record.
- The pack's only entry is the deck shelf inside GeoDetective / Cold Trail (the doorway was removed entirely, owner's word 2026-11-05).

## Acceptance criteria
- Each rescued case ships a flag that is (a) the correct flag, (b) licence-verified, (c) inside the asset budget, verified in the built game at phone width.

## Assets & related work
- Brief-only folder: the counts and rules above are the record (MEMORY.md, Capitals & Flags live note). The 41 cases and their source SVGs live in the repo's Capitals data pipeline.

## Open questions for the architect
1. Optimisation route: automated SVG simplification risks mangling heraldic detail at small sizes — where is the fidelity floor for a flag a kid is meant to recognise?
2. Is per-case hand rescue worth it for all 41, or should the tail (least-famous lands) stay flagless by design?

## Status & evidence
- Pack live; rescue open since the PR #354 flip; no rescue work started.
