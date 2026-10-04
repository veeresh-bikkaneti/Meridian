# Milestone 1 (Wave 1) — RE-REVIEW after NEEDS WORK (tier-2 expansion run)

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on overwhelming evidence). Not a generation worker, not the coordinator.
**Branch / HEAD reviewed:** `feat/geodetective-clues` @ `cc72dc66ada733c9803bab27f5ba2ace1384d5a4` (fix commit on top of originally reviewed `94f5fae`)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`

## VERDICT: NEEDS WORK

Five of the six claimed fixes are exactly as claimed, and every number in the re-fold reproduces first-hand: 200 / 91 / 109, union 320, manifest 320, bijection clean, index shifts consistent, leak scan 0. I certify the three conversions, the Sochi reshuffle, the Bonn cleanup, the fold accounting, and the diff scope without reservation.

Certification is withheld on **one** item: **the Savannah gn-4221552 tier-5 "repair" did not happen in the player-facing text.** Only the source quote was swapped; the clue text and narrowing are byte-identical to the flagged version and still state the population ranking. The run-state's claim ("population ranking replaced with the historic-district / 22 parklike squares fact. Validated.") is contradicted by the on-disk record. One unrepaired watch item, misreported as repaired, is enough to withhold certification — that is precisely the claim-vs-reality gap this gate exists to catch.

---

## Locked hashes — PASS (exact)

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```
Both match the required values exactly.

## The 3 conversions — PASS (3/3, verified in both locations)

| Place | Out file | Records file | Rejection | In public/loop? | In union accepted? |
|---|---|---|---|---|---|
| Tarakan gn-1624725 | wave1-job7.jsonl | identical JSON | tier 2 / climate | No | No (rejected) |
| Dumaguete gn-1714201 | wave1-job9.jsonl | identical JSON | tier 3 / history | No | No (rejected) |
| Negombo gn-1233369 | wave1-job6.jsonl | identical JSON | tier 3 / history | No | No (rejected) |

Rejection reasons on disk correctly cite the hollow-pass rulings. Negombo verified independently: I read its full lead extract myself (979 chars, 2 extracts total) — location, airport proximity, commercial role, census, beaches, "centuries old fishing industry"; no founding year, founder, or dated defining event anywhere. The tier-3 conversion is correct, not merely asserted.

## The 3 repairs — 2 PASS, 1 FAIL

Mechanical: I ran the shipped `validateRecord` (`scripts/clues/validate-clues.mjs`) against the wave-1 inputs (`.scratch/geodetective/tier2-inputs-wave1.jsonl`) for all three repaired records — **3/3 `ok: true`, zero reasons.** Mechanical passing is necessary, not sufficient; the semantic rulings differ:

- **Sochi gn-491422 — PASS, genuinely repaired.** Old→new diff confirms a true reshuffle: tier 3 = 2014 Winter Olympic Games (quote: "Sochi hosted the XXII Olympic Winter Games and XI Paralympic Winter Games in 2014… Rosa Khutor"), tier 4 = Formula 1 Russian Grand Prix 2014–2021 (quote verbatim), tier 5 = longest city in Europe at 145 km (quote verbatim). Semantic judgment: tier 3 is now a single defining event — clears the prompt §2 tier-3 bar; tier 4 is a distinct, retellable hook; tier 5 is a single most-confirming record fact, not a summary and not census. **No tier duplicates another** (the Olympics fact moved 5→3, the length fact moved 4→5, F1 is new to tier 4; each fact appears exactly once).
- **Bonn gn-2946447 tier 1 — PASS.** Old text ended "More than three hundred twenty thousand folk live here."; new text removes that sentence entirely. Census filler gone, as claimed.
- **Savannah gn-4221552 tier 5 — FAIL. The claimed repair is not in the record.** Old→new diff for this record, in full: tier-5 **text is byte-identical** — "This town is the fifth town of its state by folk count, and the first of its shore lands by far." Tier-5 **narrowing is byte-identical** — "Most populous city of its coastal region." The **only** change is `source.quote`, swapped from the population-ranking quote to the Historic District / 22 parklike squares quote. Consequences:
  1. **The player-facing clue is unchanged.** Published file index 73 (verified) still gives the population ranking as the giveaway — the exact defect the original review flagged and the prompt bars (tier 5 = "single most confirming fact… giveaway, not a summary"; §4 rule: census numbers don't teach). The historic-district / 22-squares fact appears in **no clue text anywhere**.
  2. **Text↔source mismatch created.** The clue text asserts a population rank; its cited quote now says nothing about population — it describes the Savannah Historic District, its 22 parklike squares, and the 1966 National Historic Landmark designation. `validateRecord` passes it only because the validator traces quote→extract, not text→quote; the semantic mismatch is invisible to the mechanical gate.
  3. **Run-state misreports it.** `tier2-run-state.md` states Savannah tier 5 was "REPAIRED — population ranking replaced with the historic-district / 22 parklike squares fact. Validated." On-disk evidence contradicts the first half of that sentence.

## Re-fold counts — PASS (re-derived, exact)

- `records-tier2-wave1.jsonl`: 200 records, **91 accepted / 109 rejected**; rejection histogram re-derived from the records themselves: **climate 82, history 25, giveaway 1, hook 1** (= 109). `validation-stats-tier2-wave1.json`: attempted 200, accepted 91, workerRejected 109, validatorRejected 0 — consistent in every field. (Original 94/106 minus Tarakan climate, minus Dumaguete + Negombo history = 91/109 exactly.)
- Union `records-tier2.jsonl`: 8,690 records, **320 accepted**; wave-1 accepted ⊂ union accepted; union − wave-1 = **229** (milestone-0 baseline). 229 + 91 = 320 confirmed set-wise.
- Assembly: `public/loop/manifest.json` size **320**; clue files **320**, indices 0–319 contiguous; published set ↔ union accepted set is a **bijection** (320 ↔ 320, after normalizing `geonames:<n>` ↔ `gn-<n>`). Index-shift consistency proven directly: **new published order == old (94f5fae) published order minus exactly the 3 converted places** (old indices: Negombo 67, Tarakan 72, Dumaguete 95). Published clue texts for Sochi, Savannah, and Bonn are identical to their records.

## Spot leak scan — PASS, 0 hits

My own folded substring scan (my own folding: NFD accent-strip, lowercase, name + answer aliases + curated aliases + name parts ≥3 chars) over the published files for Sochi, Savannah, and Bonn plus a deterministic random 30 files (seeded LCG): **33 files, 165 clue texts, 0 hits.** Consistent with the assembler's claimed 0 / 1,600.

## Nothing else changed — PASS

`git diff 94f5fae..cc72dc6 --stat`, non-assembly files: exactly the wave-1 out files **job5, job6, job7, job9**, `records-tier2-wave1.jsonl`, `records-tier2.jsonl`, `validation-stats-tier2-wave1.json`, `assembly-report.json`, `public/loop/manifest.json`, `tier2-run-state.md`, and the review file `reviews/milestone-1-review.md` — plus 258 `public/loop/clues/*.json` assembly outputs (index shifts + Bonn/Sochi text changes). No scripts, no validator, no prompt touched. Within wave-1 records, the changed place_ids are **exactly the six named places** (gn-2946447, gn-491422, gn-1233369, gn-1624725, gn-4221552, gn-1714201) — nothing else in wave 1 moved.

---

## Required fix before certification (coordinator to fix; reviewer fixes nothing)

1. **Actually repair Savannah gn-4221552 tier 5:** rewrite the clue **text** (and narrowing) to state the historic-district / 22 parklike squares fact that the new quote supports — the population ranking must leave the text, not just the quote. Re-run `validateRecord`, re-assemble `public/loop` (counts and indices should be unchanged: 91 / 320, Savannah stays at index 73), and correct the run-state entry so it describes what the record actually contains.

**What is certified now, without reservation:** locked-file integrity; all 3 conversions (Tarakan T2, Dumaguete T3, Negombo T3) in out files, records, union, and published set; Sochi's reshuffle (mechanical + semantic, no duplication); Bonn's filler removal; fold accounting (200/91/109, histogram exact, validatorRejected 0); union and publication (320 = 320, bijection, order = old order minus the 3 removals); leak safety on the spot scan (0/165, consistent with 0/1,600); diff scope (only the named files). The milestone fails certification solely because Savannah's tier 5 still tells the player the population ranking while claiming — in the record's own source field and in the run-state — to say something else.

---
**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers derived first-hand in this session from the raw records, out files, inputs, published files, git diffs between 94f5fae and cc72dc6, and the shipped validator run locally; intermediate outputs written only to `/tmp`.
