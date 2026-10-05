# Tier-2 source expansion — scoping report

**Date:** 2026-10-04 · **Branch:** `feat/geodetective-clues` · **Status:** SCOPING ONLY.
The Option A sweep stays paused (186/365 accepted; `public/loop/` still holds the
Phase 2 assembly of 63). Nothing in this report is a production run: no waves
beyond the sample, no assembly, no validator change. Locked rules stand
throughout — this scopes widening the **input**, never the rules.

**Question (Liz):** lead sections — even the fuller Option A leads — carry no
traceable climate mechanism for most places. Would pulling each article's
**Climate section** (Geography section as fallback) as additional tier-2 source
material move the yield?

**Answer in one paragraph:** Yes — decisively, for the places that have a real
Climate section. In a stratified sample of 200 climate-rejected places, adding
the section to the input lifted full-set acceptance from **0%** (this
population's prior outcome) to **21.5%** (43/200, validator-clean), a **12×**
multiple of the 1.77% Option A baseline — and every one of the 43 accepted
tier-2 clues quotes the section, so the delta is entirely attributable to the
widened input. The yield is concentrated where the fame is: band 1 (fame-top
quintile of the rejected population) converted at 45%, band 5 at 2.5%. The
remaining 179 sets needed for 365 project to close within roughly the first
**400–600 fame-ordered re-attempts** — about 3 generation waves — not a full
8,000-place sweep. The fetch itself is nearly free (minutes); generation
effort is the real cost, and it is small at the fame-ordered staging.

---

## 1. The approach (what a full-scale run would look like)

**Input contract.** Each place's §9 input becomes a union of two extracts from
the *same* matched article (same source, same CC BY-SA license/attribution, no
re-matching — the recorded title from the original crawl decides the article):

- `extracts[0]` — the fuller lead, exactly as in Option A.
- `extracts[1]` — the article's **Climate section** plaintext, labeled
  `"<Article> (Climate section)"` with an anchored URL
  (`https://en.wikipedia.org/wiki/<Article>#Climate`); if no climate heading
  exists, the **Geography section** instead (`(Geography section)`, `#Geography`
  anchor); if neither exists, no second extract.

Tier 2 may quote/cite **either** extract (citing the exact label of the extract
quoted — the shipped validator traces each quote against the extract its
citation names, so provenance is mechanical). Tiers 1/3/4/5 stay **lead-only**,
exactly as in the Option A run. The distinct section label is what makes the
union work with the validator **unchanged**.

**Fetch mechanics** (`scripts/clues/fetch-climate-sections.mjs`, committed with
tests). One batched MediaWiki `action=query&prop=revisions&rvprop=content`
request per 20 titles returns full page wikitext (the same politeness shape as
the lead fetcher: batches, 350 ms delay, maxlag=5, retries, append-only
resumable cache in `.scratch`, never committed). Sections are sliced locally
from the wikitext — headings are unambiguous `==` markers, and local slicing
keeps subsections attached (64 of the sample's 93 climate sections live under a
parent, e.g. *Geography > Climate*; a per-section API fetch would split them
away and cost 2 requests/place). Section choice: exact `Climate` heading
first, then headings starting with `climate`, then containing `climate`
(document order breaks ties); Geography by the same tiers as fallback.
Wikitext is reduced to prose: tables and templates are removed (climate-chart
templates are tabular data, not quotable prose), refs/comments/tags stripped,
links resolved to display text.

**Staging at full scale (for approval, not yet run):**

1. Fetch sections for the 7,997 climate-rejected places (minutes — §2).
   Optionally also the 2,382 unattempted pool places in the same pass.
2. Build union inputs v2 (`build-scope-inputs.mjs` generalizes directly).
3. Generation waves in **fame order** over the climate-rejected population
   until the union reaches ≥365 with margin — projected ≈3 waves of 200 —
   then stop; no population sweep.
4. Fold all records through the shipped validator, re-validate the union,
   assemble, leak-scan, report v2, full gates — the established finish.

## 2. Fetch cost — measured, and the full-scale projection

Measured on the sample (200 places, one run, no retries needed):

| Measure | Sample (200) | Per place | Full scale (7,997 climate-rejected) | All generatable (10,582) |
|---|---|---|---|---|
| HTTP requests | 10 | 0.05 | ≈400 | ≈530 |
| Wall time | 8.0 s | 0.04 s | ≈5–6 min at measured throughput (≈2.2 min at the 3 req/s politeness ceiling) | ≈7–8 min |
| Data received | 8.72 MB | ≈44 KB | ≈350 MB transient wikitext | ≈460 MB |
| Stored section text | 146 KB | ≈0.75 KB | ≈6 MB | ≈8 MB |

Failures in the sample: **0** missing pages, **0** errors. The fetch is not the
cost driver at any scale — generation is (≈40 waves of 200 to re-attempt the
whole rejected population; ≈3 waves at the fame-ordered staging in §1).

## 3. Section availability (sample of 200)

| Outcome | Count | Share |
|---|---|---|
| Climate section found | 93 | 46.5% |
| Geography fallback used | 35 | 17.5% |
| Neither section | 72 | 36.0% |
| Page missing / fetch error | 0 | 0% |

Section length (the 128 found): median **83 words**, p25 43, p75 151, max 597;
36 sections under 50 words, 24 at 200+ words. Heading variance handled:
`Climate` ×85, `Geography` ×33, `Geography and climate` ×7 (sliced whole — it
carries both), `Climate and weather` ×1, `Geography and boundaries` ×1,
`Demographics and geography` ×1.

## 4. Yield delta — the decision numbers

Sample design (reproducible: `build-scope-sample.mjs`, `scope-sample.json`):
population = the **7,997** worker climate-rejections in `records-full.jsonl`
(the one validator-converted climate rejection, Cockermouth gn-2652676, is
excluded — it is a worker/validator disagreement, not a worker failure).
Stratified draw: population sorted by pool fame rank, split into 5 contiguous
bands (~1,600 each), 40 drawn per band with mulberry32 **seed 20261004**.
Sample ranks span 37–8,229. All 200 re-attempted under the adopted prompt with
the union input; results folded through the **shipped production validator,
unchanged**: 200 attempted, **0 validator rejections, 0 malformed records**.

| Metric | Sample result | Baselines |
|---|---|---|
| **Full-set acceptance** | **43/200 = 21.5%** (Wilson 95% CI 16.4–27.7%) | 0% — this population's prior outcome; 1.77% — Option A cumulative baseline (99/5,600) |
| **Tier-2 pass rate** | **66/200 = 33.0%** | 0% prior (all 200 were climate rejections) |
| Post-climate funnel (of the 66) | 43 accepted (65%), then history 16, giveaway 6, hook 1 rejected | history becomes the #2 wall once climate opens |

Acceptance by fame band (sample): band 1 **18/40 (45%)**, band 2 **13/40
(32.5%)**, band 3 **8/40 (20%)**, band 4 **3/40 (7.5%)**, band 5 **1/40 (2.5%)**.
Tier-2 pass by band: 27/16/13/7/3 of 40.

Acceptance by section availability — the mechanism, isolated:

| Input the place actually got | n | Tier-2 pass | Fully accepted |
|---|---|---|---|
| Climate section | 93 | 62 (66.7%) | **42 (45.2%)** |
| Geography fallback | 35 | 4 (11.4%) | 1 (2.9%) |
| No section (lead only, again) | 72 | 0 (0%) | 0 (0%) |

All **43** accepted sets cite the **section** extract at tier 2 (43/43) — none
would exist under the old input. The no-section control arm re-failed at
climate 72/72, confirming the sample apparatus itself changed nothing.

**Full-scale projection.** Applying the stratified sample rate to the 7,997
climate-rejected population: **+1,719 accepted** (CI +1,310…+2,215), i.e. a
union of roughly **1,500–2,400** total sets. Only **+179** are needed. At the
fame-ordered staging, band 1 alone (~1,600 places at a 45% sample rate, CI
floor ≈30%) projects several hundred accepts; the shortfall closes within
≈400–600 re-attempts with high confidence. Bands 4–5 contribute little
(7.5%/2.5%) — a full-population sweep would spend most of its effort there for
almost nothing. The 2,382 unattempted places are **not** covered by this
estimate (never lead-attempted; with-section yield unmeasured — upside only).

## 5. Validator-gap notes (critic's read of the sample)

The coordinator read the tier-2 clue **and its verbatim quote** for all 43
accepted sets, against the known lead-only flags (Karaj gn-128747 — hollow;
Torquay, San Antonio Oeste, Sisimiut, Kawambwa, Palestina — borderline).

- **No clear Karaj-class hollow pass in the sample (0/43).** In the lead-only
  run, 6 of 123 accepted sets carried semantic flags (≈5%). Section prose is
  mechanism prose — rain shadows (Fremont, Port Angeles), orographic drying
  (Peace River), maritime moderation (Anchorage, Gwadar, Newport), monsoon
  rhythms (Kochi, Colombo, Bintulu) — so the quote itself usually *is* the
  teaching content, and the hollow shape (real quote, signal word, no content)
  gets rarer, not commoner. Small-n caveat: 43 reads vs 123.
- **Thinnest pass — Puerto San José gn-3591060 (flagged, Karaj-adjacent).**
  Its quote is the Köppen label plus season boundaries ("wet season May to
  October, dry November to April") and the clue restates exactly that. It
  qualifies under the established *seasonal rhythms qualify* adjudication, but
  it is the floor of that class — the one sample set a human reviewer should
  look at first.
- **Interpretive stretch — Segovia gn-3109256.** The clue calls the province
  "a damp corner of the wide central plateau"; its quote supports altitude/
  distance-from-coast shaping and summer storms, but "damp corner" leans
  harder than the quote's emphasis. Worth a human look; not a fabrication —
  every stated fact traces.
- **Superlative on a stripped figure — Wolfsburg gn-2806654.** The clue's
  "more scarce than in most of Germany" rests on the quote's tail ("lowest
  tenth… only 7% of stations record lower") after the precipitation figure
  itself was template-stripped (see below). Traceable, but the pattern —
  comparative claims surviving while their numbers vanish — will recur at
  scale.
- **Reverse gap — rich sections that still fail, correctly.** 9 places with
  ≥200-word sections still failed at climate (e.g. Matlock gn-2642910 — its
  section's only event content is a one-off November 2019 flood, excluded by
  the standing adjudication; Jayapura gn-2082600, Marysville gn-5802570,
  Calais gn-3029162 — long classification/data prose). The wall is real
  content shape, not section length.
- **Fetch-fidelity loss (new, quantified qualitatively).** Numbers carried by
  templates (`{{convert}}`, climate-data templates) vanish in wikitext→text
  conversion. Marblehead's climate section states hottest/coldest **record
  dates**, but the temperature values are template-borne and were stripped —
  the record exists in the article yet is unquotable in the fetched input, and
  the place re-failed at climate. The same holes appear inside otherwise-good
  quotes ("a January mean temperature of .", "precipitation … about per year").
  How much full-scale yield this costs is unmeasured; it is strictly a loss —
  a higher-fidelity converter could only add accepts.
- **No new hollow-pass shape** was created by the section input beyond the
  thin-rhythm floor case above. One shape to watch at scale: *season-boundary
  recitation* (wet/dry month ranges with nothing else) — it appears once here
  and sits inside an accepted adjudication class, so the validator cannot and
  should not catch it; human sampling owns it.

## 6. Risks / unknowns for a full-scale decision

1. **Fame concentration.** The fix works where fame is. If the goal were
   coverage of the whole rejected population rather than reaching 365, this
   approach would disappoint (bands 4–5: 7.5%/2.5%). For the 365 target it is
   more than sufficient.
2. **Availability may dip at scale.** 64% section availability in-sample;
   heading idiosyncrasy grows down the fame ranking, so the full-population
   rate will likely be somewhat lower. The fame-ordered staging is insulated
   from this (it stops early).
3. **Adjudication variance.** Per-worker sample acceptance ranged 0–10 per 20
   (partly band mix — fame-top jobs convert more). Projections inherit worker
   variance; the validator remains the floor, human sampling the ceiling.
4. **Template-value loss** (§5) silently caps some unknown fraction of
   climate-section holders.
5. **Sample accepted sets' status.** The 43 are validated records in
   `records-scope.jsonl`, deliberately **not** assembled and not counted in
   the 186. A full run must fold them in or re-generate those places —
   see open questions.

## 7. Open questions (for Liz/Veeresh — not decided here)

1. Fold the sample's 43 accepted records into a full-scale run, or re-generate
   those 43 places under the run for uniformity?
2. May the section extract also source **other tiers** at full scale? This
   scope held tiers 1/3/4/5 to the lead by design; 16 history + 6 giveaway
   sample rejections might partly be sourceable from Geography/History
   sections — a separate, larger input-widening decision.
3. Invest in a higher-fidelity section converter (template values,
   climate-chart data) to recover Marblehead-class losses, or accept the
   loss? (Fetch-side change only; no rule implications.)
4. Keep the Geography fallback at scale? Direct yield is near zero (1/35
   accepted) at zero marginal fetch cost; 3 of its 4 tier-2 passes died at
   later tiers — the fallback does open the climate gate, the lead closes
   the set.
5. Record tier-2 citation provenance (lead vs section) in production stats
   at full scale? No validator change was needed for this scope — the
   shipped validator validated union inputs as-is — but the stats would
   make the delta auditable per wave.

## Appendix — sample artifacts

- Draw: `scope-sample.json` (seed, band edges, the 200 IDs) ·
  `build-scope-sample.mjs`
- Fetch: `scripts/clues/fetch-climate-sections.mjs` (+11 tests) · raw cache
  `.scratch/geodetective/climate-sections.jsonl` (gitignored, rebuildable)
- Inputs/jobs: `build-scope-inputs.mjs` · `tranches/scope-jobs/scope-job1..10.json`
- Worker output: `tranches/scope-out/scope-job1..10.jsonl`
- Validated sample records: `records-scope.jsonl` ·
  `validation-stats-scope.json` (attempted 200, accepted 43, worker-rejected
  157 — climate 134, history 16, giveaway 6, hook 1; validator-rejected 0)
- The 43 accepted place IDs: gn-1269771, gn-4951788, gn-5350734, gn-4049979,
  gn-1273874, gn-3114472, gn-5879400, gn-3689147, gn-1791249, gn-2806654,
  gn-1259229, gn-2174003, gn-5387428, gn-2637627, gn-5367929, gn-1248991,
  gn-98463, gn-3980760, gn-480060, gn-1737486, gn-146384, gn-3180792,
  gn-3533389, gn-759603, gn-3109256, gn-655808, gn-5178195, gn-730565,
  gn-3164433, gn-2511700, gn-3459796, gn-602913, gn-2738752, gn-1177446,
  gn-3861824, gn-5223593, gn-5807212, gn-2170430, gn-5422534, gn-4953804,
  gn-1714264, gn-6100069, gn-3591060.
