# Tier-2 expansion run — state (coordinator working file)

Branch feat/geodetective-clues · run start HEAD 0f8bec9
Hashes at start (reviewer re-checks every milestone):
- generation-prompt.md sha256 7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a (matches directive)
- validate-production.mjs sha256 22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4

Population accounting (coordinator-derived from raw records):
- records.jsonl (Phase 2, short-extract inputs): 2,189 attempted / 63 accepted
- records-full.jsonl (Option A, fuller leads): 8,200 attempted / 123 accepted
  - climate tier rejections: 7,998 lines = 7,997 worker + 1 validator-converted
    (Cockermouth gn-2652676, CLIMATE_NO_SIGNAL — NOT in wave population)
- records-scope.jsonl: 200 sampled (all from the 7,997) / 43 accepted (folded in)
- WAVE POPULATION: 7,997 - 200 sampled = 7,797, fame order = pool.jsonl rank
- Baseline union target: 63 + 123 + 43 = 229

Scratch inputs (never committed): .scratch/geodetective/
  full-inputs.jsonl (10,582), scope-inputs.jsonl (200),
  climate-sections.jsonl (200 at start; waves append),
  tier2-inputs.jsonl (wave union inputs, built incrementally)

## Milestones
- [ ] M0 baseline 229: revalidate-union -> records-tier2.jsonl (union) ->
      assemble -> leak scan -> reviewer certify -> commit/push
- [ ] Waves T2-1..n over the 7,797 until assembled >= 365 or pool exhausted
- [ ] Finish: gates + full-run report + BRANCH_STATUS + final reviewer cert
