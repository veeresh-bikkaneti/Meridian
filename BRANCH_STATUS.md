# BRANCH_STATUS.md — feat/longname-pr1

**Branch:** `feat/longname-pr1` (off `origin/main` @ `a838fc6` — PR #72 merged 2026-10-06 ~10:29 CDT)
**Task:** "The Cartographer's Plate" — PR1 Wrap foundation per `~/workspace/your_files/long-name-design-spec.md` §12.
Doctrine: **names are the payload; containers flex, names never do.** No ellipsis, no clamping, anywhere.
**Status:** 🟡 IN PROGRESS

## Scope (nothing more, nothing less)
1. New `.place-name` utility in `src/styles.css` per spec §3 (`overflow-wrap: break-word`, `word-break: normal`, `text-wrap: balance`, `line-height: 1.28`). No `hyphens: auto`, no `break-all`.
2. Apply `.place-name` to: question-bubble name element (`src/components/question-bubble.tsx`), GeoDetective guess-list name span (`src/game/loop/LoopScreen.tsx` ~:632), bottom-sheet h2 (`LoopScreen.tsx` ~:697), reveal headings incl. ledger-TRUE-SPOT analog (`src/components/result-card.tsx` answer h2s + `pin-compare-line`, LoopReveal answer h2). Keep `title={placeName}` on name elements; no FIELD ENTRY tag (Veeresh: skip entirely).
3. Delete the ONE existing `truncate` at `LoopScreen.tsx:632` (`items-baseline` → `items-start` on the guess row).
4. Extend the existing no-clamp test gate (`question-bubble.test.ts`) to all four surfaces — zero ellipsis on names, labels, guesses, headings.
5. E2E: fixture-driven spec using the real longest names from spec §11 (98-char worst case → 7-char Lincoln) asserting full names render with zero ellipsis and no horizontal overflow, at 360/768/1280 × light/dark × reduced-motion. No `text-overflow: ellipsis` on name elements. `data-name-tier` NOT asserted (PR2). Frozen E2E seams: `difficulty-chip`, `pin-compare-line`, `miss-headline`, `growth-line`, `score-breakdown`.

## What's done
- [x] Clone + branch off `origin/main` @ `a838fc6`
- [x] `.place-name` utility in `src/styles.css` (spec §3 verbatim: `overflow-wrap: break-word`, `word-break: normal`, `text-wrap: balance`, `line-height: 1.28`; no `hyphens: auto`, no `break-all`)
- [x] Applied to all four surfaces: bubble h2 + collapsed p, guess-list span (+ deleted the ONE `truncate`, `items-baseline`→`items-start`), sheet h2, result-card answer h2s + `pin-compare-line`, LoopReveal answer h2 + closest-guess line. `title={placeName}` kept/added on all name elements
- [x] Extended `question-bubble.test.ts` no-clamp gate: 15 tests (4 describes) covering utility contract + all four surfaces
- [x] `npx tsc --noEmit` clean
- [x] `npm test` green — 724/724, 0 failures
- [x] Pushed to origin (commit 2ac63db)

## What's pending
1. Add `.place-name` utility to `src/styles.css`
2. Apply to the four surfaces + delete `truncate` at `LoopScreen.tsx:632` + keep titles
3. Extend `question-bubble.test.ts` no-clamp gate to all four surfaces
4. Gates: `npx tsc --noEmit` clean · `npm test` green · `npm run build:pages` green
5. Playwright E2E via VM lock (fixture-driven, real longest names, 360/768/1280 × light/dark × reduced-motion) — ⏳ RE-QUEUED with fix (see below). First attempt (18:08–18:21 UTC, lock held legitimately): 3/6 bubble tests hit the 240s timeout on `click "Play entire Canada"` — root cause is a TEST bug: Canada has no admin1 subdivisions so choosing it opens the country run directly; that button only exists for admin1-drilled countries (e.g. US). The game HAD started in all runs — screenshots prove the 106-char label wraps with zero ellipsis (`.place-name` works). GeoDetective tests: 3/3 passed (~10s each). Parent SIGKILLed the run at 18:21 UTC on a mistaken lock-bypass premise (lslocks proved this branch held the lock; corrected in report). Fix committed (4170a65): drop the non-existent button click. Re-queued behind game-sfx's rerun with `--reporter=line` for incremental output.
6. Open PR (base: `main`, head: `feat/longname-pr1`) — do NOT merge; Veeresh merges — AFTER E2E goes green

## Notes
- The old `feat/home-redesign` BRANCH_STATUS content is superseded by this file.
- `question-bubble.tsx` at this base has NO `truncate` (already removed upstream); PR1 only adds the `place-name` class there.
- The reveal ledger (`<dl>`) does not exist yet — it is a PR2 deliverable. PR1 applies `place-name` to the current reveal name surfaces (answer h2s + `pin-compare-line` in `result-card.tsx`, answer h2 in `LoopReveal`).
