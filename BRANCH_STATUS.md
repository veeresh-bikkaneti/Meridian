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

## Pending
- [ ] Research: dataset build script — where population/feature codes live, tier-cutoff proposal, chunk-size impact
- [ ] Research: game-engine integration points (dealer, scoring, session, share, back-compat)
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
