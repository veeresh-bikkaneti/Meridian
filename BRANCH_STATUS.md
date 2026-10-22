# BRANCH_STATUS — feat/wave2-kid-ux-shell

**State: build complete locally; awaiting push via the owner route, then the Engineering Lead verdict (READY / NOT READY). Only the owner merges.**
Base: `origin/main 55ff0b50` (rebased 2026-10-23: #230 + #232 + #235 in).
Full write-up: `docs/reviews/2026-10-21-wave2-kid-ux-shell.md`.

## What this branch does (Branch 2 of the wave-2 kid-UX track)

- **WI-8** — Browser Back walks home → mode picker → round → result
  and never exits from inside a round. Same-URL history entries
  (new `src/lib/screen-history.ts` + GameApp wiring); the result
  replaces the round's entry; refresh-resume unchanged, with the
  stack rebuilt under a resumed run.
- **WI-9** — The storyteller's greeting bubble no longer overlaps the
  headline (measured 17,608px² at 320px before → 0px² at
  320/375/768/1280 after; the bubble's measured height drives the
  headline's margin via `--w2-bubble-clear`). 5–7 band: body and
  result text floored at 16px via `data-age-band`; tap targets ≥44px.
- **WI-10** — Top nav honesty: the dead Search button is removed
  (hidden, not disabled), its orphaned CSS deleted, and every nav
  item is labeled for the section jump it performs.
- **WI-11** — Map wording (copy only): the share description, the
  About section, and the GeoDetective case card now say the
  detective's map is labeled, while the endless modes keep the
  unlabeled-map wording that is true for them.

## Commits

- `51c419f` WI-11: honest map wording
- `3a223ea` WI-10: top nav honesty
- `c197709` WI-9: bubble clearance + readability floors
- `c217536` WI-8: Back/history + the three new e2e specs

## Gates (final head)

- `npx tsc --noEmit` — clean
- `npm test` — 1480 pass / 0 fail (includes 7 new screen-history tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Playwright (new): wave2-history 2/2, wave2-nav 1/1,
  wave2-readability 6/6 — plus the neighboring regression set
  (see the review doc for the full list and counts).

## Not in this branch (by file ownership)

- GeoDetective / Cold Trail screen layouts (Branch 3) — including
  two WI-11 follow-ups: the in-mode copy in `LoopScreen.tsx` and the
  ambiguous "unlabeled spot" aria-label in `LoopMap.tsx:910`.
- Result/story card content (Branch 4). Security headers (#212).

## Environment notes

- Built on Node v24.20.0 (the brief's Node 22 is not installed on
  this machine — deviation recorded in the review doc).
- This machine cannot push (HTTPS 401 / SSH reset) and `gh` is
  unauthenticated: delivery is git bundle + format-patch + a
  paste-ready PR body via the owner route.
