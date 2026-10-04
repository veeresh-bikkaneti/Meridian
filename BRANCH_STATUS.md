# BRANCH_STATUS.md — feat/geodetective-clues (GeoDetective clue-set production)

**Branch:** `feat/geodetective-clues` · **Base:** `origin/main` @ `de9b7a8` (rebased 2026-10-04 for Phase 2; Phase 1 base was `3c32085`)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`
**Mission:** Produce ≥365 validated 5-tier clue sets for GeoDetective's curated famous-place pool — content pipeline only. Deliverable = this branch: clue JSONs in `public/loop/clues/`, composer + validator scripts with tests, and a validation report. No merge, no PR — Veeresh decides. The human-reviewed gate stays Veeresh's (expect sampling review).

## Verified 2026-10-03 (first-hand, parent agent)

- [x] PR #34 confirmed: draft, `feat/meridian-loop` → main, "DO NOT MERGE: blocked on 365-clue content gate". GeoDetective mode code is Chitti's crew's — this branch never touches game/mode code.
- [x] The 12 seed clue sets exist ONLY on `origin/feat/meridian-loop` (`public/loop/clues/0.json`–`11.json`, manifest size 12). `public/loop/` does NOT exist on main. Seed schema: `{v, placeId, target{lon,lat}, clues[5 strings], source{label,href}}` — no per-clue source fields, no difficulty, no aliases.
- [x] `docs/geodetective.md` (on feat/meridian-loop) confirms the ladder Geography → Climate → History → Hook → Giveaway (positional), climate non-redundant vs geography, tier 5 = giveaway not summary, clue file never contains the place name, ≥365 validated-set gate.
- [x] Wikipedia crawl complete on `feat/wikipedia-crawl` (remote `a9c8bb9`): 124,312 unique cached IDs, 71,957 matched extracts, 9,129 hook candidates. Chitti's merge of that data is NOT on main yet (main still `3c32085`, verified 2026-10-03 16:22 CDT).

## Spec items — resolved 2026-10-04

- [x] **Generation prompt ADOPTED VERBATIM** — `scripts/clues/generation-prompt.md` is now a byte-identical copy of the FINAL prompt v1 (locked by Veeresh 2026-10-04), sha256 `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a`. It supersedes the Phase 1 provisional schema: records follow prompt §10 (`meridian.loop.clues.v1`), difficulty = guessability int 1–5, strict substring+diacritic leak rule (LOCKED), reading age ~10 (LOCKED), set-level fail-closed rejection (LOCKED).
- [x] **Wikipedia merge is LIVE on main** (`de9b7a8`; manifest `enrichment.historySentences = 8420`). Full extracts for generation inputs come from the crawl cache (`~/workspace/meridian-worktrees/wikipedia-crawl/.scratch/wikipedia-enrichment/crawl-cache.jsonl`, read-only — never staged/committed).
- [ ] **Design record** `meridian-loop-brainstorm/synthesis.md` — still only on Chitti's VM; the locked prompt implements it and is the operative spec for this run.

## Plan

- [x] **Phase 1 (done 2026-10-03, commit `c70923a`):** composer + hardened validator built to the brief's validation bar and proven on the 12 seed places. See "Phase 1 results" below.
- [x] **Phase 2 (COMPLETE 2026-10-04):** validator aligned to prompt v1 → deterministic pool (10,645 candidates from cache-matched extracts + fame ranking on live main) → generation in 11 waves → assembly. **Outcome: 63 validated sets published in `public/loop/clues/*.json` (manifest size 63), NOT the ≥365 target** — the locked tier-2 climate rule + short lead-excerpt extracts cap the yield; see "Phase 2 results" below and `scripts/clues/production/validation-report.md`. No rule was loosened to chase the number. **Rebase note:** rebasing onto `de9b7a8` conflicted only in this file (kept ours).
- [ ] Veeresh's human review + merge decision.

## Phase 1 results (2026-10-03, verified by the coordinator's own gate runs)

Deliverables in `scripts/clues/`: `schema.mjs`, `validate-clues.mjs` (+23 tests), `compose-clues.mjs` (+15 tests), `generation-prompt.md` (adoption-pending placeholder socket — no substitute prompt content), `seed-proof.mjs`, `seed-proof-report.md`.

- **Validator** enforces, mechanically and fail-closed: exactly 5 clues; name-leak ban (word-boundary + embedded-token fragment rule for single-token terms, matching `build-loop.mjs` seed-guard semantics; case/diacritic-insensitive); tier-1 coordinate/elevation patterns; per-clue source fields present and each snippet verbatim-traceable to the supplied extract (no extract supplied → rejected `SOURCE_UNTRACEABLE`); climate non-redundancy proxy (content-token Jaccard < 0.5 vs geography) + climate-lexicon signal check; reading-level proxy (Flesch-Kincaid ≤ grade 8 per clue, ≤ 40 words/clue, ≤ 30 words/sentence); difficulty ∈ {easy, medium, hard} and aliases recorded. Rejections carry named reason codes; tests include a deliberate failure for every rule (all fixtures use a fictional place — no fabricated real-place facts). NOT mechanically decidable, recorded as gaps: semantic tier-fit (is tier 5 truly a giveaway, does the hook hook) and true semantic climate redundancy — those stay with the adopted prompt + human review.
- **Composer** never creates clue text: it loads a place's extract from the crawl cache (latest JSONL line wins; only `matched` + non-empty extract is usable), assembles externally supplied candidate drafts deterministically into the production schema, and runs the validator. With no drafts supplied it refuses — `PROMPT_NOT_ADOPTED` while `generation-prompt.md` is a placeholder (`GENERATION_NOT_IMPLEMENTED` even after adoption; generation is a later phase).
- **Production schema** (in `schema.mjs`, **pending Veeresh/Chitti confirmation**): every `LoopClueFile` field identical in name/type, plus additive `clueSources` (5 × `{snippet, extractId}`, index-aligned), `difficulty`, `aliases`.
- **Seed-proof** (`seed-proof-report.md`, three passes over the 12 seeds): Pass 1 strict production validation — **accepted 0 / rejected 12** (expected: old-schema placeholders; every set lacks clueSources, difficulty, aliases). Pass 2 content-only — the only content rule firing is `READING_LEVEL` (52 of 60 clues exceed FK grade 8; the hand-written seeds are single long sentences, and FK grades them 9–12.5 — the `loop-seed.json` "grade 4–6" claim does not hold under FK; **calibration question for Veeresh/Chitti**: shorten sentences in the adopted prompt, or recalibrate the proxy). Zero name leaks under repo seed-guard semantics. Pass 3 composer — cache coverage: **3 matched** (Tokyo, Sydney, Cape Town), **2 title-mismatch** (Rio, Moscow), **7 absent** (Paris, Cairo, New York City, London, Beijing, Mumbai, Mexico City — the crawl excluded notable places); the 3 matched were rejected at validation (`SOURCE_UNTRACEABLE` — seed clues are paraphrases, not verbatim extract spans; the honest fail-closed result), the other 9 stopped at the extract stage. Composer accept path is proven on synthetic fixtures in the test suite.
- **Integration fix (coordinator):** an early validator draft decomposed multi-word banned phrases into constituent words for the fragment rule, false-firing 7 "leaks" (`south` inside `southwestern`/`southeaster`, `city` inside `megacity`). Aligned to `build-loop.mjs` semantics (fragment check only for single-token terms) and re-ran the proof; the validator was not weakened — the seeds still fail on schema and reading level.
- **Gates (coordinator-run):** `node --test scripts/clues/*.test.mjs` 38/38; `npm test` exit 0 (scripts suite 345 tests 0 fail; src suite 393/393); `npx tsc --noEmit` clean (note: tsconfig includes only `src` + `server`, so the `.mjs` pipeline is outside tsc — same as the repo's other scripts); `node scripts/lint-cards.mjs` GATE PASSED. `build:pages` not run — this phase changes no `src/` or game-contract files.

## Phase 2 results (2026-10-04, coordinator-run; full detail in `scripts/clues/production/validation-report.md`)

- **Pool:** dataset 124,690 ⋈ cache-matched extracts 71,957 → ≥100-word substance floor → **10,645 candidates**, fame-ranked deterministically (`build-pool.mjs`, `pool-derivation.md`).
- **Production:** 11 waves, **2,189 attempted** (all 1,789 climate-signal candidates + fame-top-200 + a 200-place non-signal control tranche) → **63 accepted**, 2,126 worker-rejected (climate 2,057, history 66, hook 2, giveaway 1), final validator-rejected 0, pipeline issues 0. 19 initially-failed records (writing-cap codes only) repaired and coordinator-verified; 19/19 recovered. The remaining 8,456 pool places are the non-signal tail — dispositioned in the report as screened-not-adjudicated (control tranche yielded 0/200, all climate).
- **Published:** `public/loop/clues/0.json`–`62.json` in fame-rank order + `manifest.json` size **63**. Mechanical leak scan over published files: 315 clue texts, **0 hits**.
- **Headline gap:** 365 is not reachable from cache extracts under the locked tier-2 rule (extracts are median-47-word lead excerpts; most carry no sourceable climate mechanism/extreme/paradox). Escalated to Liz/Veeresh mid-run; the fix is a source/target decision (fuller extracts or revised target), not a rule change. Also flagged: Karaj gn-128747's mechanically-passing but hollow climate clue (semantic review = Veeresh's sampling), and 378 crawl-excluded famous places with no extract at all.

## Rules

- Content pipeline only: clue composer/validator scripts + `public/loop/clues/*.json`. No `src/game`, no `src/components`.
- Never invent facts; every clue traces to its source extract; fail closed (reject rather than guess).
- Stage named files only, never `git add -A`. Push early and often.
- No merge to main, no PR without Veeresh. Never run the Wikipedia `merge` step from this branch.
