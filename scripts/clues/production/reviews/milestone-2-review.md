# Milestone 2 (Wave 2) — Independent Review (tier-2 expansion run)

**Reviewer:** Independent reviewer, `testing_reality_checker` persona (default: NEEDS WORK; certify only on overwhelming evidence). Not a generation worker, not the coordinator.
**Branch / HEAD reviewed:** `feat/geodetective-clues` @ `2a800d59f54ca25245a2045142ffbc02e8148638` (verified first-hand; tree clean at start and end of review)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`

## VERDICT: NEEDS WORK

One hollow accept blocks certification: **Varna gn-726050, tier 3**. Everything else in wave 2 — locked hashes, fold accounting, byte-identical re-fold, 345/345 verbatim quotes, tier sourcing, assembly mechanics, leak safety, cumulative arithmetic, and the other seven flagged borderline sets — certifies on first-hand evidence, detailed below. The required remedy is the milestone-1 standard one: convert Varna to an honest tier-3 rejection and re-assemble. That yields **388 assembled sets (229 + 91 + 68)**, still ≥ the 365 target with a 23-set buffer.

**Final certified assembled total as I find it: 389 assembled on disk; 388 certifiable — 68 of wave 2's 69 accepts certified, Varna withheld.**

---

## 1. Locked hashes — PASS (exact)

```
7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a  scripts/clues/generation-prompt.md
22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4  scripts/clues/production/validate-production.mjs
```
Both match the required values exactly.

## 2. Wave-2 counts re-derived; re-fold byte-identical — PASS

- **Position verification:** all 10 out files (`tranches/tier2-out/wave2/wave2-job{1..10}.jsonl`) checked position-by-position against their job files: **200/200 place_ids in exact job order**; job ids equal the wave-2 input ids in order; job ranks run 218..425 as claimed.
- **Records re-derived** from `records-tier2-wave2.jsonl` myself: 200 total / **69 accepted / 131 rejected**; worker-rejection tier histogram re-derived: **climate 87, history 41, hook 3** (= 131). Matches `validation-stats-tier2-wave2.json` in every field (attempted 200, validatorRejected 0, malformed 0, pipelineIssues []).
- **Independent re-fold:** I re-ran the shipped `validate-production.mjs` myself (wave-2 inputs, wave-2 out dir, outputs to `/tmp` only). Regenerated records are **byte-identical** (`cmp` clean) to the committed `records-tier2-wave2.jsonl`; regenerated stats identical to the committed stats. All 69 accepted out-file records pass into the records file verbatim (69/69), and all 200 wave-2 records sit verbatim in the union file (200/200).

## 3. Re-validation, quote trace, tier sourcing — PASS

- Shipped `validateRecord` (via `revalidate-union.mjs`) against `.scratch/geodetective/tier2-inputs-wave2.jsonl`: **69/69 accepted records valid, 0 failures**.
- My own trace: **345/345 quotes** (69 × 5) are verbatim spans (whitespace-collapsed) of the extract whose article label they cite; every cited article exists in the input and every source URL matches its extract's URL.
- Tier sourcing: tier 2 cites the section extract in 69/69 cases (lead-or-section allowed); **tiers 1/3/4/5 cite the lead only in 276/276 cases** — 0 sourcing violations.

## 4. Semantic rulings on the worker-flagged borderline accepts

Bars applied: locked prompt (tier 2 = place-specific mechanism / extreme / record / seasonal rhythm / paradox traceable to its quote — a classification label alone fails; tier 3 = founding year+founder or one defining event — a status/record fact stretched into history fails; tier 5 = the single most confirming fact, not census/ranking/summary) and the milestone-1 precedents (Tarakan, Gorzów, Blackburn converted for label/generic climate; Dumaguete, Negombo converted for non-event history).

| Place | Flag | Ruling |
|---|---|---|
| Gaziantep gn-314830 | T2 snow stats beyond the label | **PASS (narrow).** Not a bare label: the quote carries a quantified snow regime (4.6 snowy days/winter, 10 days of snow cover, 2.5 hail days) and the text's payload ("snow often lies on the ground for days") traces to it. Snow cover is a specific, mildly paradoxical datum for a hot-summer Mediterranean city — more than Gorzów's label-only or Tarakan's label+generic trait. Weakness noted: the stats are 1966 vintage. |
| Magnitogorsk gn-532288 | T2 paradox; T3 planned-settlement establishment | **PASS both.** T2: the quote states the paradox verbatim ("relatively severe winters for the latitude") plus the mechanism (far from large bodies of water); the text renders both. T3: establishment as a planned socialist-realist settlement *is* this city's founding event — discrete, era-anchored (Cold War), and discriminating ("one of a small number"). Not a status/record fact stretched into history. |
| Guarapuava gn-3461879 | T2 dated temperature records | **PASS.** Dated extremes are records within the prompt's terms: record high of only 33 °C (Feb 1984) against a −6.8 °C record low (Dec 1982) and sub-freezing winter days — a place-specific extreme profile, no label involved. (T3 also sound: founded 1810. T5 "largest municipality by area" is ranking-flavored but a durable geographic superlative — watch item, not a failure.) |
| Varna gn-726050 | T2 moderation mechanism; T3 origin detail | **T2 PASS; T3 FAIL — the set is a hollow accept.** T2 states a real mechanism ("sea influence lowers the effect of the occasional cold air masses from the north-east", milder than inland). T3, however, is: "grew up from a shore camp of the Thracian folk of old. In time it rose to be a great port." No founding year, no founder, no discrete defining event, and no temporal anchor of any kind — a gradual developmental arc whose second sentence is pure summary. This is the Negombo/Dumaguete class: real content in the wrong category. Calibration: 61/69 wave-2 tier-3 texts carry a year; of the 8 that don't, Varna is the only one with neither a century anchor nor a discrete event. The lead offers no compliant alternative (the necropolis/oldest-gold fact is tier 4's; "centre for almost three millennia" is status). |
| Bishkek gn-1528675 | T2 shielding/fog mechanism | **PASS.** Two traceable mechanisms: southern mountains as a natural boundary protecting from damaging weather (cited quote), and winter fog that can last for days under inversions (same section extract). T3 is exemplary (fortress founded 1825 by the Khanate of Kokand, with purpose). |
| Mostar gn-3194828 | T3 = Suleiman's bridge commission | **PASS.** A named ruler commissioning the city's defining bridge in the 16th century is a single defining event — the functional equivalent of founder+era, and it discriminates. Notes (non-blocking): tiers 3 and 4 both rest on the Old Bridge (event vs. heritage status — acceptable separation), and tier 5's "its own name… just means Old Bridge" is ambiguous in isolation; its narrowing ("confirms it by its famed Old Bridge") resolves the antecedent to the bridge, and Stari Most does mean Old Bridge, so the statement is accurate under that parse. |
| Palmas gn-3474574 | T2 paradox | **PASS, clearly.** The paradox is verbatim ("summer (December to February) is the rainiest and coldest season") with its mechanism (heavy summer rain cools maximum temperatures). T3 also sound (founded 1990 as capital of the new state). |
| Pyeongtaek gn-1838343 | T2 from province records | **PASS.** Province records are records: warmest January and hottest August in Gyeonggi Province, lowest provincial precipitation, plus the mechanism (low orographic rainfall occurrence). Not a label restatement. T3 also sound (founded 1940 as a union of two districts). |

### Random spot-reads (seeded sample, 12 of the remaining 61 accepts) — 12/12 PASS

Cuiabá gn-3465038, Nijmegen gn-2750053, Brownsville gn-4676740, Southend-on-Sea gn-2637433, Manaus gn-3663517, Cavite City gn-1717641, Newark gn-5101798, Vilnius gn-593116, Ufa gn-479561, El Obeid gn-379003, Malmö gn-2692969, Bremerhaven gn-2944368. Every set read in full against its lead + section. No hollow tier 2 (mechanisms/paradoxes/records throughout: Cuiabá's dry-air mass, Manaus's hotter winter, El Obeid's evapotranspiration paradox, Malmö's Gulf Stream, Newark's freezing-isotherm/Turnpike quirk), no non-event tier 3, no census tier 5. Watch-level soft spots, none in the milestone-1 failure classes: Cavite City T2 (Aw label + pronounced wet/dry seasonal rhythm — "seasonal rhythm" is an accepted category, and the months are exact) and T3 (provincial-seat tenure from 1614 — a dated institutional event, not a superlative); Bremerhaven T2 (snow-persistence trait) and T5 (partly recaps tier 4's exclave fact); Brownsville T5 and Ufa T5 (profile-style but concrete giveaways).

I also read Mohali gn-6992326, Jodhpur gn-1268865, and Gqeberha gn-964420 in full (see §6): Jodhpur and Gqeberha are solid (1459 + clan chief; 1820 + named founder). Mohali passes with watch items: T3 is a dated administrative event (2006 district carve-out — the weakest passing history class, same class as Cavite City's 1614 tenure, and a class the wave's own workers rejected elsewhere when it was *all* a lead offered, cf. gn-179330); T2 is an explicit "seasonal rhythm" quote with winter frost.

### False-reject spot-check (seeded sample, 6 of 131 worker rejections) — 6/6 true rejects

- George gn-1002145 (history): full 696-char lead read — naming after George III (a banned name payload), Botha's burial place, Garden Route hub. No founding/event. Correct.
- Thika gn-179330 (history): full lead read — district splits (1994/2009) and a famous memoir only; admin dates are not a founding. Correct.
- Gabela gn-3348613 (climate): no section extract supplied; lead offers only a savanna/woodland vegetation label. Climate unsourceable; ladder order correct (its 1907 founding never gets reached). Correct.
- Montpellier gn-2992166 (climate): Csa label + generic Mediterranean pattern; the section's extreme-temperature *values are blank in the extract*, so no record is sourceable — the exact distinction that separates it from Gaziantep's numbered snow regime. Correct.
- Gandhinagar gn-1271715 (history): full 825-char lead read — present-day profile, temple, planners' apprenticeship. No founding year/date, no defining event. Correct.
- Ferrara gn-3177090 (climate): the section itself frames its content as the Po-valley *regional* classification — the Blackburn precedent applied correctly by the worker. Correct.

## 5. Assembly — PASS

- Published files: **389**, indices 0–388 contiguous; `public/loop/manifest.json` size **389**; union accepted **389** — all three counts agree.
- Bijection published ↔ union accepted: **389 ↔ 389**, 0 in either difference.
- Full comparison (not a sample): every published file equals the shipped `assemblePublishedFile` output for its record — **389/389 identical, 0 mismatches**.
- Order: published sequence is strictly increasing in pool fame rank (rank range 1..10193) — published order = pool fame order.

## 6. Leak scan — PASS (0 hits under the locked rule; naive-scan hits adjudicated)

- Shipped method (`buildLeakTerms`/`findLeaks` + whole-file scan with href scrubbed), re-run by me over all **1,945** published clue texts: **0 hits** — matches `assembly-report.json`.
- My own independent implementation (NFD accent-folding, splitting multi-word aliases into parts ≥4 chars — deliberately stricter than the locked rule) produced 29 hits, **all adjudicated as non-leaks**: generic words that are parts of multi-word aliases ("city", "port", "point", "summer", "crossing"), country/region names legitimately stated at tier 1 ("Iran", "Philippines", "Haryana", "Pacific"), a comparison town's name inside a nickname retelling (baseline place Chhachhrauli), and one substantive case — **Mohali gn-6992326 tier 5** names Sahibzada Ajit Singh, the person the city is officially named after. Ruling: **not a leak under the locked rule.** Prompt §4 bans the canonical name or any part of it, any recorded alias *as a substring*, and demonyms; the recorded alias is the full string "Sahibzada Ajit Singh Nagar", which never appears, and §4 explicitly allows "people… that do not contain the name" as decisive tier 4–5 material. The person's name contains no part of "Mohali". The shipped validator implements exactly this locked reading; I do not substitute my stricter one. Recorded here for transparency, not as a defect.

## 7. Cumulative arithmetic — PASS

Set-wise, from the raw files: baseline-in-union accepted = **229**, wave-1 accepted = **91**, wave-2 accepted = **69**; pairwise intersections all **0** (wave1 ∩ wave2 = 0; baseline ∩ waves = 0 by construction and verified); union accepted = **389** = 229 + 91 + 69. Wave-1's certified 91 (not the pre-fix 94) is what the union contains.

## Required fix before certification

1. **Convert Varna gn-726050 to a tier-3 (history) rejection** in the wave-2 out file, `records-tier2-wave2.jsonl`, and the union `records-tier2.jsonl` (reason class: lead gives a Thracian-settlement origin and three millennia as a centre, but no founding year+founder and no single defining event), then re-assemble and re-run the leak scan. Expected post-fix numbers: wave 2 = 200 / 68 / 132 (history 42); union accepted = **388**; manifest = 388; leak 0 / 1,940. Re-present for a narrow re-review of that conversion plus counts; everything else in this review stands unless contradicted.

Nothing else blocks. In particular, the coordinator's headline claims (200/69/131/0 first-pass fold, histogram 87/41/3, union 389, manifest 389, leak 0/1,945, 389 ≥ 365) all reproduced exactly from the raw records under my own runs — the single failure is semantic, in a set the generation worker themselves flagged.

---
**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers and texts above derived first-hand in this session from the raw records, job files, wave-2 inputs, published files, the shipped validator/fold/assembly code run locally, and `git show` on the wave-2 commit; intermediate scripts written only to `/tmp`. No file modified except this review.
