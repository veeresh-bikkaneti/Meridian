# BRANCH_STATUS.md — fix/question-card-truncation-edition

Veeresh's bug report (2026-10-04, with screenshot): "Bug: name is still showing ..... also show the edition name once edition is selected"

Screenshot: US country edition, header "UNITED STATES", title "West Cambridge/Harvard Square,..." (ellipsized), chip "Everyday · 1.5x".

## Bug analysis (confirmed from source)
- **Bug 1:** `src/components/question-bubble.tsx` renders the title with `line-clamp-3` (commit 59f0de0). Labels got longer (subdivision/country qualifiers per Veeresh's spec, `buildQuestionLabel`), so 3 lines still ellipsize: "West Cambridge/Harvard Square, Massachusetts" → "West Cambridge/Harvard Square,...". Fix: remove the clamp; full label always visible; max-height + scroll safety valve for pathological names.
- **Bug 2:** header renders only `run.regionName` ("UNITED STATES"). The edition *type* (Globe/Country/State) appears nowhere on the card. Verified: regionName updates correctly on mid-session edition switches (openRun creates a new run), so the gap is the edition type, not the region. Fix: pass `edition` to QuestionBubble; header becomes "Country · United States" / "State · Nebraska" / "Globe" (globe collapses — region name already is "Globe"). Existing uppercase micro-header style kept.

## Done
- [x] Branch + worktree from origin/main (de9b7a8); AGENTS.md read

## Pending
- [ ] Implement: question-label.ts `bubbleHeaderText()` helper; question-bubble.tsx (remove line-clamp, add safety valve, edition header); game-app.tsx passes `edition`
- [ ] Unit: update question-bubble.test.ts contract (no clamp, safety valve, edition prop); add bubbleHeaderText tests to question-label.test.ts
- [ ] E2E: new spec — long-label no-truncation (West Cambridge/Harvard Square, Massachusetts); header correctness Globe/Country/State; mid-session edition switch
- [ ] Gates: tsc, npm test, lint-cards, build:pages
- [ ] Reviews: technical-architect + tone/docs subagents
- [ ] PR → merge (standing auth, only when green) → live verification
