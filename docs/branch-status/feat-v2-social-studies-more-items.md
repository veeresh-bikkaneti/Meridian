# feat/v2-social-studies-more-items — branch status

**Task:** Social studies v2 (Stream A build brief, Nov 13): make more of the already-existing rows in `docs/scaling/social-studies/items.json` playable in the shared case flow, up to 10 new items per age band. Draft PR only — owner merges. No shared files touched (another stream owns `src/subjects/shared/`); data files untouched.

**Scope:** `src/subjects/social-studies/items.ts` (3 ids added to the deal list), `src/subjects/social-studies/answers.ts` (3 entries), `src/subjects/social-studies/social-studies.test.ts` (counts + recomputation), `tests/e2e/social-studies-subject.spec.ts` (one new-item case per band that has one), this status file. New items: `place:compass-clue` (7-10), `route:fastest-or-shortest` and `compare:time-zones` (10-18). Per-band playable counts: 7-10: 3 → 4 of 7 rows; 10-18: 3 → 5 of 7 rows; 18+: 3 → 3 of 3 rows (no unplayed 18+ rows exist in the data, so no new 18+ item and no new 18+ e2e case — the brief's one-per-band e2e applies to the two bands that gained items). Every unplayed row was re-screened against `docs/scaling/humanities/screened-topics.md`: the shipped three are map and route geography (directions H04 KEEP; routes H03 KEEP-LIMITS; time zones follow from longitude), settled facts only. Held for a scene, listed in the PR: `place:grid-reference`, `region:landform-sort`, `compare:farther-or-nearer`, `place:latlon-pin`, `route:compass-bearing`. All 3 new items carry UNVERIFIED standards and are tabled first in the PR body.

**Status:** Built and verified on main `8ff81671` (targeted tests per the owner's lean strategy; CI carries the full suite).
- Unit: social-studies + picker-rows + registry 20/20 (incl. recomputation of the two computed v2 answers and the screened-topics guard)
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npx tsc --noEmit` clean; Vite production build green, entry JS gzip 320,910 B vs 323,865 B limit (`npm run build:pages` stops earlier at its detective-audio prebuild gate in this working copy — the copy holds only part of `public/audio`, so the manifest check cannot pass here; the Vite build itself was run directly and is green)
- E2E spec extended but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"), the same limit disclosed on the v1 PR; the spec also has no dedicated project in `playwright.config.ts` on main (unchanged state). CI carries it.
- Reviewer seat: a separate reviewer sub-agent reviewed the diff against the brief's rules; its verdict is pasted verbatim in the PR body. `/pstack`, `gstack` and `agent-agency` are not installed in this environment, so plain sub-agents were used, per the brief.

**Still open:**
- Educator review runs alongside (owner rule, Nov 13): the 3 shipped items, all UNVERIFIED, are tabled in the PR body, UNVERIFIED first.
- Held rows stay for a map/picture wave: grid-reference (tap the square), landform-sort (sort pictured places), farther-or-nearer (compare by eye), latlon-pin (pin drop), compass-bearing (two-part bearing + components answer; the row carries no angle/distance pair to derive one answer from).

## Graph
- Adds no nodes. The branch extends the existing `social-studies` subject module node (src/subjects/social-studies/) with three more of its own curated rows; no new files, routes or dependencies.
