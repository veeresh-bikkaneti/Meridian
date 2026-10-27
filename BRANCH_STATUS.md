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

3. **Responsive top offset & 296px width on `QuestionBubble` + single-row `streak-flame` / `N placed` HUD (`src/components/question-bubble.tsx`, `src/components/game-app.tsx`)**:
   - Narrowed the card width from `w-[min(352px,calc(100vw-20px))]` (`352px`) to `w-[min(296px,calc(100vw-20px))]` (`296px`), uncovering a large swath of the upper-left 3D globe.
   - Set both `.pcard` wrappers to `top-[max(6rem,env(safe-area-inset-top))] min-[420px]:top-[max(3.625rem,env(safe-area-inset-top))]` so viewports `>= 420px` (where `x = 10..306` is horizontally clear of the right HUD stack) sit high at `58px`, while `< 420px` mobile viewports (`320x568`, `375x667`, `390x844`, where `defaultBubbleView()` already starts `"collapsed"`) sit at `96px` below the `N placed` row (`0 px²` HUD overlap across all 6 viewports).
   - Wrapped `streak-flame` and `{session?.hits ?? run.hits} placed` in `<div className="flex items-center gap-1.5">` inside the top-right HUD column in `src/components/game-app.tsx` so `streak >= 2` sits side-by-side with `N placed` on row 2 instead of stacking a 3rd vertical HUD row.

## Builder Gates (Node v22.22.2)

- Gate 1 (`npx tsc --noEmit && npm run typecheck:worker`): PASS (`11.5s`)
- Gate 2 (`npm test && npm run test:worker`): PASS (`11.4s`, 832/832 script tests, 1673/1673 src tests including 49/49 in `src/components/question-bubble.test.ts`, and 85/85 worker tests)
- Gate 3 (`node scripts/lint-cards.mjs`): PASS (`0.64s`, 124,690 records validated)
- Gate 4 (`VITE_KOFI_URL=https://ko-fi.com/meridian npm run build:pages`): PASS (`21.5s`)
- Gate 5 (Playwright E2E against built artifact):
  - `tests/e2e/question-wrap.spec.ts`: 1/1 PASS (`9.0s`)
  - `tests/e2e/question-card-header.spec.ts`: 6/6 PASS (including 6-viewport `0 px²` HUD non-overlap assertion across `320x568`, `375x667`, `390x844`, `768x1024`, `1024x768`, `1280x800`, responsive `y >= 94` / `y <= 62` bounds, 296px width, no false `more below`, and round 2+ auto-collapse)
  - `tests/e2e/place-card-redesign.mobile.spec.ts`: 6/6 PASS (`compact shell=(10,96,296x166) viewport=390x844`, `overlap=0.0px²`)
  - `tests/e2e/longname-scroll-a11y.desktop.spec.ts` (`-g "bubble backstop|dedicated probes"`): 13/13 PASS (`1m22.5s`)
