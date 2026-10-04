# Milestone 1 (Wave 1) — FINAL Narrow Review: Savannah Tier-5 Fix (tier-2 expansion run)

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on overwhelming evidence). Not a generation worker, not the coordinator.
**Branch / HEAD reviewed:** `feat/geodetective-clues` @ `e33efd13efc75accb862e8621654be3050042c79` (verified first-hand; tree clean at start and end of review)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`
**Scope:** Narrow third check. Everything in milestone 1 was already certified by `milestone-1-review.md` and `milestone-1-rereview.md` EXCEPT Savannah gn-4221552 tier 5. This review verifies only the coordinator's four claims about commit `e33efd1`, plus locked hashes. Prior certified items stand unless contradicted — none were.

## VERDICT: CERTIFIED

The Savannah repair has actually landed this time — in the record text, the narrowing, all three record copies, and the published file. The population ranking is gone from every Savannah clue text. All counts are unchanged and reproduce first-hand, and the diff touches no other place, no script, no prompt, and no validator.

---

## Locked hashes — PASS (exact)

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```
Both match the required values exactly.

## Claim 1 — Savannah tier-5 text actually repaired — PASS

Read first-hand in all three record locations; tier 5 is byte-identical in each:

- `scripts/clues/production/tranches/tier2-out/wave1/wave1-job7.jsonl`
- `scripts/clues/production/records-tier2-wave1.jsonl`
- `scripts/clues/production/records-tier2.jsonl` (union)

Tier 5 in each:
- **text:** `Its old heart holds one of the most big marked old zones of the land. Two and twenty green squares sit like parks in its grid.` — exactly as claimed.
- **narrowing:** `Its historic district holds 22 parklike squares.` — exactly as claimed.

Published file `public/loop/clues/73.json` (placeId `geonames:4221552`) tier-5 clue is the same new text, verbatim.

Population ranking gone: grep for the old fragments (`fifth town of its state by folk count`, `Most populous city of its coastal region`, `first of its shore lands`) returns **0 hits** in any record or published file (excluding the review files and run-state, which quote them historically). A regex scan for population-ranking language (`popul|folk count|fifth|most populous|by count|ranking`) over **all five** Savannah clue texts and narrowings returns **0 hits**.

## Claim 2 — validateRecord passes; text and quote now agree — PASS

I ran the shipped `validateRecord` (`scripts/clues/validate-clues.mjs`) against the wave-1 input (`.scratch/geodetective/tier2-inputs-wave1.jsonl`) for the Savannah record from **all three** record locations: **3/3 `ok: true`, zero reasons.**

Quote integrity: all 5 quotes (not just tier 5) trace verbatim (whitespace-collapsed) to the extract whose article label they cite — 5/5. The tier-5 quote (340 chars) is a verbatim span of the **lead** extract: "Savannah's downtown area, which includes the Savannah Historic District, its 22 parklike squares, and the Savannah Victorian Historic District, is one of the largest National Historic Landmark Districts in the U.S., designated by the federal government in 1966…"

Semantic agreement (the defect the re-review found): the text now asserts the same fact the quote supports — a very large marked historic zone ("one of the most big marked old zones" ↔ "one of the largest National Historic Landmark Districts") and 22 parklike squares ("Two and twenty green squares sit like parks" ↔ "its 22 parklike squares"). Text↔quote mismatch eliminated. The tier-5 fact is a single most-confirming fact, not a summary and not census — it clears the bar the population ranking failed.

## Claim 3 — All counts unchanged — PASS (re-derived, exact)

- Fold `records-tier2-wave1.jsonl`: **200 total / 91 accepted / 109 rejected**; rejection histogram re-derived from the records: climate 82, history 25, giveaway 1, hook 1 (= 109). `validation-stats-tier2-wave1.json`: attempted 200, accepted 91, workerRejected 109, **validatorRejected 0**, pipelineIssues [] — consistent in every field.
- Union `records-tier2.jsonl`: 8,690 records, **320 accepted**.
- `public/loop/manifest.json`: size **320**. Published files: **320**, indices 0–319 contiguous.
- Bijection: published set ↔ union accepted set is **320 ↔ 320**, and for all 320 files the published clue texts equal the accepted record's clue texts in tier order — 0 mismatches (so Savannah's published text provably equals its repaired record, and no other published text moved).
- Leak scan: my re-run with the shipped `buildLeakTerms`/`findLeaks` over all **1,600** published clue texts: **0 hits**, matching `assembly-report.json` (published 320, leakScan 0/1,600). (A naive ASCII-split scan produced 2 apparent hits — Paulínia / Calçoene name fragments — which are accent-splitting artifacts of my scan, not leaks; the shipped folding, which handles accents, gives 0, consistent with both prior reviews.)

## Claim 4 — Diff scope cc72dc6..e33efd1 — PASS (one wording note)

8 files changed. In the data files, exactly **3 lines** changed — one per JSONL file — and all three are the Savannah gn-4221552 record:

- `tranches/tier2-out/wave1/wave1-job7.jsonl`, `records-tier2-wave1.jsonl`, `records-tier2.jsonl` — Savannah record only
- `public/loop/clues/73.json` — Savannah published file only (the only published clue file changed)
- `public/loop/manifest.json`, `scripts/clues/production/assembly-report.json` — assembly outputs; size/counts unchanged, only `generatedAt` moved
- `scripts/clues/production/tier2-run-state.md` — run-state entry documenting this fix, whose description this time matches the on-disk record

**Wording note (non-blocking):** the diff also commits `scripts/clues/production/reviews/milestone-1-rereview.md` (the prior re-review document itself, added in this commit), which the coordinator's claim-4 enumeration did not list, and no separate stats file changed (counts were unchanged; `assembly-report.json` carries them). No scripts, no validator, no prompt, and no other place or record were touched. Substantively the scope claim holds.

---

## Certification

Milestone 1 as a whole is **CERTIFIED**: all items certified in `milestone-1-review.md` and `milestone-1-rereview.md` stand (locked-file integrity; the Tarakan / Dumaguete / Negombo conversions; Sochi reshuffle; Bonn cleanup; fold accounting 200/91/109/0; union and publication 320; leak safety), and the sole outstanding item — Savannah gn-4221552 tier 5 — is now genuinely repaired in text, narrowing, records, and the published file, with text and quote in semantic agreement and `validateRecord` passing.

---
**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers and texts above derived first-hand in this session from the raw records, the wave-1 input, the published files, the shipped validator run locally, and `git diff cc72dc6..e33efd1`; intermediate scripts written only to `/tmp`.
