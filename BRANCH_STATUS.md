# BRANCH_STATUS.md — fix/question-card-truncation-edition

Veeresh's bug report (2026-10-04, with screenshot): "Bug: name is still showing ..... also show the edition name once edition is selected"

Screenshot: US country edition, header "UNITED STATES", title "West Cambridge/Harvard Square,..." (ellipsized), chip "Everyday · 1.5x".

## Bug analysis (confirmed from source)
- **Bug 1:** `src/components/question-bubble.tsx` renders the title with `line-clamp-3` (commit 59f0de0). Labels got longer (subdivision/country qualifiers per Veeresh's spec, `buildQuestionLabel`), so 3 lines still ellipsize: "West Cambridge/Harvard Square, Massachusetts" → "West Cambridge/Harvard Square,...". Fix: remove the clamp; full label always visible; max-height + scroll safety valve for pathological names.
- **Bug 2:** header renders only `run.regionName` ("UNITED STATES"). The edition *type* (Globe/Country/State) appears nowhere on the card. Verified: regionName updates correctly on mid-session edition switches (openRun creates a new run), so the gap is the edition type, not the region. Fix: pass `edition` to QuestionBubble; header becomes "Country · United States" / "State · Nebraska" / "Globe" (globe collapses — region name already is "Globe"). Existing uppercase micro-header style kept.

## Done
- [x] Branch + worktree from origin/main (de9b7a8); AGENTS.md read
- [x] Implemented: question-label.ts `bubbleHeaderText()`; question-bubble.tsx (line-clamp removed, max-h-48 + overflow-y-auto safety valve, edition header); game-app.tsx passes `edition={run.edition}`
- [x] Unit: question-bubble.test.ts contract updated (6/6); bubbleHeaderText tests in question-label.test.ts (34/34)
- [x] E2E: new `tests/e2e/question-card-header.spec.ts` — 5/5 green (West Cambridge full label, header Country/State/Globe, mid-session switch)
- [x] Gates: tsc clean, npm test 948/948, lint-cards PASSED, build:pages green

## Pending
- [ ] Reviews: technical-architect + tone/docs subagents (running)
- [ ] PR → merge (standing auth, only when green) → live verification
