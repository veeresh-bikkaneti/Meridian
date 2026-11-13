# feat/subjects-picker-math-live — branch status

**Task:** Subjects launch step 1 (owner's build prompt, Nov 13): extract the generic subject case, add the subject picker to the "Why Do We Learn This?" card, and release math — the card is live for everyone, no `?scale=1`. Draft PR only — owner merges.

**Scope:** `src/subjects/shared/` (SubjectCase, AnswerCard moved from math, SubjectPicker, picker-rows, shared answer/years helpers), `src/subjects/math/` (thin MathCase wrapper, `released: true`), registry + contracts release-rule wording, `game-app.tsx` (card always on, picker early return replaces the math-only one), e2e specs (math-subject, why-learn-card, new subjects-picker). Data files under `docs/scaling/` untouched except the contracts.md wording line.

**Status:** Built and verified on main `8eb34cb` (targeted tests per the owner's lean strategy; CI carries the full suite).
- `npx tsc --noEmit` clean
- Unit: registry + math + picker-rows + game-app-lazy-boundary 34/34; adjacent game-app/Home source-scan suites 126/126
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npm run build:pages` green; entry JS gzip within budget, subject code stays lazy
- E2E specs written/updated (math-subject, why-learn-card, subjects-picker) but NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically, so per AGENTS.md this is an environment limit, not a regression. CI runs them.

**Dependencies:** PR 434 (math screen) is merged into the base. PR 431 (berth touch fix) is still open — no code overlap with this branch; noted in the PR body. Steps 2–5 stack on this branch until it merges.

**Still open:**
- Educator review now runs alongside (owner rule, Nov 13): the 9 shipped math items, 3 with UNVERIFIED standards, are tabled in the PR body for the educator, UNVERIFIED first.
- Journals stay a disabled "Coming soon" picker row — their clips are not in the repo.

**Ruled out:** editing the items.json data files; a new route; new styles beyond spacing (picker rows reuse the case screens' prod button styling); the full local regression suite.

## Graph
- Adds node: shared subject case + picker (`src/subjects/shared/`) — depends-on subjects registry, contracts I1/I2.
- Changes node: subject module `math` — released: false → true.
- Changes node: "Why Do We Learn This?" Home card — flag gate removed, opens the picker.
