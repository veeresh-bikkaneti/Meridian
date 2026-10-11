# BRANCH_STATUS — fix/storyteller-figure-banner-only

Branch: `fix/storyteller-figure-banner-only` · Base: origin/main @ ec456a9 · Created: 2026-10-10.
**PUSH OK, DO NOT MERGE** — owner merges.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical:
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done (2026-10-10) — owner ruling: storyteller figure is banner-only

Dinesh's ruling (2026-10-10): the Grandpa mascot figure renders only in the
home banner. It was appearing on the result card (overlapping the
"STATE · NEBRASKA" header) and the run summary modal — both removed.

### Changes
1. `src/components/result-card.tsx` (~L369): `showFigure` → `showFigure={false}`.
   Comment updated (no longer "docked top-left, peeking ~40% above the card edge").
2. `src/components/run-summary.tsx` (~L95): `showFigure` → `showFigure={false}`.
   Comment updated.

### Not touched
- `src/components/storyteller-home.tsx` — the banner keeps the figure.
- `src/game/loop/LoopScreen.tsx` — already `showFigure={false}`.

## Pending
- ~~Full Scrum panel~~ — COMPLETE 2026-10-10. All 5 squads green on final head 91178dd:
  Design APPROVE-WITH-NITS · Eng APPROVE · Devex APPROVE · QA APPROVE · Security APPROVE.
  BLOCKs fixed: dock CSS peek/gap cleanup, e2e test moved to banner, banner
  pause/resume labels fixed (greetingPaused state + AbortError filter).
  Gates: tsc clean · 1089/1089 tests · lint GATE PASSED · build green ·
  visual 360/390px 8/8 · workflow + narration regression green.
- PR open → owner merges.
