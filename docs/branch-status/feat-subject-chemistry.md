# feat/subject-chemistry — branch status

**Task:** Subjects launch step 3 (owner's build prompt, Nov 13): chemistry goes live in the subject picker, same pattern as math/physics. Draft PR only — owner merges. Stacked on `feat/subject-physics` (PR 438) until it merges.

**Scope:** `src/subjects/chemistry/` (module, items adapter over `docs/scaling/chemistry/items.json`, answers, thin case wrapper, unit tests), one e2e spec. Data files untouched. 9 items ship (3 per band). `fact-notes.md` and `standards-notes.md` were read before authoring: road-salt wording stays inside the fact-notes limit (freezing point only), rust wording follows the notes, and no biology appears in any question or "use elsewhere" line (a unit test guards both).

**Status:** Built and verified on the step-2 branch (targeted tests per the owner's lean strategy; CI carries the full suite).
- Unit: chemistry + physics + math 19/19 (incl. the road-salt wording-limit test)
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npx tsc --noEmit` clean; `npm run build:pages` green, entry bundle within budget
- E2E spec written (chemistry-subject.spec.ts) but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically — environment limit, not a regression. CI runs it.

**Still open:**
- Educator review runs alongside (owner rule, Nov 13): the 9 shipped items, 4 with UNVERIFIED standards, are tabled in the PR body, UNVERIFIED first.

## Graph
- Adds node: subject module `chemistry` (src/subjects/chemistry/) — depends-on subjects registry, shared SubjectCase, contracts I1/I2.
