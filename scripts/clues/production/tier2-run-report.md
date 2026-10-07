# GeoDetective tier-2 source-expansion run — full-run report

**Branch:** `feat/geodetective-clues` · **Directive:** Liz's approved full-scale run (2026-10-04) · **Crew:** coordinator (`agents_orchestrator` persona) + independent reviewer (`testing_reality_checker` persona) per milestone.

## Verdict line

**388 validated 5-tier clue sets assembled in `public/loop/` — the ≥365 production target is MET (23-set buffer).** The 365 gate for lifting the GeoDetective mode-code hold stands separately and remains Veeresh's/Chitti's — assembly ≠ gate clearance, and nothing here claims otherwise.

Locked files byte-untouched throughout: generation prompt sha256 `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a`; production validator sha256 `22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4` (re-verified by the reviewer at every milestone).

## What changed vs. earlier phases

Tier 2 (climate) may cite the article's Climate section (Geography fallback) in addition to the lead; tiers 1/3/4/5 remain lead-only. Inputs = fuller lead extract + section extract from the SAME matched article, fetched by the scoping run's batched-wikitext method (a documented deviation from per-section API calls). Sections sourcing tiers 1/3/4/5 was DEFERRED by the directive and not done. Converter/template-borne value loss (blanked extreme values in some extracts) is a known limitation of this run, noted here only — not a work item.

## Waves table

| Stage | Attempted | Accepted | Rejected | Cumulative assembled |
|---|---|---|---|---|
| Milestone 0 baseline (Phase 2 63 + Option A 123 + scope sample 43, re-validated as a union, no regeneration) | — | 229 | — | 229 |
| Wave 1 (pool ranks 1–217 of the wave population) | 200 | 91 | 109 | 320 |
| Wave 2 (pool ranks 218–425) | 200 | 68 | 132 | **388** |

The run stops because 388 ≥ 365, NOT because the pool exhausted.

## Final rejection histogram (the two expansion waves, post-review)

| Wave | Climate | History | Giveaway | Hook | Total rejected |
|---|---|---|---|---|---|
| Wave 1 | 82 | 25 | 1 | 1 | 109 |
| Wave 2 | 87 | 42 | 0 | 3 | 132 |
| **Total** | **169** | **67** | **1** | **4** | **241** |

Validator-rejected after repair loops: **0** in both waves (wave 1 required an extensive coordinator repair loop; wave 2 needed none — hardened brief + mandatory worker self-validation). Union audit file `records-tier2.jsonl`: 8,690 records, 388 accepted, 8,302 rejected.

## Reviewer certifications

- **Milestone 0 (baseline 229): CERTIFIED** — `reviews/milestone-0-review.md`.
- **Milestone 1 (wave 1, 320): CERTIFIED** after two NEEDS WORK cycles — `reviews/milestone-1-review.md`, `reviews/milestone-1-rereview.md`, `reviews/milestone-1-final.md`. The reviewer caught two hollow accepts my repair loop had passed (Tarakan gn-1624725 tier 2; Dumaguete gn-1714201 tier 3) and one lost text patch (Savannah gn-4221552 tier 5). All converted/repaired and re-verified.
- **Milestone 2 (wave 2, 388): CERTIFIED** after one NEEDS WORK item — `reviews/milestone-2-review.md`, `reviews/milestone-2-rereview.md`. The reviewer withheld Varna gn-726050 (tier 3 = origin narrative with no founding year/founder, discrete event, or temporal anchor) and certified everything else first-hand, including byte-identical re-folds, 345/345 verbatim quotes, and 276/276 lead-only sourcing for tiers 1/3/4/5. Varna converted to an honest tier-3 rejection; final wave-2 yield 68.
- **Final certification:** see `reviews/final-certification.md` (issued after the gates below).

Leak scan (assembler, mechanical, every milestone): **0 hits** — final: 0 / 1,940 published clue texts. Reviewer additionally ran an independent stricter scan at milestone 2; its 29 raw hits were all adjudicated non-leaks under the locked rule (generic alias parts, tier-1 country/region names, and Mohali's tier 5 naming the person the city is named after — allowed decisive material, recorded transparently).

## Remaining-pool disposition

Wave population was 7,797 fame-ordered climate-rejected places (7,997 worker climate rejections in `records-full.jsonl` minus the 200 sampled; the one validator-converted Cockermouth gn-2652676 record was never in the population). Attempted: 400. **Unattempted: 7,397** — they remain climate-rejected in the audit records, unexamined under the expanded sourcing; no rule was loosened and no further waves were run because the target was met. If a future run wants them, the wave-2 yield at these fame ranks was 34% (68/200); wave 1 at higher fame was 45.5% (91/200).

## Flags carried forward (for Veeresh's sampling review)

- **Puerto San José gn-3591060** — one of the folded 43 sample sets; assembled like the others, NO rule change; **current published index 362** (203 at milestone 0; wave insertions in pool fame order shifted it).
- Prior semantic flags stand: Karaj gn-128747 (hollow climate), Kawambwa gn-176555, Sisimiut gn-3419842, Torquay gn-2635650, San Antonio Oeste gn-3837980, Palestina gn-3673269, Cockermouth gn-2652676 (validator-rejected in Option A, not in this run's population).
- Reviewer watch items (passed, noted): Gaziantep gn-314830 tier 2 (quantified snow regime, 1966-vintage stats), Mohali tier 3 (2006 district carve-out — weakest passing history class), Cavite City and Bremerhaven tier 2/tier 5 soft spots — all documented in `reviews/milestone-2-review.md`.

## Process disclosures (all in `tier2-run-state.md`, all reviewer-adjudicated)

- Wave 1: depth-2 worker shell writes landed in private overlays; three wrong-job reply deliveries (jobs 3, 5, 7) plus job 9's first delivery were caught by place_id position checks and discarded; one worker self-reported fabrication (job 5 records 15–20 never delivered; two tier-2 quotes in records 1–14 confirmed fabricated and replaced verbatim in repair); two stale-overwrite drift events fixed via `git restore` (standing rule since: check `git status` before every fold/commit); three spawned repair workers' output discarded wholesale (cross-contaminated quotes) and two canaries stranded by a two-phase gate — all wave-1 repairs were coordinator-authored and locally validated before applying. 17 honest §6 conversions in wave 1, 1 in wave 2 (Varna, reviewer-ordered).
- Lesson recorded: every repair write is re-read from disk before being reported as done.

## Gates (coordinator-run at finish, on the final tree)

- `node --test scripts/clues/*.test.mjs` — 70/70 pass.
- `npm test` — exit 0, 0 failures.
- `npx tsc --noEmit` — clean.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green.

## Deferred (unchanged, per directive)

Sections sourcing tiers 1/3/4/5 (its own scoped measurement, if ever); converter-fidelity work; the mode-code 365 gate decision (Veeresh/Chitti); merge/PR (none opened).
