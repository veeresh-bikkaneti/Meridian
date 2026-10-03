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
  - [ ] Crew 1 — dataset: build-script tier stamping + chunk rebuild + `toStarter()` preference + curated pin + gates
  - [ ] Crew 2 — picker + run plumbing: `run.ts`, tier-filter helper, `game-app.tsx` picker/openRun/onReplay/readRun, scoring-path proof test
  - [ ] Crew 3 — weighted dealer: Efraimidis–Spirakis in `trail.ts` `buildCycle` + distribution/no-repeat/determinism tests
- [ ] E2E (after all 3 crews): picker renders; Easy deals famous; Hard can deal obscure; multipliers apply; resume keeps tier
- [ ] Gates: technical-architect review → tone/docs review (picker copy) → PR → merge → live verify
- [ ] Design sign-off: tier cutoffs + picker UX (kid-friendly, one tap)
- [ ] Implement: dataset rebuild with per-place difficulty tiers
- [ ] Implement: weighted dealer (fame-weighted shuffle without replacement) in trail.ts + tests
- [ ] Implement: Easy/Medium/Hard picker at run start (Globe, Country, State)
- [ ] Implement: wire real difficulty into scoring multipliers (session, SCORE pill, end-game, share)
- [ ] Back-compat: pre-change saved runs/sessions load (default tier 3)
- [ ] Gates: unit → typecheck → card lint → build → tech-architect review → tone/docs review → E2E → PR → merge → live verify

## Notes / decisions
- Do NOT touch the Safari crash investigation (separate crew, separate branch).
- Do NOT change the `shareText()` format itself — Veeresh's approved 3-line format is locked.
- Stage named files only, never `git add -A`; push early and often.
