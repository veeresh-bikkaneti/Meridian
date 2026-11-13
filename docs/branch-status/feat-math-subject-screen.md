# feat/math-subject-screen — branch status

**Task:** Math subject screen (wave 1, math only) behind the "Why Do We Learn This?" Home card, per the owner's build prompt. Draft PR only — owner merges.

**Scope:** `src/subjects/math/` (module, items adapter, answers, answer card, case component, unit tests), `ClueCard` export in `src/game/loop/LoopScreen.tsx`, `onWhyLearn` wiring + math early-return in `src/components/game-app.tsx`, one Playwright project entry, e2e specs. Data files under `docs/scaling/math/` untouched. Nothing under `src/game/loop/detective/` touched.

**Status:** Built and gated (targeted tests per the owner's lean strategy; CI carries the full suite).
- `npx tsc --noEmit` clean
- `src/subjects/math/math.test.ts` 8/8; `src/subjects/registry.test.ts` 9/9; adjacent unit tests (loop-screen-animate, card-media-band-variants, card-film) 53/53
- `npm run lint:content` GATE PASSED; `node scripts/lint-cards.mjs` GATE PASSED
- `npm run build:pages` green
- E2E (built artifact, --workers=1): why-learn-card.desktop.spec.ts 7/7 + math-subject.spec.ts 6/6 — one case per band to the result, flag-off parity, reduced motion, no console errors

**Still open:**
- Educator sign-off: the module stays `released: false` behind `?scale=1` until a named human educator signs `docs/scaling/educator-gate-rubric.md` and the owner says go. Every answer derivation is listed in the PR body for that review.
- 18+ mental-strategies item: the source row names no numbers; its question (24 × 15) is an example built on the row's objective and is flagged in answers.ts + the PR for the educator.
- LoopReveal is not reused as a component (it requires a geographic puzzle state); the math result mirrors its visual language. DetectiveHost is not mounted (ships dark behind detectivePair; math items are text-only, no new audio).

**Ruled out:** editing the items.json data files; a new route/page; flipping `released` or the flag default; full local regression (owner's lean test strategy — CI runs it).

## Graph
- Adds node: subject module `math` (src/subjects/math/) — depends-on contracts I1/I2, flags.scalePlay, subjects registry.
