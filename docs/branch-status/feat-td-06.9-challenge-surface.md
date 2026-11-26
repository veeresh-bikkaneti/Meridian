# Branch status: feat/td-06.9-challenge-surface

- Branch: `feat/td-06.9-challenge-surface`
- Base: `origin/main` at `da516bee` (TD-06.11 #625 merged; gate met)
- PR: draft #626 — https://github.com/veeresh-bikkaneti/Meridian/pull/626

## Done

- All four commits landed; `game-app.tsx` 7471 → 6350 lines.
  Heads: `803dabf1` (hook), `d549fe17` (welcome), `8c18b690`
  (complete/verdict), `ffdc091a` (menu).
- Gates: tsc clean; shell-registry + shared-shell + lazy-boundary
  + hook + menu source-pin tests green; size ceiling lowered to
  6350 (script + its test). Full gate table in the PR body.
- Deferred: none. Grandpa-media import stays on the composer as
  poster/video slots until TD-06.4 (checklist row 11).
- Goal: TD-06.9 — game-app-map steps 9, 11, 12, 19: challenge
  receive/preview hook + welcome + complete/verdict + challenge
  menu. Behavior unchanged.

## Plan

- Commit 1: `use-challenge-surface.ts` hook + test; the composer
  consumes it, and the router hook keeps receiving the two setters
  from it.
- Commit 2: `challenge-welcome.tsx` (moved verbatim); the composer
  keeps the overlay call site.
- Commit 3: `challenge-complete.tsx` (ChallengeComplete +
  ChallengeVerdict + recordChallengeCompletion, moved verbatim);
  the composer keeps the `<main>` shell, the end-of-flow HomeButton
  arrives as a slot, and poster/video arrive as slot props; the
  verdict settle state lifts to the PlayLoaded branch and resets
  per run. Registry `challenge-complete` row retargets.
- Commit 4: `challenge-menu.tsx` (inner view); the composer keeps
  the `<main>` + HomeButton shell (frozen shell-ban baseline: a new
  file must not add a `<main>` or HomeButton violation). Size
  ceiling lowered to the new `wc -l`.

## Constraints (verified on the tip)

- `noUpwardImport` 104, `noRawIo` 0, shell-ban total 6, ceiling
  7471. Baseline row 11 (grandpa-media) stays on the composer
  until TD-06.4, passed as poster/video slots.
- Frozen shell-ban baseline (shared-shell.test.ts): the lists must
  match exactly — no new entries, no growth.
- `SatelliteMap` stays lazy (untouched by this PR). No Play/Home
  code moves here.

## Done

- (see above; all four commits landed — heads in the header)
