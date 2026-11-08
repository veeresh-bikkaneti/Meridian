# BRANCH_STATUS — fix/337-guess-counter

- **Branch:** `fix/337-guess-counter`
- **Base:** `main` @ `775d8b4` (#329 merged) · synced with `main` @ `9e49da3` on 2026-11-08 (merge commit; see Sync below)

## Task capsule

TASK / requested outcome: Fix issue #337 — the GeoDetective header
counter overstates by one once a case is finished: a case lost on
its 6th guess read "Guess 7 of 6" (owner screenshot, 2026-11-03),
a 1-guess win read "Guess 2 of 5". Finished case: show the guesses
actually made. Playing state unchanged. Builder silo: build, open
the PR, stop. NO MERGE without the owner's per-PR word; Silo QA and
the panel follow as separate silos.

Tier and rationale: Tier 1 — Solo TDD. One bug, one expression, a
clear repro (the owner's screenshot + the seeded finished cases
below).

Done condition / evidence: a new E2E spec seeds finished cases and
asserts the truthful header — it fails on the unmodified build with
the exact pre-fix strings, and passes after the fix; the shipped
playing-state pins in geodetective.spec.ts stay green; all gates
green (tsc, npm test, lint-cards, build:pages).

Files in scope: `src/game/loop/LoopScreen.tsx` (the counter
expression on the LoopGame header line only),
`tests/e2e/guess-counter.desktop.spec.ts` (new), this file.
Protected / untouched: LoopScreen's deal paths and the "Case #N"
header block (owned by the parallel #336 run), every other surface.
Redundancy: grep-verified — the header counter at this line is the
only surface that renders "Guess N of {cap}" from
`guesses.length + 1`; the reveal's "Solved in X of Y guesses."
already counts actual guesses and is untouched.

Assumptions: the rendered cap for a resumed case comes from the
puzzle's deal snapshot (`dealStartClues` / `dealMaxGuesses` →
`persistedDealConfig`); the spec's seeds stamp those fields so the
asserted caps (6 for the loss, 5 for the win) are the caps the
header actually renders — confirmed by the red run's page snapshots.

## Status

- [x] Fresh clone at `~/workspace/meridian-counter-fix`, branch cut
      at `775d8b4`
- [x] RED: new spec on the unmodified build — 2 failed, both on the
      header assertion. Page snapshots in the Playwright error
      contexts show the exact pre-fix headers: `- status: Guess 7
      of 6` (lost seed) and `- status: Guess 2 of 5` (won seed).
      Both seeds validated cleanly: each case restored as its
      reveal ("Out of guesses" / "🎯 You found it!") before the
      header assertion failed
- [x] FIX: one line — `finished ? puzzle.guesses.length :
      puzzle.guesses.length + 1` (the `finished` value already in
      scope on LoopGame; the neighbouring "— N left" suffix was
      already gated on it)
- [x] GREEN + gates on the tip: `npx tsc --noEmit` exit 0 ·
      `npm test` exit 0 (scripts 943 pass / 11 skip / 0 fail;
      src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED ·
      `npm run build:pages` exit 0 · E2E under
      `flock ~/workspace/.e2e.lock`, `--workers=1`, against the
      Pages build: **19 passed / 1 failed of 20** — new spec 2/2,
      `geodetective.spec.ts` 17/18. Every counter pin stays green
      (playing state: "Guess 2 of 5" after one guess, "Guess 1 of
      5" on a fresh deal; the win-path snapshot shows the finished
      2-guess win header reading "Guess 2 of 5" — post-fix truth;
      pre-fix it read "Guess 3 of 5"), so the playing state is
      untouched. The 1 failure is NOT the counter — see next item
- [x] Pre-existing failure, proven on unmodified main: the
      geodetective win-path test (spec:199) fails at its share-text
      assertion (spec:256) — expected
      `https://meridian.knowledgetest.workers.dev/`, received the
      Pages URL `https://veeresh-bikkaneti.github.io/Meridian/`.
      Cause: the share origin follows the build's baked base
      (`shareOrigin` in `src/lib/og/share-meta.ts`); the harness
      serves the Pages build (base `/Meridian/`), while the pin
      expects the Workers origin (PR #128). Proven pre-existing:
      the identical test on unmodified main `775d8b4` (worktree,
      same Pages build recipe) fails with a byte-identical
      received share string. (One main run also flaked earlier on
      a sheet/reveal heading strict-mode race — transient timing,
      unrelated.) Out of scope for #337; flagged for the owner as
      a separate test-pin/build mismatch. Correction note: the
      first status commit claimed "21/21" — that was a misread of
      a piped E2E summary (the pipe masked Playwright's exit
      code); the true counts are as stated here
- [x] Redundancy grep on the tip: line 1134 is the only
      "Guess N of {cap}" render in `src/`; the only other
      cap-denominated surface, the reveal's "Solved in X of Y
      guesses." (line 1633), already counts actual guesses
- [ ] PR opened against main — NO MERGE (owner's word only);
      Silo QA + panel follow as separate silos on the final tip

## Sync with main (2026-11-08, Rock — not a re-approval)

- Merged `origin/main` @ `9e49da3e` into this branch normally (no
  rebase, no force). The only conflict was this file (main carried
  another branch's status); resolved by keeping this PR's record.
  `LoopScreen.tsx` auto-merged; the fix line is now at line 1441
  (was 1134 at the original tip — main grew the file); it is still
  the only "Guess N of {cap}" render in `src/`.
- The panel's votes were on `8e3ccda`; this merge creates a new tip,
  so the panel must refresh on it. No merge without the owner's word.

