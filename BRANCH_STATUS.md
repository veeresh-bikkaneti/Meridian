# BRANCH_STATUS.md — feat/difficulty-tiers

**Branch:** `feat/difficulty-tiers` · **Base:** `origin/main` @ `eee96c8`
**Task:** Difficulty tiers + fame-weighted dealing. Users report the game is
too difficult ("never heard of most places in Italy", "it goes to
neighborhoods"). All 124,690 generated places ship `difficulty: 3`; dealing
is uniform random. Veeresh approved: **build both** — a kid-friendly
Easy/Medium/Hard picker at run start + fame-weighted dealing within the pool.

## Done
- [x] Worktree created at `~/workspace/meridian-worktrees/difficulty-tiers`, branch `feat/difficulty-tiers` from `origin/main` (eee96c8)
- [x] `node_modules` symlinked from sibling worktree (no npm install)
- [x] Verified: `Starter.difficulty` is already `Difficulty` (1–5); scoring multipliers 1/1.25/1.5/2/2.5 exist; generated places default to 3
- [x] Verified: chunk records are `{id,name,lon,lat,blurb,iso2,edition,regionId}` — no per-place population shipped
- [x] Game-engine integration map complete (worker B). KEY FINDINGS:
  - Scoring with real tiers is ALREADY wired: `game-app.tsx` passes `place.difficulty` into `scorePlace`; `QuestionBubble` renders `difficultyChip`. Only the data signal is missing.
  - Curated starters need a data-only edit (their `place()` difficulty args) to pin at tier 1 — no engine special-casing.
  - Engine touch-points: `run.ts` (Run type, startRun, resumeRun, isResumable), `game-app.tsx` (openRun, onReplay, readRun), picker in `Choose` component (~line 863), one new tier-filter helper called before `poolForRunStart`, optional `trail.ts` `buildCycle` for weighting. Scoring, dealer, session, share, SCORE pill need NO changes.
  - LAUNCH-BLOCKING: all generated places are tier 3 today — a strict Easy=1 filter would empty pools. Use inclusive bands (Easy=1–2, Medium=2–4, Hard=4–5) until the dataset carries real tiers.
  - Breakage risks: `onReplay` must re-apply the tier filter; `isResumable` must compare the difficulty choice (a switch starts a fresh run).

- [x] Data-pipeline design complete (worker A). DECISIONS:
  - Stamp `difficulty` (1–5) per place at build time in `scripts/build-geonames-dataset.mjs`; +1.78 MB (+7.9%) on 22.5 MB chunks — sidecar rejected (larger + join hazard).
  - Cutoffs from real dump quantiles (124,690 kept): T1 pop≥100k or PPLC (~5%); T2 pop≥25k or PPLA (~13%); T3 pop≥6k (~32%); T4 pop≥2.5k (~30%); T5 pop<2.5k (~20%). PPLX neighborhoods floored at tier 3 (never Easy/Moderate).
  - Build preserves optional `fact`/`history`/`wiki` from existing chunks by place id (defensive; no-op on current main). Sequencing: land difficulty-tiers BEFORE facts-ladder merges broadly, so the ladder re-merges onto stamped chunks.
  - 12 curated starters (`curated: true`) pinned to tier 1 — data-only edit in `starters.ts`.
  - `toStarter()` prefers `record.difficulty` when integer 1–5, else backfills 3.

## Pending
- [ ] IMPLEMENTATION (3 crews running in parallel):
  - [x] Crew 3 — weighted dealer DONE (commit `ae0da32`): Efraimidis–Spirakis in `buildCycle`, `w = 6 − difficulty`, mulberry32 seeded from `cycleSeed`, determinism/no-repeat/boundary/exhaustion preserved; 8 new tests incl. statistical skew proof; full suite 400/400 green
  - [x] Crew 2 — picker + run plumbing DONE (commit `3329c3c`): `tier-filter.ts` (Easy 1–2 / Medium 2–4 / Hard 4–5), `Run.difficultyChoice`, `isResumable` choice gate, segmented picker ("How tricky should the places be?") in GameApp state + `localStorage`, `openRun`/`onReplay` filter, scoring-path proof (tier1 → ×1.0, tier5 → ×2.5); suite 410/410 green
  - [x] Crew 1 — dataset DONE (commit `90d234b`): `difficulty` + `subdivision` stamped on all 124,690 places; subdivision coverage 99.7% (124,357); tier split T1 4.8% / T2 13.2% / T3 32.1% / T4 29.7% / T5 20.3% (matches design); PPLX floor verified non-vacuous (8,701 PPLX rows, 0 below tier 3); spot-check: Saugor → "Madhya Pradesh", tier 1; all gates green
  - [x] Crew 4 — subdivision labels DONE (commit `30fbd51`): globe ALWAYS `{Place}, {Subdivision}, {Country}` when subdivision exists (Veeresh's amendment), fail-closed two-part fallback; question+reveal share one call site; 422/422 unit tests green. NOTE: crew reported no Playwright browsers, but config uses `/opt/meta-chromium/chrome` via executablePath — E2E CAN run; crew just didn't check.
## Product philosophy (Veeresh, standing principle)
Meridian's top priority is user experience, engagement, and LEARNING OUTCOMES — players are learners who want to grow. Applied to this track:
- The picker is framed as **learning scaffolding**, not gamer difficulty. Copy (2026-10-03): label "How do you want to grow your map today?"; Easy "Famous places — the must-know spots every explorer starts with."; Medium "A little of everything — grow your map one discovery at a time."; Hard "Hidden corners of the world — for explorers ready to discover more." Tone review judges on encouragement/growth language, not bravado.
- Fame-weighted dealing is a pedagogy decision: famous-first builds the mental map that obscure places later attach to.
- Tiers in learning terms: T1 = world-famous cities + country capitals (the curriculum core — graduating T1 means a working mental map of the world); T2 = state/province capitals + major regional centers; T3 = everyday towns (the median human settlement); T4 = small towns most people haven't heard of; T5 = tiny villages + neighborhoods (explorer territory, never Easy).
- [x] VERIFIED 2026-10-03: chunk rebuild is additive-preservative. Diffed all 124,690 places' `history`/`wiki`/`fact`/`blurb` between pre-rebuild main (eee96c8) and this branch: **0 mismatches, 0 dropped places** (125,448 field instances identical on both sides).
- [x] Preservation tests exist: `scripts/build-geonames-difficulty.test.mjs` ("carries fact/history/wiki forward by place id", "only the preserved keys travel"; difficulty/subdivision stamped fresh, never preserved).
- [x] E2E crew DONE: `npm run build:pages` green; new `difficulty-picker.spec.ts` 5/5 (renders, persists, Easy→tiers 1–2, Hard→tiers 4–5, band switch = fresh run, reload keeps tier); subdivision-labels 2/2, question-labels 3/3, endless-game 2/2, question-randomization 3/3, scoring-v3 1/1, session-score 5/5, edition-drilldown 8/8, endgame-share 2/2 — all console-clean. No production bugs. (One honest flake: resume test 1/4, load-related on the VM.)
- [x] Tone/docs/accessibility review: APPROVE WITH NOTES (2026-10-03). Applied: chip names → fame vocabulary (`Famous`/`Well-known`/`Everyday`/`Lesser-known`/`Hidden`, kills the picker/chip collision and "Extreme" bravado); Easy hint softened ("must-know" removed); README "Learning paths" section added. Deferred (non-blocking, noted): `radiogroup` pattern for the segmented control (currently buttons+`aria-pressed`, keyboard-operable, announces acceptably).
- [x] Technical-architect review: APPROVE WITH NOTES (2026-10-03) — 12 findings, no blockers. Fixes crew applying: pool-fallback fail-closed hole, pre-picker resume comment, manifest meta carry-forward, tier-filter comment reword, shared asFameTier, history/wiki pairing gate, curated ASCII normalization, hookMissing rationale comment, tierFor comment.
- [x] Fixes crew DONE (commit `0838a05`): all 9 architect findings applied — pool-fallback fail-closed hole fixed (`resolveRunPool` 3-way policy + honest kid-friendly empty-band state), pre-picker resume documented, manifest meta read-merge-write, tier-filter comment reworded, shared `asFameTier()`, history/wiki pairing gate (379/379 paired), hookMissing KEEP rationale, tierFor edge comment. Finding #7 premise inverted on verification: pipeline stamps Unicode (`"Yucatán"`, `"Ma'an"` U+2019) and curated already matches — documented Unicode-canonical, no data change. Gates: tsc clean, 425/425 tests, lint-cards GATE PASSED, build green, check-generated-places 0 violations.
- [ ] PARKED AT MERGE GATE (blocking): Wikipedia merge (9,129 hooks) lands on main first → rebase checklist in Notes → PR → merge → live verify.
- [ ] MERGE GATE (blocking): the Wikipedia merge (9,129 extractive history hooks, curated-wins, idempotent) lands on main BEFORE this branch merges. Rebase checklist: (1) RE-RUN `node scripts/build-geonames-dataset.mjs` on the new main — never hand-resolve single-line chunk JSON conflicts; the preservation logic carries the new history/wiki forward; (2) MANUALLY merge `src/game/generated-places.ts` (ChunkPlaceRecord / toStarter / assertValidRecord — watch `wiki` field precedence) and `scripts/check-generated-places.mjs` (per-field gates) — these WILL textually conflict; (3) verify the manifest `meta` enrichment block survives the rebuild; (4) re-run the byte-identical preservation diff (history/wiki/fact/blurb, 0 mismatches); (5) full gates + E2E re-run. Then PR → merge → live verify. Do NOT merge this branch before the Wikipedia merge lands.

## Payload (corrected per architect review, 2026-10-03)
Chunks: 23,588,034 → 31,254,020 bytes raw = **+7.67 MB (+32.5%)**; gzipped transfer 3,191,402 → 3,453,207 = **+8.2%**. (The earlier "+1.78 MB (+7.9%)" was the gzip delta wearing raw units — corrected.) Breakdown of +7.67 MB raw: subdivision ~3.4 MB, `hookMissing:true` marker ~2.5 MB (KEPT deliberately — the enrichment pipeline's hook-candidate marker, cleared by `enrich-wikipedia.mjs`; stripping it would sabotage the Wikipedia merge), difficulty ~1.7 MB. Transfer conclusion stands (+~8%, sane: chunks lazy-load per region; `globe.json` 14.7 MB raw / ~1.66 MB gz, cached raw in SW cache-first storage). Zero-cost: no new services, no new dependencies.

## Notes / decisions
- Do NOT touch the Safari crash investigation (separate crew, separate branch).
- Do NOT change the `shareText()` format itself — Veeresh's approved 3-line format is locked.
- Stage named files only, never `git add -A`; push early and often.
