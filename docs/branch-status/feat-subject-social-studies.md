# feat/subject-social-studies — branch status

**Task:** Subjects launch step 5 (owner's build prompt, Nov 13): social studies goes live in the subject picker, same pattern as math/physics/chemistry/general knowledge. Draft PR only — owner merges. Stacked on `feat/subject-general-knowledge` (PR 440) until it merges. This is the last step of the launch: with it, every built subject is linked from the "Why Do We Learn This?" card and Journals is the only "Coming soon" row left.

**Scope:** `src/subjects/social-studies/` (module, items adapter over `docs/scaling/social-studies/items.json`, answers, thin case wrapper, unit tests), one e2e spec. Data files untouched. 9 items ship (3 per band). `docs/scaling/humanities/screened-topics.md` was read before authoring and the shipped slice stays inside it: map and route geography only (directions H04, routes H03, landform geography H18 — KEEP / KEEP-LIMITS), settled facts only, no religion, no contested politics, no biology; a unit test guards the shipped wording. 13 of the 17 curated rows carry UNVERIFIED standards; 6 of the 9 shipped items are UNVERIFIED and are tabled first in the PR body.

**Status:** Built and verified on the step-4 branch (targeted tests per the owner's lean strategy; CI carries the full suite).
- Unit: social-studies + general-knowledge + picker-rows + registry 26/26 (incl. numeric recomputation and the screened-topics guard)
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npx tsc --noEmit` clean; `npm run build:pages` green, entry JS gzip 319,692 B vs 323,865 B limit
- E2E spec written (social-studies-subject.spec.ts) but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically — environment limit, not a regression. CI runs it.

**Still open:**
- Educator review runs alongside (owner rule, Nov 13): the 9 shipped items, 6 with UNVERIFIED standards, are tabled in the PR body, UNVERIFIED first.
- Skipped for a later wave: place:compass-clue and place:grid-reference (need the map to follow/pin), region:landform-sort (needs pictured places to sort), compare:farther-or-nearer (needs the map in front of you), place:latlon-pin (pin drop), route:compass-bearing (two-part bearing answer), route:fastest-or-shortest and compare:time-zones (build on travel-time, which ships here).

## Graph
- Adds node: subject module `social-studies` (src/subjects/social-studies/) — depends-on subjects registry, shared SubjectCase, contracts I1/I2.
