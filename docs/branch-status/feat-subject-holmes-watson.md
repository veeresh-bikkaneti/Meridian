# BRANCH_STATUS — feat/subject-holmes-watson

**Branch:** `feat/subject-holmes-watson` · **Base:** `origin/main` 8e3fd95b
**Task:** Holmes & Watson math-case follow-up (owner rules, 2026-11-12). Builder only: local commits, no push / PR / merge — the coordinator gates and pushes.

## Done

- `src/subjects/math/case-voice.ts`: answer-blind event → fixed-clip mapping (open → lets-find-clues, correct → win-holmes, wrong → ack drawn via detective-state's `drawAckId` pool-minus-played rule, finished → win-watson) + pose mapping. Speech player created in "auto" mode (see that file's header: tap mode would skip lets-find-clues and every ack — neither is an ending/gesture ref and the math surface has no replay control — while auto keeps the sound toggle and read-aloud veto authoritative at play time).
- `src/subjects/shared/SubjectCase.tsx`: one optional `onCaseEvent` prop (open once per mount, correct/wrong in `pick()`, finished on a correct pick at the last band item, first time per mount); header comment made truthful. Other subjects never pass it.
- `src/subjects/math/MathPair.tsx` (new, lazy) + `MathCase.tsx`: the pair's bench strip mounts above the case only when `detectivePair` resolves on after `loadFlags()`; flag off renders exactly main's case. Player stopped + disposed on unmount.
- One-voice unit test: `src/subjects/math/case-voice.test.ts` (10 tests) against the real voice channel, the real player, and the real manifest pool.
- E2E in `tests/e2e/math-subject.spec.ts`: flag-on desktop poses/speaking classes, 390px non-overlap, reduced-motion stillness, flag-off absence.

## Gates (targeted, AGENTS.md §9 / §4)

- Unit (math.test + case-voice.test + voice-channel.test + detective-audio.test): 70 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- `node scripts/lint-cards.mjs`: GATE PASSED. `npm run lint:content`: GATE PASSED.
- `npm run build:pages` (VITE_KOFI_URL set): green.
- Playwright `math-subject` project, `--workers=1`, built artifact: 9 pass, 0 fail.
- Zero edits under `src/game/loop/**`; `src/lib/flags.ts` and `public/flags.json` byte-identical to main.

## Open

- Screenshots (pair desktop, 390px, celebrate pose) live outside the repo: `~/workspace/math-holmes-watson/screenshots/`.
- Push / PR / merge: coordinator's and owner's steps, not the builder's.
- Full `npm test` and CI: not run locally (targeted-only rule); CI carries the bulk.

## Graph

- No knowledge-graph nodes added (integrator-only file; nothing here clears the "an agent would otherwise search for it" bar).
