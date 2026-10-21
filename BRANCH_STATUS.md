# BRANCH_STATUS — fix/home-mascot-position (home layout: mascot bubble off-screen + About card void)

**State: READY FOR PANEL REVIEW — not merged. Ready: NO (panel
review + the owner's merge word are still owed).**

Base: `origin/main 41e1121` (rebased 2026-10-21 for the panel fix
round — PR #203 had landed on top of `25b3b68`; earlier rebase onto
`f9fa7e4` for panel review, pre-rebase tip `5b1698c` on base
`157d215`). One CSS file changed
(`src/components/home-v5.css`) plus one new E2E spec
(`tests/e2e/home-visual-layout.desktop.spec.ts`). No behavior, copy,
dismissal-semantics, or game-logic changes.

## Defect 1 (primary) — storyteller greeting bubble off-screen

**Owner's report (2026-10-21):** on the production home page the
grandpa mascot sits at the hero card's far left and his speech bubble
renders mostly off-screen to the left (only a sliver and the ✕
visible); screenshot ~880px wide.

**Root cause (proven by reproduction, not guessed):** the bubble is
the storyteller greeting popover (`.storyteller-banner-popover`). It
is anchored `right: 0` to its 56px host (`.storyteller-banner`) and
opens leftward at up to 320px wide — correct back when the host sat
at the right end of the old full-width header banner (anchoring from
PR #118). The homepage v5 redesign (PR #158) moved the host into
`.hv5-hero-top`, a wrapping flex row. Above 680px nothing pushed the
host to its line's right end (the `margin-left: auto` rescue existed
only in the ≤680px phone block), so wherever the row wraps — hero-top
needs 760px of content; the bento hero cell is 614–870px wide across
viewport widths 768–1440 — the host lands at the LEFT of its new
line and the popover opens off the left edge. Measured on the
pre-fix build (fresh profile, figure tap): bubble x = −27 @768,
−177 @880 (pixel-match with the owner's screenshot), −177 @1280,
−97 @1440; fine @390 (phone block) and @1024 (row fits on one line).

**Fix (commit `bd01abf`):** (1) `.hv5-storyteller { margin-left:
auto }` moved from the phone block to the base rule, so the host
sits at its line's right end at every width — the popover's
right-anchored geometry then always opens inside the hero card.
(2) Above 680px the popover is capped at 224px wide: in the frozen
worst-case geometry (past ~1445px viewport the hero cell and the
headline both stop growing) only ~245px sits between the headline's
first-line text and the card's right edge, so the shared 320px cap
would have let the narrower bubble overlap headline text; 224px
clears it by ~20px. Phones keep the shared cap and their unchanged
layout.

## Defect 2 — "How a round works" (About) card stretched, giant void

**Root cause:** `.hv5-pages` is a two-column grid (About beside the
tall Journal card). Grid items stretch to the row height by
default, so the short About card was stretched to the Journal's
height; the empty space below its two paragraphs measured 1336px
@768, 1469px @1024, 1827px @1280 (only 28px — the card's own
padding — @390, where a ≤680px media query stacks the sections in
one column, so there is no row partner to stretch against).

**Fix (commit `5d47825`):** `.hv5-pages { align-items: start }` —
each card keeps its own height; the Journal is unchanged.

## Checked, NOT a defect — the band below the Journal

The sweep also flagged a large empty map-background band between
the Journal section and the grandpa coffee-run scene. Measured in
document space @1280 with images settled: the space is occupied by
(a) the ParentZone footer (100px, sits directly under the pages row
by design) and (b) on a FIRST visit, the read-aloud preference
prompt (312px, a real question card rendered in flow; it renders
nothing after the kid answers). The remaining "emptiness" is the
coffee scene's own transparent scenery over the atlas background.
Not the grid-stretch problem; no change made.

## Visual E2E pin — `tests/e2e/home-visual-layout.desktop.spec.ts`

Loads home in a FRESH first-visit profile (tutorial invite up; a
figure tap dismisses it and starts the greeting — the owner's exact
path) at 390/768/880/1024/1280/1440 and asserts the figure and the
bubble lie fully inside the viewport, and (≥681px) that the bubble
intersects no headline glyph box (Range rects of the actual text).
About tests @390/768/1024/1280 assert the card's internal void ≤
56px. At 390 the bubble transiently overlays the headline's first
line — the popover's long-standing design (absolute overlay, never
reflows the page), unchanged by this fix — so phones pin
containment only; the spec header documents this.

**Discrimination (both runs executed):**
- Pre-fix build: mascot tests FAIL @768/880/1280/1440 with
  `bubble left` = −27/−177/−177/−97; PASS @390 and @1024. About
  tests FAIL @768/1024/1280 (void 1336/1469/1827px); PASS @390.
- Fixed build: **10/10 PASS.**

## Gates

- `npx tsc --noEmit` — clean
- `npm test` — green (src suite 1368 pass / 0 fail)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Regression spot-check (existing specs over the touched CSS):
  dismiss-overlap.mobile, storyteller-home-greeting-watchdog.mobile
  — green. `storyteller-home.desktop.spec.ts` has a PRE-EXISTING
  flake on this VM: its "56x56" settle poll races the figure's
  breathing animation; across three runs its two tests alternated
  failing on BOTH the pre-fix and fixed builds (verified by
  rebuilding with main's CSS and re-running) — not a regression
  from this change.

## Screenshots (kept with the crew's working files)

- Before: `shots-before/home-{390,768,880,1024,1280}-bubble.png`,
  `pages-{390,768,880,1024,1280}.png`, `band-*.png`
  (in the crew worktree `~/workspace/bench-wt/mascot-fix/`).
- After: same names under `shots-after/`.

## Commits

- `bd01abf` — fix(home): storyteller figure keeps the hero row's
  right end; greeting bubble capped clear of the headline ≥681px
- `5d47825` — fix(home): About card keeps its own height beside the
  Journal (`.hv5-pages` top-aligned)
- this file + the pin spec commit

**Pending:** panel review; owner's merge word. Do not merge from
this branch's crew.
