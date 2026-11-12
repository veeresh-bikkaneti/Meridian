# BRANCH_STATUS — mockup/scale-play

**Branch:** `mockup/scale-play`  
**Synced:** `origin/main` at `2bd5ee96` (PR #424)  
**Scope:** Scale features (subjects + journals) playable mockup on `/play-lab`.  

## Done

- [x] Contract adapter `src/play-lab/data.ts` loading all 135 curriculum items from `docs/scaling/**`.
- [x] Working `AgePicker` integration and filtering for `7-10`, `10-18`, and `18+` bands.
- [x] Flow A ("Case File"): Holmes & Watson rigs, case ledger, problem solving, bridge reveal.
- [x] Flow B ("Atlas of Skills"): Subject shelf preview, 3D Skill Constellation, and 3D Journal Globe.
- [x] 6 Interactive Items with derived validation (Math skip-count, Physics 3D race, Chemistry states, Social Studies bus clock, GK dynamic clock math, Journal Lincoln Memorial 2-step).
- [x] Cross-subject Bridge Card with animated brass thread SVG path.
- [x] Three.js dynamic loading, 3 motion tiers (`full`, `lite`, `flat`), DPR capped at 1.5, full WebGL disposal.
- [x] Unit test suite (`src/play-lab/play-lab.test.ts`): 11/11 tests PASS.
- [x] Playwright E2E suite (`tests/e2e/play-lab.spec.ts`): 4/4 tests PASS.
- [x] Council deliberation seated and Consensus Manifest signed (`docs/scaling/council-manifest-play-lab.md`).
- [x] Draft PR opened: #425.

## In Progress

- [ ] Enhanced Three.js animations (starfield, smooth inertia mouse drag, glowing atmosphere ring, dust trails & rotating wheels on carts).
- [ ] Local Docker container setup to serve built UI on port 8080.
- [ ] Progressive remote commits pushed to `mockup/scale-play`.

