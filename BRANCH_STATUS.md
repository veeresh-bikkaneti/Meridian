# BRANCH_STATUS — fix/home-mascot-position (home layout: mascot bubble off-screen + About card void)

**State: PANEL FIX ROUND APPLIED — not merged. Ready: NO (panel
round 1 returned NOT READY — BLOCK ×3 / NITS ×7 / APPROVE ×2; the
cure below is applied, and a rule-13 panel re-vote on the cured tip
+ the owner's merge word are still owed).**

Base: `origin/main 41e1121` (rebased 2026-10-21 for the panel fix
round — PR #203 had landed on top of `25b3b68`; earlier rebase onto
`f9fa7e4` for panel review, pre-rebase tip `5b1698c` on base
`157d215`). CSS changed: `src/components/home-v5.css` (the fixes)
plus a comment-only cross-reference in
`src/components/storyteller-home.css`; one new E2E spec
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

**Fix (commit `b55d6d8`; originally `bd01abf`):** (1)
`.hv5-storyteller { margin-left: auto }` moved from the phone block
to the base rule, so the host sits at its line's right end at every
width — the popover's right-anchored geometry then always opens
inside the hero card. (2) Above 680px the popover's width is capped
so it also clears the headline's wrapped text: 224px at 768px and
up, 184px at 681–767px. The band cap arrived in the panel fix round
(below): round 1's single 224px cap rested on a first-line model of
the headline and overlapped its lower wrapped lines at 681–708px.
Phones keep the shared cap and their unchanged layout.

## Defect 2 — "How a round works" (About) card stretched, giant void

**Root cause:** `.hv5-pages` is a two-column grid (About beside the
tall Journal card). Grid items stretch to the row height by
default, so the short About card was stretched to the Journal's
height; the empty space below its two paragraphs measured 1336px
@768, 1469px @1024, 1827px @1280 (only 28px — the card's own
padding — @390, where a ≤680px media query stacks the sections in
one column, so there is no row partner to stretch against).

**Fix (commit `fa2e10d`; originally `5d47825`):** `.hv5-pages {
align-items: start }` — each card keeps its own height; the Journal
is unchanged.

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
path) at 390/681/700/767/768/880/1024/1280/1440 and asserts the
figure and the bubble lie fully inside the viewport, and (≥681px)
that the bubble intersects no headline glyph box (Range rects of
the actual text). About tests @390/768/1024/1280 assert the card's
internal void ≤ 56px. At 390 the bubble transiently overlays the
headline's first line — the popover's long-standing design (absolute
overlay, never reflows the page), unchanged by this fix — so phones
pin containment only; the spec header documents this.

**Discrimination (all runs executed):**
- Pre-fix build: mascot tests FAIL @768/880/1280/1440 with
  `bubble left` = −27/−177/−177/−97; PASS @390 and @1024. About
  tests FAIL @768/1024/1280 (void 1336/1469/1827px); PASS @390.
- Fixed build (round 1): **10/10 PASS.**
- Panel fix round, extended pin (13 tests): on the PRE-CURE build
  (224px cap only) the new @681/@700 tests FAIL on the
  headline-overlap assertion (at 681: glyph right edge 425.4px vs
  bubble left edge 396px); @767 passes (it pins the band's far edge).
  On the cured build: **13/13 PASS.**

## Panel fix round (2026-10-21) — panel round 1 verdict: NOT READY

Panel on tip `e37a895`: NOT READY — BLOCK ×3 / APPROVE-WITH-NITS ×7
/ APPROVE ×2, DevEx PASS-WITH-NITS, benchmark PASS. The cure,
exactly as prescribed:

- **Geometry BLOCK (Frontend Dev + Senior Dev,
  coordinator-confirmed):** the 224px cap's "clear of the headline
  at every width" claim failed at 681–~708px — the bubble intersected
  the headline's LOWER wrapped lines, not line 1. Cured with a 184px
  cap for 681–767px, chosen from a fresh glyph-level probe of the
  real wrapped headline across the band: at 224px the overlap ran
  from −2.4px @708 to −29.4px @681; at 184px every probed width
  clears (worst +10.6px @681, +19.6 @690, +29.6 @700, +96.6 @767),
  and ≥768px keeps 224px (measured +25.6px @768, +20.8 @1440). The
  refuted trough claims (903–967, 1081–1150) were not chased — no
  change there. Viewport containment (the owner's actual defect)
  was already cured at every width and stays cured.
- **Pin coverage:** MASCOT_WIDTHS gains 681, 700 and 767 (the band's
  far edge; 768 already pinned the first 224px width). The extended
  pin's discrimination is demonstrated above.
- **Provenance BLOCK (Office Hours):** three shipped texts
  overclaimed owner attribution (home-v5.css ×2, the spec header).
  All three now state the verified record: the owner reported ONE
  ~880px screenshot (the mascot, 2026-10-21); the width sweep and
  the About void are the fixing crew's own findings.
- **Comment wording:** the "clear at every width" claim is now true
  and worded exactly; the freeze phrasing separates the page shell's
  1280px cap from the headline font's growth to ~1444px; the phone
  sentence matches the spec (the bubble overlays headline line 1 on
  phones until dismissed); the spec's About rationale cites the real
  `.hv5-card` padding (26px → the 56px threshold), not 40/32px.
- **Convergent nits:** the fixed 1,200ms sleep is now a poll for the
  bubble's settled box; the figure click carries the `force: true`
  why-comment the precedent specs use; the spec header states the
  pin's honest limit (pointer path only — no keyboard or
  screen-reader coverage of the greeting path). One nit could not be
  applied as written: the Senior Architect's "sync the documented
  64–240px popover contract in storyteller-home-copy.ts" — that file
  (read in full) holds copy strings and date helpers and documents
  no width contract, and no 64–240px popover text exists anywhere in
  the storyteller sources. The width contract that does exist — the
  shared 320px cap in `storyteller-home.css` — gained a one-line
  cross-reference to the v5 caps instead; no edit was fabricated for
  the copy file.

## Gates (on the cured tip)

- `npx tsc --noEmit` — clean
- `npm test` — green (scripts 790 pass / 9 skip / 0 fail; src 1399
  pass / 0 fail — the src count rose from 1368 with PR #203 on the
  new base; this branch adds no unit tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Visual pin — 13/13 PASS on the cured build; discrimination vs the
  pre-cure build demonstrated (above)
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

Original build: `bd01abf` / `5d47825`, tip `5b1698c` on base
`157d215`. Rebased for panel review: `47a6c27` / `060136d` /
`e37a895` on `f9fa7e4`. Rebased for the panel fix round onto
`origin/main 41e1121`:

- `b55d6d8` — fix(home): storyteller figure keeps the hero row's
  right end (margin-left: auto at every width)
- `fa2e10d` — fix(home): About card keeps its own height beside the
  Journal (`.hv5-pages` top-aligned)
- `f2354a8` — test(home): visual layout pin + this file
- `826fd47` — fix(home): 184px bubble cap at 681–767px + comment
  cures (panel fix round)
- `b13037d` — test(home): pin extended into the band; settled-box
  poll; wording cures (panel fix round)
- this file's fix-round update

**Pending:** rule-13 panel re-vote on the cured tip; owner's merge
word. Do not merge from this branch's crew.
