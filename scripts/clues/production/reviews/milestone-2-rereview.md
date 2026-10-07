# Milestone 2 (Wave 2) — Narrow Re-Review of the Varna Fix

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on overwhelming evidence). Not a generation worker, not the coordinator.
**Branch / HEAD reviewed:** `feat/geodetective-clues` @ `bafedb1c22271d217b276c448c64a6f954d24a58` (verified first-hand; on top of `2a800d5`; working tree clean at start of review)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`
**Scope:** Only the single fix prescribed by `milestone-2-review.md` (NEEDS WORK): convert Varna gn-726050 to a tier-3 rejection, re-fold, re-assemble, re-run leak scan. Everything else in the milestone-2 review stands and was not re-litigated.

## VERDICT: CERTIFIED — Milestone 2 passes

Every coordinator claim reproduced exactly from the raw files under my own runs. The prescribed fix was applied precisely, with no collateral changes.

**Final assembled total: 388 sets (229 baseline + 91 wave 1 + 68 wave 2). The 365 target is met, with a 23-set buffer.**

---

## 1. Varna gn-726050 conversion — PASS (exact)

- In `tranches/tier2-out/wave2/wave2-job2.jsonl`, `records-tier2-wave2.jsonl`, and the union `records-tier2.jsonl`, gn-726050 is now a rejection with `tier: 3`, `tier_name: "history"`. The record is **byte-identical across all three files** (3 lines found, 1 unique). The union file contains exactly one gn-726050 entry.
- Reason class matches the prescription: the reason states the tier-3 clue gives only a Thracian shore-settlement origin growing into a port — no founding year, no founder, no discrete defining event, no temporal anchor, second sentence summary — tier 2 passes, and the lead offers no compliant tier-3 alternative (necropolis/oldest-gold is the tier-4 hook; three-millennia trading-centre is status). Same Negombo/Dumaguete fail-closed class as prescribed.
- Varna is **not published**: no `726050` anywhere under `public/loop/`, and `geonames:726050` is absent from the published placeId sequence. Its old published index was 119 (at `2a800d5`), which explains the re-index cascade in the diff.

## 2. Re-fold — PASS (independently reproduced, byte-identical)

- I re-ran the shipped `validate-production.mjs` myself (wave-2 inputs `.scratch/geodetective/tier2-inputs-wave2.jsonl`, wave-2 out dir, records/stats written to `/tmp` only). Regenerated records are **byte-identical** (`cmp` clean) to the committed `records-tier2-wave2.jsonl`; regenerated stats equal the committed `validation-stats-tier2-wave2.json` in every field.
- Counts re-derived from the raw records by me: attempted **200** / accepted **68** / rejected **132**; worker-rejection tier histogram **climate 87, history 42, hook 3** (= 132); **validatorRejected 0**, malformed 0, pipelineIssues [].

## 3. Union, assembly, order — PASS

- Union `records-tier2.jsonl` accepted = **388**, composed disjointly of baseline 229 + wave-1 91 + wave-2 68 (wave-1 ∩ wave-2 accepted = 0; both waves' records sit verbatim in the union, 200/200 each; no duplicate accepted place_ids). Wave 2 contributes the post-fix 68, not 69.
- `public/loop/manifest.json` size = **388**; **388** clue files, indices 0–387 contiguous.
- Bijection: I regenerated every published file with the shipped `assemblePublishedFile` from the union accepted records in pool fame-rank order — **388/388 byte-identical to the files on disk, 0 mismatches**; published placeId sequence equals the union-accepted fame order exactly.
- Order vs. `2a800d5`: new published sequence = old sequence **minus Varna exactly** (Varna was index 119); per-place file content for all 388 surviving places is unchanged (0 content diffs) — a pure removal + re-index, nothing else edited.

## 4. Leak scan — PASS (independently re-run)

- I re-ran the shipped method myself (read-only re-implementation of `assemble.mjs`'s scan: `buildLeakTerms`/`findLeaks` over every clue text, plus the whole-file scan with the source href scrubbed) over all **1,940** published clue texts: **0 hits**. Matches the committed `assembly-report.json` (published 388, clueTextsScanned 1,940, hits 0).

## 5. Locked hashes and diff scope — PASS

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```
Both match the required values exactly.

- Diff `2a800d5..bafedb1` (278 files) touches only: the wave-2 job2 out file (exactly one line changed — the Varna record), `records-tier2-wave2.jsonl` and union `records-tier2.jsonl` (exactly one line each — the same Varna record), `validation-stats-tier2-wave2.json` (69→68, 131→132, history 41→42), the assembly outputs (`public/loop/clues/{119..388}.json` re-index cascade with 388.json deleted, `public/loop/manifest.json`, `assembly-report.json`), `tier2-run-state.md`, and the added `reviews/milestone-2-review.md`. Nothing else.

---

## Certification

Milestone 2 is **CERTIFIED**. The sole blocker from the milestone-2 review (Varna gn-726050, hollow tier-3 accept) is converted to an honest tier-3/history rejection in all three records locations, the re-fold and re-assembly reproduce exactly under independent runs, and the leak scan is clean.

**Final assembled total: 388 validated clue sets — the 365 target is met (23-set buffer).**

---
**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers derived first-hand in this session from the raw records, the shipped validator re-run to `/tmp` (byte-identical output), the shipped assembler/leak functions re-run read-only (388/388 match, 0/1,940 leaks), and `git diff`/`git show` on `2a800d5..bafedb1`. No file modified except this re-review.
