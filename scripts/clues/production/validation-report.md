# GeoDetective clue production — validation report (Phase 2)

**Branch:** `feat/geodetective-clues` · **Base:** `origin/main` @ `de9b7a8`
**Spec:** `scripts/clues/generation-prompt.md` — byte-identical copy of the FINAL
generation prompt v1 (locked by Veeresh 2026-10-04),
sha256 `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a`.
**Verdict up front:** the production pipeline ran end-to-end under the locked
rules with zero rule loosening. **63 clue sets were accepted and published.**
The 365-set target is **not reachable from the crawl-cache extracts** under the
locked tier-2 (climate) rule — the extracts are short lead excerpts, and most
contain no sourceable climate substance. This was escalated to Liz/Veeresh
during the run; no decision to change the source or the rules had arrived when
production closed, so the run finished on the sanctioned inputs and reports
the shortfall plainly rather than padding it.

## Pool derivation (deterministic, reproducible)

Script: `scripts/clues/production/build-pool.mjs`; full write-up in
`pool-derivation.md`; evidence in `pool-evidence.jsonl`; output `pool.jsonl`.

1. Start: the live-main dataset — **124,690 places**.
2. Join to the crawl cache (`crawl-cache.jsonl`, read-only, never committed):
   **71,957 places** have a matched full Wikipedia extract.
3. Substance floor: extract ≥ 100 words → **10,645 candidates**.
   (Dataset difficulty mix of the pool: 1:1881, 2:2340, 3:3466, 4:1902, 5:1056.)
4. Fame rank (deterministic): dataset difficulty ascending, has-hook first,
   extract word count descending, place id ascending. Index/publish order is
   this rank.

Attempt queue (`build-attempt-queue.mjs` → `attempt-queue.jsonl`, 10,445 =
pool minus Wave 1's 200): climate-signal candidates first in fame order
(queue lines 1–1,789, screened by the validator's climate root-prefix check),
then the remaining 8,656 in fame order. Sequencing only — nothing was
excluded by the queue.

## Production outcome

| | count |
|---|---|
| Pool candidates | 10,645 |
| Attempted (worker-adjudicated) | **2,189** |
| Accepted (validator-passing, published) | **63** |
| Worker-rejected (§6 records) | 2,126 |
| Validator-rejected (final) | 0 |
| Malformed records (final) | 0 |
| Pipeline issues (dupes/orphans/missing) | 0 |
| Not attempted (see "Remainder disposition") | 8,456 |

Attempted = Wave 1 (pool fame ranks 1–200) + queue lines 1–1,989 (Waves 2–11).
That covers **all 1,789 climate-signal candidates** plus the 200 most famous
non-signal places as a control tranche.

**Worker rejection tiers (of 2,126):** climate **2,057**, history 66, hook 2,
giveaway 1. The climate tier is the binding constraint by an order of
magnitude: the locked rule rejects any set whose extract states only a
climate classification with no mechanism, extreme, or paradox, and the cache
extracts (hook-pipeline lead excerpts, median 47 words) rarely carry more.

**Validator rejections during production:** 19 worker-accepted records
initially failed validation — every one on writing-cap codes only
(`READING_LEVEL` predominating, plus `CLUE_SENTENCES` / `CLUE_WORDS` /
`SENTENCE_WORDS`). All 19 went through the repair loop (rewrite of flagged
clue texts only; coordinator re-verified each repair first-hand: validator
pass + answer block byte-identical + per-tier source quote and narrowing
byte-identical + changed tiers ⊆ flagged tiers) and were recovered. Final
validator-rejected count: **0**. No record was ever repaired by loosening a
rule.

**Yield by segment:** fame-top-200: 3/200 (1.5%). Climate-signal queue:
~3.4% per wave, ending at 63 accepted when the signal queue was exhausted.
Non-signal control tranche (Wave 11, the 200 most famous non-signal places):
**0/200**.

## Remainder disposition (8,456 places not worker-attempted)

The unattempted remainder is exactly the non-signal tail (queue lines
1990–10445): extracts with no climate-signal content at all, in fame order —
i.e. strictly weaker candidates than the Wave 11 control tranche, which
yielded 0/200 with every rejection at the climate tier. Running ~42 further
waves to generate §6 records for them would not change the accepted count in
any plausible outcome, so the sweep was closed at Wave 11 and the remainder
is reported here as **screened, not adjudicated** — no rejection records were
fabricated for places no worker read. If Liz/Veeresh want the full sweep's
rejection records, the queue, job builder, and briefs are all committed and
the run resumes at queue line 1990 (Wave 12) unchanged.

## Published output

- `public/loop/clues/{index}.json` — 63 files, game contract format
  (`{v:1, placeId:"geonames:N", target{lon,lat}, clues[5 strings, ladder
  order], source{label:"Wikipedia", href}}`), identity stripped per §10,
  index order = pool fame rank (index 0 = highest fame).
- `public/loop/manifest.json` — `{v:1, size:63, generatedAt}`.
- Full §10 audit records (with per-clue sources/quotes and all §6 rejection
  records) retained in `scripts/clues/production/records.jsonl` (2,189 lines).
- Published difficulty distribution (prompt §8 guessability): 1:2, 2:5,
  3:26, 4:22, 5:8.

**Leak scan over the published files (mechanical proof):** folded-substring
scan of every published clue text against the place's leak terms (canonical
name + recorded aliases + curated aliases), plus a whole-file scan with the
source href scrubbed: **63 files, 315 clue texts, 0 hits**
(`assembly-report.json`, produced by `assemble.mjs` at assembly time).

**Accepted sets (all 63, in publish order):** gn-3848950 La Rioja,
gn-128747 Karaj, gn-1728930 Baguio, gn-3644918 Cúa, gn-3183875 Tirana,
gn-1791544 Wenchang, gn-1650357 Bandung, gn-1788852 Xining, gn-3874787 Punta
Arenas, gn-3426691 Stanley, gn-1273313 Dehradun, gn-1678228 Keelung,
gn-2022890 Khabarovsk, gn-1675151 Hsinchu, gn-3893656 Copiapó, gn-3607966 La
Esperanza, gn-6243926 Blenheim, gn-2546917 Ifrane, gn-727447 Sandanski,
gn-3108126 Teruel, gn-3164565 Vercelli, gn-3934707 Mollendo, gn-1486910
Vorkuta, gn-1791464 Wenling, gn-149437 Tukuyu, gn-2268406 Évora, gn-3991347
Puerto Peñasco, gn-1169684 Murree, gn-2652885 Cleethorpes, gn-3109642
Santiago de Compostela, gn-3939470 Huancavelica, gn-3359957 Villiersdorp,
gn-1023365 Alexandria, gn-5909278 Brocklehurst, gn-4146723 Bartow,
gn-363243 Sarandë, gn-986134 Kuruman, gn-3880143 Mejillones, gn-6696258
Campbellton, gn-3843843 Monte Hermoso, gn-3858765 El Bolsón, gn-2803183
Angleur, gn-13192644 Dārzciems, gn-5807239 Port Townsend, gn-2184361 Motueka,
gn-2741961 Buarcos, gn-6111529 Portage la Prairie, gn-3352263 Warmbad,
gn-3403899 Calçoene, gn-2783850 Wépion, gn-3167742 San Sebastiano al Vesuvio,
gn-1274380 Chhachhrauli, gn-3676477 Lloró, gn-2058304 Williamstown,
gn-6544327 Costa Calma, gn-1004406 Fauresmith, gn-2514452 Los Silos,
gn-6945985 Dégelis, gn-3116595 Molina de Aragón, gn-1015850 Brandvlei,
gn-2972607 Tignes, gn-2073985 Coober Pedy, gn-3191631 Risan.

## Validator: Phase 1 → prompt v1 alignment (rule by rule)

- **Schema:** Phase 1 provisional schema superseded by prompt §10
  (`meridian.loop.clues.v1`); per-clue `{tier, tier_name, text, narrowing,
  source{article, url, quote}}`; answer block checked against the §9 input
  when known (a record about a different place than its input fails closed).
- **Leak rule:** LOCKED strict version — case-insensitive substring with
  diacritic folding over canonical name + aliases + derived/demonym forms
  (supersedes Phase 1 token semantics). Refinement within the ruling:
  aliases are enforced as whole phrases, never decomposed into parts
  (decomposing "City of Pines" would ban "city"/"pines" across all prose);
  canonical-name parts are terms, except function-word parts and parts
  < 3 chars (whole-token only).
- **Quotes:** every clue's `source.quote` must be a verbatim span of the
  supplied extract (whitespace-collapsed, case-sensitive), ≥ 24 chars.
- **Writing caps:** clue 15–40 words, 1–2 sentences, ≤ 25 words/sentence.
- **Reading level:** LOCKED target is reading age ~10. Mechanical proxy:
  Flesch-Kincaid grade **≤ 6.0** (age-10 ≈ grade 5, +1 grade of headroom for
  polysyllabic geography vocabulary). The cap was **not** loosened when it
  bit: it was the predominant initial-failure code among the 19 repaired
  records, and those sets were fixed by rewriting, not by moving the cap.
  Calibration tension, stated honestly: FK punishes unavoidable place-domain
  vocabulary (multi-syllable river/mountain/climate terms), so 6.0 is strict
  in practice; whether the proxy or the prose should move is Veeresh's call —
  the numbers above are the evidence.
- **Climate:** non-redundancy enforced by content-token Jaccard < 0.5 vs the
  geography clue + a root-prefix climate-signal check on the tier-2 quote.
  Semantic climate substance (mechanism vs label) is worker duty under the
  prompt's tier-2 hard rule and remains human-review territory — see Karaj
  under Gaps.
- **Tier 5:** giveaway-distinctness proxy — overlap coefficient < 0.6 vs the
  earlier clues.
- **Rejection path:** §6 records `{schema, status:"rejected", place_id,
  rejection:{tier, tier_name, reason, missing}}`, validated by
  `validateRejectionRecord`; validator-failed accepted records are converted
  via `toRejectionRecord` so no failure disappears.
- **Difficulty/aliases:** difficulty = guessability int 1–5 (§8); every
  recorded alias must be sourced — present in the input's curated aliases or
  attested as a folded substring of a supplied extract.

## Gaps, deviations, and incidents (explicit)

1. **365 not reached — 63 published.** Root cause is source material, not
   rules: cache extracts are short lead excerpts; the locked tier-2 rule
   (correctly) refuses to invent climate mechanisms. The decision that
   changes the math — sanction a fuller extract source (e.g. full Wikipedia
   intro text per article: same source, larger span) or revisit the
   target/contract — belongs to Liz/Veeresh and was escalated mid-run.
2. **Karaj (gn-128747) weak climate clue.** Its tier-2 clue ("special
   weather… help shape that weather") passes every mechanical check but is
   semantically hollow. Flagged for Veeresh's sampling review; semantic
   climate substance is a documented validator gap, not a silent pass.
3. **378 crawl-excluded famous places have no extract at all** (the crawl
   excluded notable places), so they never entered the pool. Combined with
   gap 1, the famous-place coverage the prompt assumed (a curated pool of
   500–2,000 with substantive extracts) does not exist in the sanctioned
   inputs.
4. **Alias sourcing enforced against §9 inputs only** — an alias real in the
   world but unattested in the extract/curated list is rejected. This is
   the fail-closed reading of §8 and may cost a few sets; it was not
   loosened.
5. **Climate adjudication calls** (worker brief, applied uniformly): a
   one-off historical weather event (e.g. a single medieval drought) does
   NOT qualify as climate character; tides are not climate; wind named only
   as a power source is not climate; average temperatures alone and
   "mild/cooler microclimate" labels do not qualify. Stated records/
   superlatives, described mechanisms, seasonal rhythms, and paradoxes do.
6. **Duplicate-write incident (Wave 7/8):** duplicate workers were spawned
   for some Wave 7 jobs; one late duplicate write landed between the Wave 7
   validation run and its commit, so gn-2783850's writing-cap failure only
   surfaced in a later full rescan (repaired in round 7). Mitigation now
   standard: every repair round rescans ALL waves' outputs, and
   validator-rejected counts are re-derived fresh at each integration.
7. **Wave 11 record-shape incident:** 180 of Wave 11's §6 records were
   written in a flat shape (the coordinator's Wave 11 brief described the
   rejection fields flat; the spec shape nests them under `rejection`).
   The validator caught all 180 (`malformedWorkerRejections`); they were
   mechanically normalized to the nested shape with content unchanged and
   re-validated — final malformed count 0. The brief template was corrected
   for any future waves.
8. **Remainder not attempted:** 8,456 non-signal places dispositioned as
   screened-not-adjudicated (see above) — a coordinator judgment call,
   flagged here and in the handoff for Liz/Veeresh to override.
9. **Semantic residue stays human:** tier-fit (is the hook a hook, is tier
   5 a true giveaway), name-meaning translations, and climate substance
   beyond the mechanical proxies are Veeresh's sampling-review territory,
   per the locked prompt's design.

## Reproduction

```
node scripts/clues/production/build-pool.mjs          # pool.jsonl (10,645)
node scripts/clues/production/build-attempt-queue.mjs  # attempt-queue.jsonl
node scripts/clues/production/validate-production.mjs  # records.jsonl + validation-stats.json
node scripts/clues/production/assemble.mjs             # public/loop/** + assembly-report.json
```
