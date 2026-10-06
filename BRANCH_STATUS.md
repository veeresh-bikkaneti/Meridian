# BRANCH_STATUS.md — feat/longname-pr3

**Branch:** `feat/longname-pr3` (off `origin/feat/longname-pr2` @ `ab4676a` — already rebased on main incl. #76/#77/#78; PR #80 still open)
**Worktree:** `~/workspace/meridian-worktrees/longname-pr3`
**Task:** "The Cartographer's Plate" — PR3 Scroll architecture + a11y per `~/workspace/your_files/long-name-design-spec.md` §5/§6/§8/§10/§12.
Doctrine: **names are the payload; containers flex, names never do.**
**Status:** 🟡 IN PROGRESS — Veeresh merges (never merge).

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
- [x] Worktree + branch `feat/longname-pr3`; BRANCH_STATUS.md created

## Active
- [ ] `src/components/scroll-cue.tsx` (new): `useMoreBelow` + `<ScrollCue>`
- [ ] question-bubble.tsx backstop restructure
- [ ] result-card.tsx three zones + re-chrome
- [ ] LoopScreen.tsx: guess-list region, sheet header, LoopReveal zones + clue-history rows
- [ ] styles.css: PR3 CSS (backstop, zones, cue/fade, focus rings, zoom caps)
- [ ] Unit tests: question-bubble.test.ts + result-card.test.ts updates, scroll-cue.test.ts
- [ ] E2E updates: question-wrap, question-card-header, longname-wrap, longname-tiers + new longname-scroll-a11y spec
- [ ] Gates: tsc · npm test · lint-cards · build:pages · eslint
- [ ] E2E via flock lock (360/768/1280 × light/dark × reduced-motion) + 200% zoom
- [ ] Contrast figures recorded
- [ ] PR opened (base main) — NOT merged

## Spec deviations (deliberate, rationale recorded)
_(none yet)_
