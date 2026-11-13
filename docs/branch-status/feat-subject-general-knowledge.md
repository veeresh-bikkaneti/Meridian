# feat/subject-general-knowledge — branch status

**Task:** Subjects launch step 4 (owner's build prompt, Nov 13): general knowledge goes live in the subject picker, same pattern as math/physics/chemistry. Draft PR only — owner merges. Stacked on `feat/subject-chemistry` (PR 439) until it merges.

**Scope:** `src/subjects/general-knowledge/` (module, items adapter over `docs/scaling/general-knowledge/items.json`, answers, thin case wrapper, unit tests), one e2e spec. Data files untouched; `rounds.json` is PROPOSED example rounds only — not read, and no spaced-repetition dealing is built. 8 items ship (3 for 7-10, 3 for 10-18, 2 for 18+ — only 2 curated 18+ rows exist). Every item was re-screened: landmarks appear as architecture and places only, settled facts only. The opera-years-ago answer is a year-gap answer built at play time from the shared `yearsSince` mechanism and the device's current year — never typed into content; a unit test fakes two years (2030 → 57, 2000 → 27).

**Status:** Built and verified on the step-3 branch (targeted tests per the owner's lean strategy; CI carries the full suite).
- Unit: general-knowledge + chemistry 12/12 (incl. the two-year year-gap test and numeric recomputation)
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npx tsc --noEmit` clean; `npm run build:pages` green, entry JS gzip 319,696 B vs 323,865 B limit
- E2E spec written (general-knowledge-subject.spec.ts) but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically — environment limit, not a regression. CI runs it.

**Still open:**
- Educator review runs alongside (owner rule, Nov 13): the 8 shipped items, 2 with UNVERIFIED standards, are tabled in the PR body, UNVERIFIED first.
- Skipped for a later wave: general-knowledge:mixed:older-landmark, general-knowledge:mixed:falls-in-km, general-knowledge:mixed:noon-shadow (noon-shadow needs shadow pictures).

## Graph
- Adds node: subject module `general-knowledge` (src/subjects/general-knowledge/) — depends-on subjects registry, shared SubjectCase, contracts I1/I2.
