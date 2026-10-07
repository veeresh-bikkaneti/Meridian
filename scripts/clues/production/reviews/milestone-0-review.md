# Milestone 0 — Independent Reality-Check Review (tier-2 expansion run)

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on evidence derived first-hand)
**Branch:** `feat/geodetective-clues` · **Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`
**Review date:** 2026-10-04

## VERDICT: CERTIFIED

Every load-bearing Milestone 0 claim was re-derived independently from the raw files and re-run tools, not taken from the coordinator's reports. All content checks pass. The one apparent discrepancy (HEAD movement, Check 5) is resolved and documented below: the M0 claim was true when made and verified, and the subsequent prep commit does not touch any M0 artifact.

---

## Check 1 — Stratum counts, disjointness, union, byte-identity — PASS

My own counts from the raw records files (Python over the JSONL, statuses counted per file):

| File | Total | Accepted | Rejected | Unique place_ids | Duplicates |
|---|---|---|---|---|---|
| `records.jsonl` (Phase 2) | 2,189 | 63 | 2,126 | 2,189 | 0 |
| `records-full.jsonl` (Option A) | 8,200 | 123 | 8,077 | 8,200 | 0 |
| `records-scope.jsonl` (scoping sample) | 200 | 43 | 157 | 200 | 0 |
| `records-tier2.jsonl` (union) | 8,690 | **229** | 8,461 | 8,690 | 0 |

- Accepted place_id sets are **pairwise disjoint**: Phase2∩Full = ∅, Phase2∩Scope = ∅, Full∩Scope = ∅. Union of the three accepted sets = **229 = 63 + 123 + 43**, exactly the tier2 accepted count, with zero extra and zero missing place_ids.
- **Byte-identity (stronger than the claim):** every one of the 8,690 records in `records-tier2.jsonl` — not just the 229 accepted — is byte-identical to its superseding source-stratum record under scope > full > Phase 2 supersession (attribution: scope 200, full 8,000, Phase 2 490; **0 mismatches**). Scope-supersession spot-verified explicitly on the first 10 scope-accepted places (incl. `gn-1177446`, `gn-1248991`, `gn-1259229`): each is byte-identical to its `records-scope.jsonl` line and differs from its `records-full.jsonl` line.
- No rejected record snuck into the accepted set: the tier2 accepted set equals the union of the three strata's accepted sets exactly, and each accepted line is byte-identical to a source line whose status is `accepted`.
- Intermediate consistency: `records-union-step1.jsonl` holds 186 accepted = Phase 2 ∪ Option A exactly, as expected for the pre-scope step.

## Check 2 — Revalidation + hand spot-checks — PASS

I re-ran the coordinator's driver myself against each stratum's proper inputs (shipped validator library via `revalidate-union.mjs`):

| Records | Inputs | Accepted | acceptedValid | acceptedInvalid |
|---|---|---|---|---|
| `records.jsonl` | `pool.jsonl` | 63 | 63 | **0** |
| `records-full.jsonl` | `.scratch/geodetective/full-inputs.jsonl` | 123 | 123 | **0** |
| `records-scope.jsonl` | `.scratch/geodetective/scope-inputs.jsonl` | 43 | 43 | **0** |

All three exited 0 with empty failure lists. Since the tier2 accepted lines are byte-identical to these stratum lines (Check 1), the 229 union accepted are thereby all re-validated clean against their proper inputs.

**Hand spot-check (6 records, 2 per stratum, 30 clues):** for each clue I verified, with my own driver using the shipped `foldText`/`buildLeakTerms`, that (a) `source.quote` is a verbatim span (whitespace-collapsed, per validator semantics) of the cited extract — matched by article label, falling back to URL — in the corresponding input file, and (b) the clue text contains no folded substring of the place name or aliases (both the simple name+aliases rule and the validator's stricter leak-term list).

- Phase 2: `gn-3848950` La Rioja; `gn-3359957` Villiersdorp
- Option A: `gn-3904906` Santa Cruz de la Sierra; `gn-3582883` Usulután
- Scope: `gn-1269771` Imphal (tier-2 quote correctly cites the "Imphal (Climate section)" extract); `gn-3591060` Puerto San José (tier-2 quote correctly cites the Climate-section extract: the Köppen Aw / May–October wet-season span — thin but verbatim and traceable, as flagged in the scoping report)

Result: **30/30 quotes verbatim, 0 leaks** under either rule.

## Check 3 — Assembly (`public/loop/`) — PASS (verified on all 229 files, not a sample)

- `public/loop/clues/` contains **229 files**, all named `<n>.json`, indices **0..228 contiguous**, no extras.
- `public/loop/manifest.json` = `{"v":1,"size":229,"generatedAt":"2026-10-04T17:04:20.685Z"}` — size field **229**, matching `assembly-report-tier2.json`'s manifest block.
- **Full comparison:** for every i in 0..228, the published file is exactly (JSON-string equality) `assemblePublishedFile()` applied to the i-th accepted record of `records-tier2.jsonl` sorted by pool fame rank (all 229 accepted are present in `pool.jsonl`). **0 mismatches.** Sample detail (coords + all 5 clue texts + tier-1 href all match): idx 0 `gn-3904906` Santa Cruz de la Sierra (−17.78629, −63.18117); idx 1 `gn-3848950` La Rioja; idx 2 `gn-128747` Karaj; idx 57 `gn-1256451` Shivpuri; idx 114 `gn-3582883` Usulután; idx 171 `gn-4953804` Uxbridge; idx 227 `gn-2073985` Coober Pedy; idx 228 (last) `gn-3191631` Risan (42.515, 18.69556); and the folded sample place **`gn-3591060` Puerto San José at idx 203** (13.92216, −90.81906), clues and href matching its record.
- Identity stripping: every published file has exactly the keys `v, placeId, target, clues, source` — no name/alias/region fields.
- **My own leak scan** (not relying on `assembly-report-tier2.json`): folded substring scan of all **1,145 published clue texts** against each place's name + answer aliases + curated aliases = **0 hits**; the validator's stricter `buildLeakTerms`/`findLeaks` scan = **0 hits**; whole-file scan with the source href scrubbed = **0 hits**. This independently reproduces the report's claimed scan (229 files / 1,145 texts / 0 hits).
- Cross-check: difficulty distribution recomputed from the accepted records = {1: 2, 2: 16, 3: 64, 4: 123, 5: 24}, matching `assembly-report-tier2.json`.

## Check 4 — Locked-file hashes — PASS

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```

Both match the claimed values exactly (verified at the start of the review and again at the end).

## Check 5 — Git state / HEAD condition — PASS, with the movement documented and resolved

- **At the start of this review** I verified first-hand: `HEAD == origin/feat/geodetective-clues == 24e6080ad262ba16f6f616beb0388f4ad39c94ab`, tree clean. The M0 claim was true as made.
- **During the review window** HEAD advanced to `991507afed17bd560e10f346c1e4f7394c28d483` ("tier2-run prep: wave job builder + wave-1 jobs", committed 2026-10-04 17:06:49 UTC). I flagged this, then re-ran Checks 1–4 in full against the new HEAD: **all pass identically**.
- **Delta verified by me:** `git diff --name-only 24e6080..991507a` = exactly 12 files: `build-tier2-jobs.mjs`, `build-wave-fetch-list.mjs`, and `tranches/tier2-jobs/wave1-job1.json` … `wave1-job10.json`. A diff restricted to every M0 path (`records*.jsonl`, `pool.jsonl`, `public/loop/`, `generation-prompt.md`, `validate-production.mjs`) is **empty** — the prep commit touches no M0 artifact. The coordinator's note confirms the same: prep-only, pushed after the M0 push at `24e6080`.
- **At the time of writing:** `git rev-parse HEAD` = `991507a…`, `git ls-remote origin feat/geodetective-clues` = `991507a…` — HEAD and origin agree again (the prep commit has been pushed).
- One transparency note: at the moment of writing, `git status` shows one uncommitted modification, `scripts/clues/production/tier2-run-state.md` — the coordinator's own working state file with the wave-worker brief appended, i.e. concurrent coordinator work-in-progress. It is not an M0 artifact, it is not mine, and it does not affect any check above (all M0 artifacts are committed and untouched). The committed tree at both `24e6080` and `991507a` was clean when I checked it.

## Scope-record regeneration comparison — PASSED (run by me, first-hand)

Per the coordinator's note, I did not take the regeneration claim on trust — I re-ran it myself:

```
node scripts/clues/production/validate-production.mjs \
  --inputs  ~/workspace/meridian-worktrees/geodetective-clues/.scratch/geodetective/scope-inputs.jsonl \
  --out-dir tranches/scope-out \
  --records /tmp/regen-scope-records.jsonl \
  --stats   /tmp/regen-scope-stats.json
```

- Regenerated stats are identical to the committed `validation-stats-scope.json`: attempted 200, accepted 43, workerRejected 157, validatorRejected 0, rejection histogram {climate 134, history 16, giveaway 6, hook 1}, no pipeline issues.
- `cmp` result: the regenerated records file is **byte-identical to `records-scope.jsonl` in full** — all 200 lines, in order (sha256 `8d42d324dd02dd8e15227b4b6c2b516cc2fce48af76ab8d7c547e872d720ce99` for both files). The **43 accepted records are therefore 43/43 byte-identical**, in the same pool-rank order. This is stronger than the coordinator's stated comparison (accepted-only): the entire folding, including all 157 rejections, reproduces exactly.
- The regeneration wrote only to `/tmp` (outside the repo); no repo file was modified by it.

## Discrepancies

None in any M0 content claim. The only irregularity encountered was the mid-review HEAD advancement (Check 5), which is fully explained, delta-verified as prep-only, and resolved with HEAD == origin at `991507a` and all checks re-run green at that commit.

**CERTIFIED.** Milestone 0's baseline of 229 assembled, validated, leak-free clue sets is exactly what the coordinator claimed.
