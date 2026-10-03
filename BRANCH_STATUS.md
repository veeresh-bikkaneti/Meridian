# BRANCH_STATUS.md — feat/question-wrap

**Branch:** `feat/question-wrap` · **Base:** `origin/main` @ `9ec79ec`
**Task:** Fix question-bubble truncation — long qualified place names
("Fairchild Air Force Base, Washington") were single-line-ellipsized
("Fairchild Air Forc..."). Gameplay bug: an unreadable question is an
unfair game. Reported by Veeresh with a screenshot.

## Done
- [x] Worktree created from `origin/main` (9ec79ec), node_modules symlinked
- [x] `src/components/question-bubble.tsx`: replaced `truncate` with
      `line-clamp-3` on the place name in BOTH expanded (h2, text-xl) and
      collapsed (p, text-lg) views; kept `title={placeName}` tooltips.
      Bubble width unchanged (`max-w-[min(320px,calc(100vw-20px))]`); chip,
      buttons, and hints untouched.
- [x] `src/components/result-card.tsx`: checked — result-card title
      (`placeLabel`) has no truncation, wraps naturally; no change needed.
- [x] Accessibility: live region announces the same `questionLabel` the
      bubble renders — visible text matches the announcement; nothing to fix.
- [x] Regression test `src/components/question-bubble.test.ts` (4 tests)
      wired into `npm test`: asserts no `truncate`/`whitespace-nowrap` on
      either name element, `line-clamp-3` present, tooltips preserved.

## Pending
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build:pages` green
- [ ] Technical-architect review + tone/docs/accessibility review
- [x] Playwright E2E `tests/e2e/question-wrap.spec.ts`: 2/2 green (repeat-each=2,
      deterministic after including curated starters in pool seeding). Seeds
      Fairchild Air Force Base (gn-7261152, Washington chunk, whole-US country
      run), asserts the full label visible in expanded AND collapsed views
      (no ellipsis via scrollWidth/clientWidth + computed style), clean console.
      Evidence: `evidence/question-wrap-bubble.png` (full name wraps 2 lines).
- [x] `npx tsc --noEmit` clean; `npm run build:pages` green
- [x] Full unit suite: 681 tests, 0 failures (incl. 4 new question-bubble tests)
- [x] Technical-architect review: **approve-with-notes** (no P1s; P2s are accepted
      tradeoffs — names beyond 3 lines still cap silently on touch, documented;
      result-card needs no change confirmed; zero-cost confirmed)
- [x] Tone/docs/accessibility review: **approve-with-notes** (visible text matches
      live-region announcement; no copy/layout changes needed; BRANCH_STATUS
      accurate; no README churn)

## Pending
- [ ] Open PR → merge per standing auto-merge auth → verify live Pages build
      serves the merge commit → remove worktree

## Notes / decisions
- `line-clamp-3` (not unlimited wrap): the bubble floats over the map, so a
  3-line cap keeps extreme names from swallowing the viewport. Longest real
  qualified names wrap in 2 lines at text-xl within 320px.
- Label-building logic (`src/game/question-label.ts`) untouched; no data changes.
