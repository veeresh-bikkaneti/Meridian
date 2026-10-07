# BRANCH_STATUS.md — feat/longname-pr3

**Branch:** `feat/longname-pr3` (rebased onto `origin/main` @ `64c64e8` 2026-10-06 — PR #80 merged, plus #82/#83)
**Worktree:** `~/workspace/meridian-worktrees/longname-pr3`
**Task:** "The Cartographer's Plate" — PR3 Scroll architecture + a11y per `~/workspace/your_files/long-name-design-spec.md` §5/§6/§8/§10/§12.
Doctrine: **names are the payload; containers flex, names never do.**
**Status:** 🟢 E2E GREEN — opening PR (Veeresh merges, never merge).

## Scope
1. **Question bubble backstop** (`question-bubble.tsx`): shell `max-height min(38dvh, 20rem)`; name+hint as ONE scroll region (`overflow-y auto`, `role="region"`, name "Place name — scroll for more", `tabindex="0"`, visually-hidden scrollbar); fade mask + `⋯` + "more below" cue (`aria-hidden`, hidden when content fits / scrolled to bottom); meta band `position: sticky; top: 0`; collapse toggle renamed "Show place name"/"Hide place name" (`aria-expanded`, folded panel `hidden`, min-height 44px, full-width, name folded away entirely — honest, never clamped).
2. **Reveal card three zones** (`result-card.tsx`): pinned header (meta band + verdict `h2` "Result: …" with sr-only prefix + grade chip), single scrolling body (folds the two nested `max-h-44` story scrollers into one region; order ledger → story → growth → source), pinned CTA zone ("Next place →", min-height 48px, `var(--game-chrome-solid)`). Re-chromes to theme-aware `.game-chrome` — the PR2 `atlas-dark-scope` override is deleted per the PR2 deviation plan.
3. **GeoDetective** (`LoopScreen.tsx`): guess-list scroll region (`max-h 40dvh`, named region, rows never scroll); bottom-sheet pinned 48px dismiss header + pinned button bar + detents + `overscroll-behavior: contain`; LoopReveal three zones; clue-history summary rows (summary first, full text in DOM, expand on tap with `aria-expanded`).
4. **A11y §8 (all 10 normative):** scroll-region roles/names/tabindex; ≥2px `--atlas-brass-text` focus rings (offset 2px); `scroll-margin` on `:focus-visible`; 200%-zoom caps (meta band ≤30%, scroll region ≥ `max(120px, 20%)`); reduced-motion verification; contrast figures recorded; 48px CTA minimums; no italics.
5. **PR2 deferred deviations implemented:** collapse toggle labels, collapsed name fold-away, verdict `h2`, ledger dark-scope removal (re-chrome), clue-history summary rows, share text unchanged (confirmed).

## Veeresh's will honored
- PR #77 removed bubble scrollbars (scrollbar arrows overlapped the name) — the backstop uses fade + `⋯` + "more below" with a visually-hidden scrollbar, never reintroducing visible scrollbar chrome.
- E2E seams kept: `difficulty-chip`, `pin-compare-line`, `miss-headline`, `growth-line`, `score-breakdown` — none renamed.

## Done
- [x] Worktree + branch `feat/longname-pr3`; rebased onto origin/main @ 64c64e8; pushed to origin
- [x] `src/components/scroll-cue.tsx` (new): `useMoreBelow` + `<ScrollCue>`
- [x] question-bubble.tsx backstop restructure (shell cap, one scroll region, sticky meta, Show/Hide toggle, §6.1 compaction)
- [x] result-card.tsx three zones + theme-aware re-chrome (`atlas-dark-scope` deleted) + globe pin-compare true-spot country-level fix
- [x] LoopScreen.tsx: guess-list region, sheet 48px header, LoopReveal zones + clue-history summary rows
- [x] styles.css: PR3 CSS (zones, cue/fade, hidden scrollbars, focus rings, zoom caps, reduced-motion)
- [x] Unit tests: 816/816 green (incl. new scroll-cue tests + PR3 contracts)
- [x] E2E specs updated (question-wrap, question-card-header, longname-wrap, hit-story, reveal-bearing, reveal-pin-compare) + new `longname-scroll-a11y.desktop.spec.ts`
- [x] Gates: tsc clean · npm test 816/816 · lint-cards GATE PASSED · build:pages green · eslint 0 errors
- [x] Contrast figures recorded (see below)
- [x] **PR3 E2E: 42/42 green** (`longname-scroll-a11y.desktop.spec.ts`, 360/768/1280 × light/dark × reduced-motion + 6 dedicated probes)
- [x] Regression E2E batch 1: 104/118 (14 failures: 5 tap-flakes fixed, 8 overflow-wrap fixed, 1 mi-units fixed — all verified green on re-run)
- [x] Regression E2E batch 2: longname-wrap + reveal-bearing + reveal-pin-compare + reveal-your-pin-country-globe + reveal-zoomout — 39/42 (3 failures: 2 globe pin-compare fixed via true-spot country-level + test updates, 1 "Right state, wrong town!" stale pre-existing)

## Active
- [ ] PR opened (base main) — NOT merged (Veeresh merges)

## Known pre-existing issues (not PR3 regressions)
- `reveal-pin-compare` "same-state miss: 'Right state, wrong town!'" — test expects the old DOM (pre-dl structure); stale since PR #63.
- Globe puzzle for frozen date 2026-09-29 changed Hungary→Iran (dataset update); test expectation updated.

## Contrast figures (spec §8.9, WCAG relative luminance, measured 2026-10-06)
- Light `--atlas-brass-text` #8a5f16 on light surface #fffdf8 (bearing arrow + dossier number, >12px): **5.54:1** (≥3:1 large-text ✓, also clears 4.5:1)
- Focus ring dark: #e8b64c on dark game chrome ≈ **9.38:1** (≥3:1 ✓)
- Focus ring light: #8a5f16 on light game chrome ≈ **5.15:1** (≥3:1 ✓)
- Dark `--atlas-brass-text` #e8b64c on dark atlas-bg-1: 8.74:1
- (Spec's pre-recorded: dark brass 8.74:1, dark ink 13.3:1, light brass-sm 7.08:1, light ink 13.1:1, light rule 3.60:1 — unchanged.)

## Reduced-motion verification (spec §8.8, one-line check)
- `grep -n "transition" src/styles.css` on PR3 selectors: only the chevron rotations (`.bubble-toggle svg`, `.clue-history-toggle svg`) and button micro-transitions — all zeroed under `prefers-reduced-motion: reduce` in the PR3 block. Tier properties (font-size/weight) carry no transitions anywhere — tier switches are instant. Enter/Rise/Fade choreography already reduced-motion-safe in JS.

## Spec deviations (deliberate, rationale recorded)
1. **Scroll-region `min-height: max(120px, 20%)` makes short-name bubbles taller** — implemented verbatim per spec §8.7 (scroll region ≥ max(120px, 20%)). Side effect: a short name that previously fit in a compact bubble now gets a 120px-tall region. Veeresh's call whether the uniformity is worth it; flagged, not changed.
2. **Share text unchanged** — spec §5's units rule (miles/km) was already implemented in PR2; the share format itself carries no units change, so nothing to do. Confirmed, not a gap.
