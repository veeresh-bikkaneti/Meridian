# BRANCH_STATUS — fix/question-bubble-globe-overlap

**State: BUILD COMPLETE, all 5 builder gates green (below). Ready = NO —
the full panel pipeline and the owner's merge word are still owed**
(standing rule: the panel approves the final tip itself).

Base: `origin/main 16ec9b39448df96272e7795332fec7c5c906e186`. Fixes the owner's bug report (`[t115u]`):
> "Bug that name card covers half the globe making it diff ult to click location"

## Root Causes & Fixes

1. **Auto-collapse instructions after the first placed pin (`run.results.length > 0` or `placesPlayed > 0`) and persist manual collapse across places (`src/components/game-app.tsx`)**:
   - Previously, the `[place?.id]` effect in `PlayLoaded` unconditionally reset `setBubble(defaultBubbleView())` on every round, re-expanding the full gesture instructions on rounds 2+ (`7 placed` in the owner's screenshot) and wiping out manual `Hide instructions` collapses.
   - Added `userCollapsedBubbleRef = useRef(false)` in `PlayLoaded` (updated via `QuestionBubble`'s `onViewChange` and Escape key toggle; reset in `onReplay`).
   - In the `[place?.id]` effect, after `setBubble(defaultBubbleView())`, if `run.results.length > 0 || (session?.placesPlayed ?? 0) > 0 || userCollapsedBubbleRef.current`, the card immediately sets `setBubble("collapsed")` so only the compact place-name card is shown from round 2 onward.

2. **Eliminate false `⋯ more below` scroll cue on short/medium place names & tighten vertical padding (`src/styles.css`, `src/components/question-bubble.tsx`, `src/components/scroll-cue.tsx`)**:
   - `.bubble-scroll` previously applied `padding: 6px 2px 30px;` to all name tiers, adding 30px of empty bottom scroll height that pushed `scrollHeight` past `clientHeight` (`min-height: max(120px, 20%)`) on normal 2–3 line place names (`Paniqui, Central Luzon, Philippines`). In addition, `<Enter>`'s initial `translate-y-3` (12px) transform on `.bubble-hint` increased `scrollHeight` on mount frame 0 without triggering `ResizeObserver` when the transform settled.
   - Changed `.bubble-scroll` padding to `padding: 4px 2px 6px;` and scoped the 28px scroll-cue fade reserve to `.bubble-shell[data-name-tier="long"] .bubble-scroll:not(.pcard-compact) { padding-bottom: 28px; }`.
   - Reduced `<Enter>` pre-mount offset in `question-bubble.tsx` from `translate-y-3` to `translate-y-1` (within the 6px bottom padding) and added a `transitionend` listener in `useMoreBelow` (`src/components/scroll-cue.tsx`).
   - Tightened `.bubble-shell` top padding (`14px` → `8px`) and `.bubble-toggle` vertical spacing (`margin-top: 2px; padding: 4px var(--bubble-pl);`, keeping `min-height: 44px`).

3. **Move `QuestionBubble` higher into the top-left corner and narrow its width (`src/components/question-bubble.tsx`)**:
   - Moved both `.pcard` wrappers from `top-[max(6rem,env(safe-area-inset-top))]` (`96px`, which left a 44px dead gap below the `Editions` bar) to `top-[max(3.625rem,env(safe-area-inset-top))]` (`58px`, 8px below the top-left HUD bar).
   - Narrowed the card width from `w-[min(352px,calc(100vw-20px))]` (`352px`) to `w-[min(296px,calc(100vw-20px))]` (`296px`), uncovering a large swath of the upper-left 3D globe.

## Builder Gates (Node v22.22.2)

- Gate 1 (`npx tsc --noEmit && npm run typecheck:worker`): PASS (`10.2s`)
- Gate 2 (`npm test && npm run test:worker`): PASS (`11.3s`, including 49/49 in `src/components/question-bubble.test.ts` and 85/85 worker tests)
- Gate 3 (`node scripts/lint-cards.mjs`): PASS (`0.66s`, 124,690 records validated)
- Gate 4 (`VITE_KOFI_URL=https://ko-fi.com/meridian npm run build:pages`): PASS (`20.8s`)
- Gate 5 (Playwright E2E against built artifact):
  - `tests/e2e/question-wrap.spec.ts`: 1/1 PASS
  - `tests/e2e/question-card-header.spec.ts`: 6/6 PASS (including new regression test for 296px width, 58px top offset, no false `more below`, and round 2+ auto-collapse)
  - `tests/e2e/place-card-redesign.mobile.spec.ts`: 6/6 PASS (`compact shell=(10,58,296x166) viewport=390x844`, `overlap=0.0px²`)
  - `tests/e2e/longname-scroll-a11y.desktop.spec.ts` (`-g "bubble backstop|dedicated probes"`): 13/13 PASS
  - `tests/e2e/longname-tiers.desktop.spec.ts` (`-g "question card"`): 24/24 PASS
