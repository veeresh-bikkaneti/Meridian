# feat/v2-general-knowledge-more-items — branch status

**Task:** General knowledge v2 (Stream A brief, Nov 13): make more of the already-existing rows in `docs/scaling/general-knowledge/items.json` playable through the existing shared case flow — up to 10 new items per age band, no new screens, no data edits, no shared-file edits. Draft PR only — owner merges. Built on current main `8ff81671`.

**What the data actually holds (checked on main, brief counts corrected):** 11 curated rows. 7-10: 6 rows, 3 live → 3 unplayed. 10-18: 3 rows, all 3 already live. 18+: 2 rows, both already live. The brief's "10-18: 0 of 3 played, 18+: 0 of 2 played" does not match the data file or the live adapter; this branch trusts the data, so the growth lands entirely in 7-10.

**Scope:**
- `src/subjects/general-knowledge/items.ts`: `GENERAL_KNOWLEDGE_ITEM_IDS` gains `general-knowledge:mixed:older-landmark` and `general-knowledge:mixed:falls-in-km` (7-10, in items-file order); the header comment now states the slice rule (every multiple-choice-ready row plays) and names the one held row.
- `src/subjects/general-knowledge/answers.ts`: one `AnswerEntry` per new id, derived from its row — older-landmark: "Which landmark is older?" (Eiffel Tower, 1889 < 1973; standard 4.NBT.A.2); falls-in-km: "Is the falls wider or narrower than 2 km?" (Narrower; 2 km = 2,000 m > 1,708 m; standard 4.MD.A.1). Wrong choices are the common mistakes (the other landmark, "same year"; wider, exactly 2 km).
- `src/subjects/general-knowledge/general-knowledge.test.ts`: live counts updated (8 → 10 total, 7-10 3 → 5) plus a test that the two new answers follow from their rows' numbers and that the held row stays out.
- `tests/e2e/general-knowledge-subject.spec.ts`: new test walks the 7-10 deal order (opera-years-ago → eiffel-antennas → older-landmark) to the result screen.

**Held (not shipped):**
- `general-knowledge:mixed:noon-shadow` (7-10) — its objective is comparing three pictures of the Eiffel Tower's shadow and tapping the shortest; that needs a scene the shared AnswerCard flow does not have.
- 10-18 and 18+ gain nothing: every row in those bands already plays, so there is nothing left to add and no follow-up-10 list exists.

**Status:** Built and verified locally on main `8ff81671`; targeted tests per the owner's lean strategy, CI carries the full suite.
- Unit: `general-knowledge.test.ts` 7/7 pass.
- `npx tsc --noEmit` clean; `npm run lint:content` GATE PASSED (6 baselined, 0 new); `node scripts/lint-cards.mjs` GATE PASSED.
- Vite production build green, run directly (entry chunk built; the two new ids are in the built general-knowledge chunks).
- `npm run build:pages` as a single command: NOT RUN to green in this environment — its prebuild chain passed the places, lint-cards and check-flags gates, then stopped at the detective-audio gate because this local mirror's `public/audio` is incomplete (the detective manifest is absent from the mirror). The full repo in CI has every file; the gate is expected to pass there.
- E2E spec extended but NOT RUN here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"). Also flagged for the owner: on current main no Playwright project in `playwright.config.ts` matches this spec's filename (`--list` shows 0 tests for it across all 57 projects), so CI's `npx playwright test` does not pick it up either; wiring it into a project is outside this branch's named files.
- `/pstack`, `gstack` and `agent-agency` are not installed in this environment; the review seat was a plain sub-agent, and its verdict is pasted verbatim in the PR body.

**Still open:**
- Owner merges after CI is green and the second reviewer checks the final tip. Educator review of the two new derivations runs alongside release (progressive release, owner rule Nov 13); neither new answer is a judgment call — both recompute from the rows' own numbers.
- Follow-up candidates: none for this subject — every multiple-choice-ready row now plays; noon-shadow waits on a picture-comparison scene, which is a different feature.

## Graph
- Adds node: General knowledge v2 items (src/subjects/general-knowledge/items.ts + answers.ts) — documents the 2026-11-13 Stream A brief; depends-on the shared case flow (src/subjects/shared/SubjectCase.tsx, answer.ts) and the curated rows (docs/scaling/general-knowledge/items.json); supersedes nothing — it extends the v1 live slice from 8 to 10 items.
