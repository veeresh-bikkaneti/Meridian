# BRANCH_STATUS — fix/place-card-collapse

Branch: `fix/place-card-collapse` · Base: origin/main @ 51ed7f5 · Created: 2026-10-11.
**PUSH OK, DO NOT MERGE** — owner merges.

Standing rules: named-file staging only, never `git add -A`. Presentation-only change; game logic untouched.

## Done (2026-10-11) — place-card collapse redesign, all gates green

Owner order ~13:19 CDT (direction updated ~13:25): the question card must never take the whole screen on mobile; proper show/hide pattern; UX/UI personas own the design; motionmaxxing curves for the transitions.

### 1. Card compact by default on mobile — DONE
**Root cause:** the card opened in `open` state with a tall scroll region (`min-height: max(120px, 20%)`, backstop `min(38dvh, 20rem)`); "Hide place name" hid only the text, keeping the footprint.
**Fix:** new `defaultBubbleView()` in `game-app.tsx` — `collapsed` at ≤640px, `open` above — feeds the state initializer, the per-place reset, and replay. Collapsed card = meta band (eyebrow + locked difficulty chip + 44px X) + always-visible place name + "Show instructions" toggle. The compact name region caps at `min(24dvh, 12rem)` (≤35% of an 844px viewport; typical ≈ 18%).

### 2. Name never folds; instructions fold — DONE
The place name IS the question: one `h2.place-name`, visible in every card state (zero-ellipsis contract intact). Only the gesture-hint paragraph folds (conditional render = removed from AT). Toggle renamed to "Show/Hide instructions" — the old label was the owner's exact complaint. Single scroll region stays mounted so `useMoreBelow`'s ref never goes stale; scrollbar stays hidden (PR #77).

### 3. End game × X overlap — DONE
**Root cause:** End game sat at the bottom of the top-right score stack; its y depended on the conditional streak flame → at 390px it overlapped the card's X.
**Fix:** docks bottom-right above the drop-pin lane (`bottom: max(6.5rem, safe-area + 5.5rem)`), min-height 44px (was ~30px), renders during the aim phase only (never floats over the result sheet). E2E asserts 0px² bounding-box overlap with the X.

### 4. Motion — DONE (revised: no remount on toggle)
Vendored `--pcard-ease-reveal` (= `--ease-snap-settle`) and `--pcard-ease-exit` (= `--ease-accel-exit`) as `.pcard`-scoped custom properties in `styles.css` — no dependency on `motion-tokens.css` (PR #133 open). The toggle transition is the hint paragraph's own snap-settle reveal (250ms) + the chevron (snap-settle open / accel-exit shut), transform/opacity only.
**Revision during build:** the first cut remounted the card via `key={view}` on toggle; that detaches the scroll-region div while `useMoreBelow`'s mount-once effect keeps observing the dead element — the "more below" cue froze after expanding (spec §8.1 a11y signal). The shell now stays mounted across expand/collapse (structural unit test guards this); the cue stays live. `prefers-reduced-motion` = instant (CSS guard + opacity-only reduced path). One rAF effect per transition — no chained timers. auto-animate deliberately not used (would animate layout height).

### 5. Contracts — DONE
`BubbleViewState` ("open"|"collapsed"|"dismissed") unchanged. Drop-pin flow, map taps, Escape toggle, `aria-expanded`, named scroll region + `tabindex="0"`, focus ring — all intact. `BubbleViewState` import in game-app unchanged.

## Tests
- `src/components/question-bubble.test.ts` — rewritten for the redesign: 45/45 green (compact cap, name-always-visible, instructions fold, toggle runtime wiring, vendored curves, reduced motion, `defaultBubbleView`, End-game dock).
- `tests/e2e/place-card-redesign.mobile.spec.ts` — NEW, 5 black-box tests @390×844: compact footprint (<40% viewport height), expand shows instructions, collapse frees the map (elementFromPoint hits canvas), X × End game 0px² + ≥44px targets, drop-pin flow still commits.
- Updated for the toggle rename: `longname-wrap.desktop`, `longname-scroll-a11y.desktop`, `question-card-header`, `question-wrap` (+ stale "in the header" comment in `endless-game`).

## Gates
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — green (1105/1105)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [x] Playwright: `place-card-redesign.mobile.spec.ts` 5/5 green @390×844 (+ screen recordings, see below); `question-card-header` + `question-wrap` 6/6 green; `endless-game` 2/2 green (End-game dock flow); a11y `bubble backstop` matrix test now green at 360px after the no-remount fix
- [x] Screen recordings (constitution 2026-10-11): 5 webm sessions in `/home/hatch/workspace/meridian-review/evidence/place-card-redesign-*.webm`

## Pre-existing failures (verified on base 51ed7f5 via stash+rebuild — NOT from this change)
- `longname-wrap` + a11y `reveal` @360px: the deterministic Vancouver miss tap drifts just offshore at the 360px viewport, and ocean pins fail-close the pin-compare ledger by design (commit 4294f1a). Same failure on the unmodified base build.
- `endgame-share` 2 tests: fail on `ERR_TUNNEL_CONNECTION_FAILED` console errors — this VM's egress flakiness, unrelated to the redesign (the share flow itself works).

## Pending
- Owner watches the screen recordings / green-lights → then Chitti review (per the 2026-10-11 verification-evidence rule).
- Merge: owner's decision, per-PR.
