# Votes: nav-home council (Wave 0)

Subject: the plan in `pack.md` (phase 1, design only) on branch
`fix/nav-label-and-home-cards` @ `a4677f4d`. Seats loaded from the
persona files named in `pack.md` §0. A council vote is not merge
authorization (`AGENTS.md` §2).

## Tally

| Seat | Persona file | Verdict |
| :--- | :--- | :--- |
| UI Designer | `docs/ops/personas/ui-designer.md` | APPROVE-WITH-NITS |
| UX Architect | `docs/ops/personas/ux-architect.md` | APPROVE-WITH-NITS |
| Accessibility | `docs/ops/personas/accessibility.md` | APPROVE-WITH-NITS |

**3/3 APPROVE-WITH-NITS.** No seat blocked; no challenge round.

## Verdicts (essentials, as relayed by the coordinator)

### UX Architect: APPROVE-WITH-NITS

1. Q1 label: **`Home`** everywhere. "Editions" means nothing to a
   7-year-old and does not lead to an editions list. No arrow: an arrow
   reads as "one step back".
2. Q4 not home, keep their own labels: `Exit review` (also ends the
   review), the admin-1 states list one-step back (label `Back`), the
   preview-sheet `Back` buttons, and the journal `Close`.
3. Q5(c): remove the `aria-hidden` slot holder that leaves a hole when
   Review is off.

### UI Designer: APPROVE-WITH-NITS

1. Q1/Q2: `Home` at top-left, first in the header row, mute beside it
   when the screen has sound. A chevron or house icon is decoration only
   (`aria-hidden`), never part of the name.
2. Q5/Q6 home grid: 3 equal columns from tablet width up; both rows
   follow the same column rhythm, so no empty cell; every card gets the
   same 16:9 picture on top; equal heights per row. 681–1080px: 3
   compact columns (2-line title cap, 16:9 crop, 44px CTA). 2 cards → 2
   equal columns; 1 card → one column capped at the 3-column width.
3. Q7: adopt the `.mode-screen` shell and the Cold Trail header pattern
   (eyebrow → title → sub) for the Why Learn picker and the subject case.
4. Q8: prefers mockup **option B** (hero picture plus subject cards),
   provided the image is under 90 KB and placeholder copy is replaced.
   The background waits for the owner's pick; nothing is built yet.

### Accessibility: APPROVE-WITH-NITS

1. Visible and accessible name exactly `Home`; no differing
   `aria-label`; no glyph inside the string.
2. Every home control ≥ 44×44 px with a visible `:focus-visible` ring;
   the info-page link (127×16) is a floor breach and must become the
   same 44px control (Q9).
3. Keep Why Learn text dark ink on an opaque or frosted surface; never
   pair the light `--atlas-ink` with a light page. Keep the picker's h1
   arrival focus. Subject rows may become cards, but no `h2` inside a
   `button` and no arrow glyph in names.
4. Keep DOM order on the home grid: no CSS `order` or
   `grid-auto-flow: dense` on cards.

## Enforcement proof

Recorded by the builder after the fix landed.

### Lint (`lint:nav`) on past mistakes

Each file is the version that shipped a hand-written home label,
piped through the new rule. All 7 exit 1 (13 errors); the branch
itself passes `npm run lint:nav` with exit 0.

```text
== git show 1b4e02dc:src/subjects/shared/SubjectPicker.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/subjects/shared/SubjectPicker.tsx
  138:8  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
exit=1
== git show 4ed32319:src/game/coldtrail/TrailScreen.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/game/coldtrail/TrailScreen.tsx
  199:110  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
  497:99   error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 2 problems (2 errors, 0 warnings)
exit=1
== git show 4ed32319:src/game/loop/LoopScreen.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/game/loop/LoopScreen.tsx
   943:76  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
  2213:78  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 2 problems (2 errors, 0 warnings)
exit=1
== git show 4ed32319:src/components/grownups/info-page.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/components/grownups/info-page.tsx
  15:100  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
exit=1
== git show 4ed32319:src/components/game-app.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/components/game-app.tsx
  6345:71  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts         no-restricted-syntax
  6619:40  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts         no-restricted-syntax
  8138:55  error  Hand-written home label string. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 3 problems (3 errors, 0 warnings)
exit=1
== git show 4ed32319:src/game/review-deck.ts | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/game/review-deck.ts
  132:19  error  Hand-written home label string. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
exit=1
== git show 4ed32319:src/subjects/shared/SubjectCase.tsx | eslint --no-inline-config -c eslint.nav.config.mjs --stdin
src/subjects/shared/SubjectCase.tsx
   94:10  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
  173:16  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
  184:12  error  Hand-written home label. Fix: use <HomeButton> (HOME_LABEL = "Home") from src/components/ui/home-button.ts  no-restricted-syntax
✖ 3 problems (3 errors, 0 warnings)
exit=1
```

### Layout spec on main

`tests/e2e/home-layout.desktop.spec.ts` against a build of main
(`a4677f4d`, docs only on top of `4ed32319`): **12 failed, 0 passed**.

| Viewports | Grid test fails on | Home test fails on |
| :--- | :--- | :--- |
| 320, 375, 390 | Review off: the hidden slot holder is counted as a card (3, expected 2) | Why Learn: no button named exactly "Home" |
| 768, 1024, 1280 | Review on: game row 2 has an empty cell (1 card in 2 columns) | Why Learn: no button named exactly "Home" |

The same spec on the branch: **12 passed**.

### Why Learn page (owner checklist t352u)

`tests/e2e/why-learn-page.desktop.spec.ts`: 8 tests (3 ages × 1280/390,
320/1440 overflow, reduced motion), 8 passed. Worst text contrast,
measured as the minimum over every background pixel under each text box
with the montage showing: 5.64:1 at all six viewports and at 200% zoom.

