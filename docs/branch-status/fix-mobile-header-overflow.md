# fix/mobile-header-overflow — PR 1 of the 2026-11-17 fix brief

Base: origin/main `4c3d84c8`. Tier 1 (three related layout bugs, clear repros).

## Plan

1. **Mobile header scrolls sideways (MAJOR).** `.site-header-actions`
   cannot shrink: Home's Join pill + the Menu button overflow the row
   (page 411px wide at a 320px viewport, +24px at 390px; the Menu
   button sits at x 337–411 at 320). Fix: SiteHeader gains an opt-in
   `exitInMenuOnSmallScreens` prop — below `--bp-sm` the exit control
   leaves the actions row and renders inside the menu panel instead.
   Home (the screen whose exit is the Join pill) opts in; game
   screens keep the invariant that End game never enters the menu.
2. **First-visit sheet clipped (MAJOR, from #518).** The overlay rule
   hard-codes `top: 19rem`/`10rem` and the queue class carries
   `w-full`, so at 390 the sheet is 411px wide (Dismiss cut off) and
   at 320×568 its last option is unreachable. Fix: position from a
   `--header-height` token, `left`/`right` from `--gutter`,
   `max-width: min(36rem, 100vw − 2·gutter)`, `max-height` with
   internal scroll.
3. **Sheet covers the mobile menu (MEDIUM).** Z-index was ad hoc.
   Fix: introduce the layer scale (`--z-base`, `--z-header: 30`,
   `--z-overlay: 40`, `--z-menu: 50`, `--z-modal: 60`); SiteHeader
   takes `--z-header`, and with its menu open it rises to
   `--z-menu` so the panel paints above the sheet. Choice recorded:
   menu above sheet (not hide-on-open) — one CSS rule, no JS
   coordination between header and queue.

Tokens introduced (minimum this PR needs; PR 3 systematizes):
`--bp-sm: 640px` (token of record — media queries cannot read custom
properties, so @media rules cite it in a comment), `--gutter: 1rem`,
`--header-height` (19rem below `--bp-sm`, 10rem above — the exact
offsets the Q1 cure measured), the `--z-*` scale above.

## Tests

New `tests/e2e/layout-overflow.desktop.spec.ts` (desktop project,
per-test viewports, hermetic recipe):
- no horizontal scroll (`scrollWidth === innerWidth`) and every
  visible header control inside the viewport at 320×568, 390×844,
  768×1024, 1280×800, 1920×1080; Join in the menu panel below
  `--bp-sm`, in the actions row at/above it.
- first-visit read-aloud sheet at 320×568: sheet box inside the
  viewport, header top ≤ 40px (Q1 contract), every option reachable
  and tappable.
- menu above sheet at 390×844: with the sheet pending, every menu
  item's centre hit-tests to the panel, not the sheet.

## Done

- All three fixes landed; `tests/e2e/layout-overflow.desktop.spec.ts`
  is 3/3 green on the branch and 3/3 red on main (measured:
  scrollWidth 411 vs innerWidth 320; sheet right edge 336 at a
  320px viewport; menu item #4 hit-tested to the sheet, not the
  panel). Revert check done: with the fix files stashed, the spec
  fails 3/3 again on the rebuilt artifact.
- Neighbour suites on the final build: nav-back-first-visit and
  grownups-privacy-contact pass (12 passed total with this spec);
  shared-shell unit suite 20/20; tsc clean; lint:nav clean;
  lint:subjects GATE PASSED; build:pages green.
- Next step: owner review; merge is the owner's word. PR 3 owns
  the remaining token migration and screen adoption.
- Ruled out: hiding the sheet when the menu opens (needs JS
  coordination between header and queue; the layer raise is one
  CSS rule and keeps the sheet's Q1 contract intact).

## Graph

No graph nodes added (integrator folds on merge if wanted): this
branch adds tokens `--bp-sm`, `--gutter`, `--header-height`, `--z-*`
to styles.css and one prop to SiteHeader.

## Open questions

- None. PR 3 owns the full token migration and the remaining
  screens' adoption.
