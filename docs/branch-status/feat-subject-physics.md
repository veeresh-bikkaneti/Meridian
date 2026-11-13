# feat/subject-physics — branch status

**Task:** Subjects launch step 2 (owner's build prompt, Nov 13): physics goes live in the subject picker, same pattern as math. Draft PR only — owner merges. Stacked on `feat/subjects-picker-math-live` (PR 437) until it merges.

**Scope:** `src/subjects/physics/` (module, items adapter over `docs/scaling/physics/items.json`, answers, thin case wrapper, unit tests), one e2e spec. Data files untouched. 9 items ship (3 per band); rows needing a scene interaction the shared AnswerCard cannot do (tap-a-direction, tap-a-path) are a later wave, listed in the PR body.

**Status:** Built and verified on the step-1 branch (targeted tests per the owner's lean strategy; CI carries the full suite).
- Unit: physics + picker-rows + registry 19/19
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npx tsc --noEmit` clean; `npm run build:pages` green, entry bundle within budget
- E2E spec written (physics-subject.spec.ts) but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically — environment limit, not a regression. CI runs it.

**Still open:**
- Educator review runs alongside (owner rule, Nov 13): the 9 shipped items, 3 with UNVERIFIED standards (all 18+), are tabled in the PR body, UNVERIFIED first.

## Graph
- Adds node: subject module `physics` (src/subjects/physics/) — depends-on subjects registry, shared SubjectCase, contracts I1/I2.
