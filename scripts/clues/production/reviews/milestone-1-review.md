# Milestone 1 (Wave 1) — Independent Reality-Check Review (tier-2 expansion run)

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on overwhelming evidence). Not a generation worker, not the coordinator.
**Branch / HEAD reviewed:** `feat/geodetective-clues` @ `94f5fae324c7f744f9371af7f83f986f6f138480` (verified first-hand; tree clean at start and end of review)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`

## VERDICT: NEEDS WORK

The pipeline accounting is flawless — every count the coordinator claimed reproduces exactly from the raw records, the fold re-runs byte-identical, all 470 quotes in the 94 accepted sets trace verbatim, and my own leak scan is 0/1,615. I certify items 1, 2, 4, 5 and the honesty of items 6 and 7.

Certification is withheld on item 3: **2 of the 4 named judgment-call accepts are hollow passes under the locked prompt, judged by the coordinator's own conversion standard applied elsewhere in the same wave** — Tarakan gn-1624725 (tier 2, plus a defective tier 5) and Dumaguete gn-1714201 (tier 3). Neither can be repaired from its supplied extracts (extract-as-only-source), so both should be fail-closed conversions. Correcting them makes wave 1 = 92 accepted and cumulative assembled = 321, not 323. Everything else in the milestone stands.

---

## Item 1 — Locked files byte-untouched — PASS

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```
Both match the required hashes exactly, checked at the start and again at the end of the review.

## Item 2 — Wave-1 counts re-derived from raw files — PASS (exact)

My own counts (Python/Node over the raw JSONL, not the coordinator's summaries):

| Source | Total | Accepted | Rejected |
|---|---|---|---|
| `records-tier2-wave1.jsonl` | 200 | **94** | **106** |
| Rejection tiers in that file | — | — | climate 81, history 23, giveaway 1, hook 1 (= 106) |
| `validation-stats-tier2-wave1.json` | attempted 200 | 94 | workerRejected 106, validatorRejected 0, malformed 0, pipelineIssues [] — **consistent in every field** |
| `tranches/tier2-out/wave1/` | **10 files × 20 = 200** (per-file accepted 12, 8, 11, 9, 12, 13, 7, 5, 11, 6 in job order 1–10) | 94 | 106 |
| Job files vs out files | all 10 jobs: out `place_id`s **identical to job entries, in job order** (10/10) | | |
| Out files vs folded records | 200/200 identical JSON (accepted and rejected), 0 mismatches | | |
| Inputs `.scratch/geodetective/tier2-inputs-wave1.jsonl` | 200 lines, 200 unique ids, set-identical to the wave records | | |

**Independent re-fold:** I re-ran the shipped `validate-production.mjs` myself (wave-1 inputs, wave-1 out dir, outputs to `/tmp` only). Result: attempted 200 / accepted 94 / workerRejected 106 / validatorRejected 0 / histogram {history 23, climate 81, giveaway 1, hook 1} / pipelineIssues [] — and the regenerated records file is **byte-identical** to the committed `records-tier2-wave1.jsonl`. The claimed "validator-rejected 0" is a property of the final (post-repair) out files, which is exactly what the run-state discloses.

## Item 3 — Re-validation + semantic rulings — FAIL (2 hollow passes)

Mechanical: I ran the shipped `validateRecord` (via `scripts/clues/validate-clues.mjs`) against the wave inputs for **all 94 accepted records — 94/94 pass**, including a deterministic random 15 (seeded LCG; gn-1790437, gn-1253184, gn-1233369, gn-5405380, gn-5379439, gn-4221552, gn-3441575, gn-1817993, gn-1787746, gn-3598132, gn-1714201, gn-2800866, gn-1270583, gn-2653261, gn-491422 — 15/15 pass) and all 14 converted rejections checked in item 6. I also traced **all 470 quotes (94×5): 470/470 are verbatim spans (whitespace-collapsed) of the extract whose article label they cite, all ≥24 chars, 0 failures.**

Semantic rulings on the 4 named judgment calls (the validator explicitly cannot judge these; the prompt §2 bars can):

- **Alor Setar gn-1736309, tier 2 — PASSES.** Section extract goes well beyond its label: "very lengthy wet season," precipitation *even during the short dry season* (a paradox-flavoured detail), consistent ~32 °C highs. The clue uses the lengthy wet season + rain in the dry season + year-round heat. Seasonal rhythm + paradox, verbatim-traced. Not a hollow pass.
- **Bonn gn-2946447, tier 2 — PASSES, thin.** The clue ignores the Cfb label entirely and cites the section's superlative — "in one of Germany's warmest regions" — which is the prompt's "cite the extreme" in relative form. Thin, but place-specific and above the bare-label bar. (Minor unrelated note: tier 1's second sentence is a spelled-out population figure — census filler in spirit, §3 rule 2; it is incidental to the geography anchor, not the tier's payload. Coordinator may clean it, non-blocking for this ruling.)
- **Tarakan gn-1624725, tier 2 — HOLLOW PASS. FAILS prompt §2.** The entire climate section is one sentence: "Tarakan has a tropical rainforest climate (Af) with heavy rainfall year-round." That is a classification label plus the generic defining trait of every Af climate — no mechanism, no extreme/record (no amounts), no paradox, no seasonal rhythm (the clue's "no dry time" merely restates "year-round"). **Decisive comparator inside the same wave:** Blackburn gn-2655524 was converted to a rejection because its geography section states a temperate maritime climate "like much of the British Isles," with relatively cool summers, mild winters, and regular light precipitation — i.e. *more* climate content (seasonal contrast + precipitation pattern) than Tarakan's one-liner — and was judged "no place-specific mechanism, extreme, record, or distinct seasonal rhythm." Paarl (label only) and Gorzów (labels only) were likewise converted. Applying that same standard consistently, Tarakan cannot stand. The set is defective on a second tier as well: **tier 5 is a mid-2024 population estimate ("more than a quarter of a million souls")** — census filler banned by §3 rule 2, and not the §2 tier-5 "single most confirming fact / iconic landmark"; it evades the validator only because the count is spelled out in words. Tier 4 also repeats tier 1's co-extensive-boundaries fact. **No repair is possible:** the input contains no other climate material. Correct disposition: fail-closed tier-2 rejection.
- **Dumaguete gn-1714201, tier 3 — HOLLOW PASS. FAILS prompt §2 tier 3.** The tier-3 contract is "exactly one discriminating detail — a founding year + founder, or a single defining event." The clue/quote offers neither: "best known for Silliman University, the first Protestant and American university in the country and in Asia" is a present-day status/record about a university — no year, no founder, no event — and it duplicates tier 4 (the university-city clue). I read the full lead extract: it contains no founding or defining-event material at all (2024 census, four universities, UNESCO 2025 designation, boundaries, geothermal plant). That is precisely the profile the coordinator converted at tier 3 five times in this wave (Richardson, Balneário Camboriú, Pulilan, Cabo San Lucas, Arnhem — "lead is a present-day profile with no founding year, founder, or defining historical event"). Dumaguete is the same class, accepted. **No repair is possible** from the lead. Correct disposition: fail-closed tier-3 rejection.

Random-15 semantic spot-read (beyond the mechanical pass): most are genuinely strong (Zhuhai, Vijayawada, Vallejo, Ontario, Montevideo, Anqing, Cheltenham — mechanisms/records/founding details present). Watch items, not counted as proven defects: Negombo tier 3 ("fished for hundreds of years" — vague, no detail), Sochi tier 3 (2018 World Cup hosting — an event, but hook-like and adjacent to its tier-5 Olympics), Savannah tier 5 (population ranking as giveaway — same weakness class as Tarakan tier 5, though less central). The coordinator should re-read these three before the next wave's standard hardens.

## Item 4 — Assembly correctness — PASS (verified on all 323 files, not a sample)

- `public/loop/clues/*.json` count = **323**; indices 0–322 contiguous, no extras; `public/loop/manifest.json` = `{"v":1,"size":323,"generatedAt":"2026-10-04T18:17:13.474Z"}` — manifest size 323.
- `records-tier2.jsonl`: 8,690 records, **323 accepted**, 8,367 rejected, 8,690 unique ids. Wave-1 accepted (94) are a subset of the union accepted, byte-identical in the union; union accepted minus wave-1 = **229** = the certified milestone-0 baseline. 229 + 94 = 323 confirmed arithmetically and set-wise.
- Every published file's `placeId` (`geonames:<n>`) maps to an accepted union record, and every accepted union record is published (bijection, 323 ↔ 323).
- **Full comparison:** for all 323, the published file is exactly `assemblePublishedFile()` (shipped `compose-clues.mjs`) applied to the accepted record in pool fame-rank order — **0 mismatches**. Field-by-field spot-checks (indices 0 gn-1605245 Ubon Ratchathani, 80 gn-3691175 Trujillo, 160 gn-1675151 Hsinchu, 240 gn-5983720 Iqaluit, 322 gn-3191631 Risan): all 5 clue texts identical to the record, target lat/lon identical, source href matches the record's tier-1 source URL.
- Bookkeeping note (non-blocking): the current 323 assembly report is `assembly-report.json` (published 323, leak 0/1,615, difficulty {1:4, 2:38, 3:104, 4:149, 5:28}); `assembly-report-tier2.json` is the stale milestone-0 report (229). Don't cite the wrong file in later milestones.

## Item 5 — Independent leak scan — PASS, 0 hits

My own implementation (schema `foldText`, my own term construction: name + answer aliases + pool curated aliases + name parts ≥3 chars) over **all 1,615 published clue texts (323 files × 5): 0 hits.** Repeated with the validator's `buildLeakTerms`/`findLeaks` plus the whole-file scan with the source href scrubbed: **0 hits.** This independently reproduces the assembler's claimed 0/1,615.

## Item 6 — The 14 honest conversions — PASS (14/14 correctly fail-closed)

All 14 are `rejected` in `records-tier2-wave1.jsonl` at the tiers and for the reasons the run-state states. I deep-checked 10+ against the actual input extracts (all 14 extract inventories verified):

- **No section extract in input — confirmed, input really has exactly 1 extract (lead only):** San Pedro gn-1688749 (951 chars; patron saint / dormitory town / 2013 cityhood, no climate), Zipaquirá gn-3665542 (salt cathedral / colonial / train, no climate), Ladysmith gn-984998 (naming, 1899–1900 siege, 2024 rename — history exists, but tier 2 fails first in ladder order, so a tier-2 rejection is the correct first-failure), Fatih gn-747158 (848 chars; bounds / peninsula / provincial offices, no climate — verified: exactly one extract), Kumbo gn-2229748 (elevation / settlements / horse racing / medicine, no climate).
- **Bare-label climate sections — confirmed verbatim:** Paarl gn-3363094 (section is 48 chars: "Paarl has a Mediterranean climate (Köppen: Csa)."), Gorzów gn-3098722 (section is two alternate Köppen labels, Cfb or Dfb, nothing else).
- **Generic / landscape-only sections — confirmed:** Blackburn gn-2655524 (geography section's climate sentence is the generic British-Isles pattern quoted in the rejection — see the Tarakan comparator problem in item 3), Kluang gn-1732811 (geography section = undulating hills, Gunung Lambak, three rivers; landscape only, no climate signal).
- **Leads with no founding/defining-event history — confirmed by full lead reads:** Richardson gn-4722625 (only year in lead: 2020 census), Balneário Camboriú gn-3471039 (tourism profile; name meaning explicitly unknown), Pulilan gn-1692565 (years are 2024 census / recent growth), Cabo San Lucas gn-3985710 (only year: 2020 census), Arnhem gn-2759661 (present-day profile: schools, museum, zoo, park, ship namesake; its climate section's foothill-precipitation mechanism makes the stated "tier 2 passes narrowly" plausible, and tier 3 still fails first at history).

Classification is honest and, for Ladysmith/Kluang, correctly ladder-ordered (an earlier tier fails before any later pass is considered). **The problem is not these conversions — it is that the same standard was not applied to Tarakan and Dumaguete (item 3).**

## Item 7 — Disclosures — handled honestly; no contamination in the final artifacts

Read in full in `tier2-run-state.md` (wave-1 sections). My judgment, on evidence I could re-derive:

- **Worker delivery-channel fault / wrong-job deliveries discarded:** the discarded content is by definition not on disk, so I cannot replay it — but the final state bears the fingerprints of the described id-verification having actually been done: all 10 out files' place_ids match their job files **position-by-position in order**, all 94 accepted records pass `validateRecord` against *their own* inputs (answer-block identity binding), and **470/470 quotes trace to each record's own cited extract**. Rotated or wrong-job content cannot produce that. Consistent with the disclosure; no counter-evidence.
- **Job-5 fabrication self-report:** Victoria gn-6174041 and Detroit gn-4990729 tier-2 quotes, flagged by the worker as possibly fabricated, are in their current form **verbatim** — Victoria: "Over 60% of the annual precipitation falls during the four wettest months, November to February at Gonzales Heights." (in the Victoria Climate-section extract); Detroit: "Winters are cold, with moderate snowfall and temperatures not rising above freezing on an average 44 days annually" (in the Detroit Climate-section extract). All 10 quotes across the two records trace verbatim. The never-delivered records 15–20: `tranches/tier2-jobs/wave1-job5-tail.json` contains **exactly** job 5's last six places (ranks 102–107: Banja Luka, Paarl, Willemstad, Clarksville, Islamabad, Bareilly), matching the disclosed fresh-worker tail re-do, and the final job-5 out file is order-identical to the job.
- **Repair workers discarded wholesale / all repairs coordinator-authored:** again consistent with the final state — the re-fold reproduces the committed records byte-identically from the on-disk out files, so whatever the repair channel produced, what reached `records-tier2-wave1.jsonl` and `public/loop` is exactly the coordinator-authored, locally-validated set, with the 14 conversions enumerated in the run-state matching the records one-for-one (item 6). No cross-contamination (e.g. rotated quotes) is present in the final records: the 470/470 own-extract quote trace rules it out.

The two hollow accepts in item 3 are judgment errors by the coordinator-as-repairer, not contamination and not concealment — both records sit in plain sight, quotes genuine, and the run-state even names the standard ("bare Köppen label only," "leads contain no founding/defining-event history") that they fail.

---

## Required fixes before certification (coordinator to fix; reviewer fixes nothing)

1. Convert **Tarakan gn-1624725** to a fail-closed tier-2 rejection (no climate mechanism/extreme/paradox in the input beyond the Af label + generic heavy-rainfall trait; tier 5 census giveaway noted as a secondary defect).
2. Convert **Dumaguete gn-1714201** to a fail-closed tier-3 rejection (lead contains no founding year/founder or defining event; tier-3 clue is a university status record duplicating tier 4).
3. Re-fold wave 1 (expected: attempted 200 / accepted **92** / rejected 108), rebuild the union (accepted **321**), re-assemble `public/loop` (manifest **321**, leak scan re-run), update `tier2-run-state.md` and the wave-1 commit trail accordingly.
4. Re-read the three watch items from item 3 (Negombo gn-1233369 tier 3, Sochi gn-491422 tier 3, Savannah gn-4221552 tier 5) and either defend them in the run-state against the prompt bars or convert them too — a ruling either way, on the record.

**What is certified now, without reservation:** locked-file integrity; wave-1 accounting (200/94/106/0 as-folded); fold reproducibility (byte-identical); quote integrity (470/470); assembly mechanics (323 ↔ 323, full-file comparison clean); leak safety (0/1,615, two methods); all 14 conversions; honest handling of all three disclosures. The milestone fails certification solely because 2 of its 94 accepts do not clear the locked prompt's tier bars — the exact failure mode this run's fail-closed design exists to prevent.

---
**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers above derived first-hand in this session from the raw records, inputs, job/out files, published files, and re-run shipped validator/assembler library code; intermediate outputs written only to `/tmp`.
