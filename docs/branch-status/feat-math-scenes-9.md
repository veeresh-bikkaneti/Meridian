# feat/math-scenes-9 — branch status

**Task:** Visual-questions spec §7.3 Phase 1 unblock wave: clue scenes
for the 9 wave-3 Math items for ages 7–10 that PR #495 left uncovered
(`scenes.test.ts` exact-coverage contract). Stacked on PR #495's tip
`feat/v2-math-overflow-items` @ `b1ffb4ae` (owner ruling 2026-11-15:
scenes first, stacked on the unmerged tip, then both merge in
succession). Retarget to main after #495 merges. Nothing in this wave
touches `items.ts`/`answers.ts`.

## Done

- **Six new kinds** (spec §3.4) in `src/subjects/shared/`:
  `tile-grid` + `measure-trace` + `clock-arc` + `unit-fit`
  (`clue-scene-kinds-d.tsx`), `fraction-slice` + `fraction-fill`
  (`clue-scene-kinds-e.tsx`); union members + `fittingUnit` /
  `elapsedMinutes` helpers in `clue-scene-types.ts`; dispatch +
  summary staggers in `ClueScene.tsx`; fills in `src/styles.css`
  (new classes only — no new literal easing curves; the wave reuses
  the pilot's animation classes).
  Kind → item: tile-grid → `measure:rect-area`, `groups:arrays`
  (brick glyph + row guides); measure-trace → `measure:perimeter`
  (loop), `measure:longer-than` (bars); fraction-slice →
  `fractions:fair-parts`, `fractions:equivalent`; fraction-fill →
  `fractions:compare-unlike`; clock-arc → `measure:elapsed-time`;
  unit-fit → `measure:choose-unit`.
- **Nine descriptions** in `src/subjects/math/scenes.ts` (givens,
  digit-free labels, summaries) — data only. Setup films perform
  the question's verb, first beat only (first row laid, first
  side bordered, first cut made, pour stopped below both marks,
  first five-minute chunk drawn, ant's first step); no solving
  motion, ticks or highlights before the pick.
- **Test harness** (`scenes.test.ts`): §7.2(1) structural-assertion
  variant for the three phrase-answer items (equal edges align;
  the fuller bottle is the 3/4 one; the stride glyph fits), with
  the closing-line assertion stating the answer as the item
  states it (numeric value or the correct choice's words — never
  the literal string "undefined"); `givensOf` / `stepCountOf` /
  solved-arithmetic cases for the six new kinds. Exact coverage
  itself is NOT weakened.
- **Nine summary clips** in `public/audio/subjects/` + manifest
  entries, rendered with the wave-1 pipeline (Kokoro-82M, voice
  `am_michael`, per-line renders joined with pauses, −18 LUFS /
  −1.5 dBTP, 24 kHz mono MP3 64 kbps); line timings in `scenes.ts`
  are measured from the rendered files. Clip table in the PR body.

## Gates (from logs)

- `scenes.test.ts`: 8 pass / 0 fail (base `b1ffb4ae`: 1 pass / 7 fail).
- Full `npm test`: 2689 pass / 1 fail — the one failure
  (`registry.test.ts` picker count 53 ≠ 29) fails identically on
  pristine `b1ffb4ae` (verified in a base worktree): pre-existing
  on the stacked base, not this wave.
- `npx tsc --noEmit` clean · `node scripts/lint-cards.mjs` GATE
  PASSED · `npm run lint:content` GATE PASSED (new 0).
- `npm run build:pages` green (`VITE_KOFI_URL` set). Bundle growth
  vs a base build of `b1ffb4ae`: MathCase chunk +4,543 B gzip,
  SubjectCase +6 B — ≈ +4.55 KB gzip total, under the §3.6 cap.
- Math Playwright e2e on the built artifact (finisher re-run,
  2026-11-15): 21 passed / 0 failed — math-subject project plus
  the clue-scene desktop/mobile/reduced specs, `--workers=1`
  under the e2e lock, `VITE_KOFI_URL` set at build+test.
- Provenance (finisher): `check-provenance` PASSED for the
  scenes range `b1ffb4ae..HEAD` and for PR #495's range
  `5fe47c1c..b1ffb4ae`.
- Clip durations (ffprobe, finisher): all nine ≤ 25 s —
  fair-parts 16.25 s, rect-area 17.48 s, elapsed-time 18.08 s,
  choose-unit 18.40 s, arrays 16.90 s, compare-unlike 19.33 s,
  longer-than 19.50 s, equivalent 19.70 s, perimeter 23.25 s;
  all ≤ 200 KB (largest perimeter 186,669 B).

## Next step

- Branch pushed by the finisher (2026-11-15); full gate record
  in `~/workspace/math-scenes-wave/BUILDER-REPORT.md`.
- Educator seat + independent Reality Checker gate (builder does
  not certify). Then the merge sequence: #495 first, this PR
  immediately after (spec §0), retargeted to main.

## Open questions

- Muted-film answer-blind review for the 9 setup films: done by
  the finisher (2026-11-15) by inspection of the scene
  descriptions + renderer code, setup phase only (no film was
  watched; the independent checker may re-run it visually).
  All 9 PASS — setup performs the verb's first beat only, with
  ticks, grids, rings and highlights gated to the solved phase:
  rect-area / arrays (tile-grid: first row only, no ticks or
  wash), perimeter (measure-trace loop: first plank only),
  longer-than (bars: first bar's trace only, no gap bracket or
  ticks; the bars' relative lengths are the givens),
  fair-parts / equivalent (fraction-slice: first cut per whole
  only, no wedges or equality line), compare-unlike
  (fraction-fill: first pour stops at 30%, below both marks; no
  grid or ring), elapsed-time (clock-arc: ghost arc + first
  five-minute chunk, hand at the start time, no counting
  ticks), choose-unit (unit-fit: path + ant's first step only,
  no glyph comparison or ring).
- B8 entrance parity for the case shell (§3.4.5/§3.5.3 of the
  theme-alignment spec) is NOT in this wave's scope — it belongs
  to step S3 of that spec's sequence, not §7.3.

## Ruled out

- Weakening the exact-coverage contract (owner rejected option b).
- Any edit to `items.ts` / `answers.ts`; `ramp-frame` /
  `squares-on-sides` (Phase 3); placeholder or substitute-voice
  audio.

## Graph

- Add node: six measure/fraction clue-scene kinds
  (`src/subjects/shared/clue-scene-kinds-d.tsx`,
  `clue-scene-kinds-e.tsx`) — the math clue scenes `depends-on`
  them; nine wave-3 items gain scene descriptions in
  `src/subjects/math/scenes.ts`.
- Add decision node: "Phase 1 scenes wave stacked on #495's
  unmerged tip; #495 merges first, scenes immediately after" —
  owner's words, 2026-11-15.
