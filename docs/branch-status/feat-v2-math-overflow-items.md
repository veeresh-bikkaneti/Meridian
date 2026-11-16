# feat/v2-math-overflow-items — status

## Done

- Wave 3 of the Math playable items (follow-up to PR #477): all 24
  overflow rows from #477's accounting are now playable through the
  existing shared case flow — 9 more for 7-10 (band total 22) and 15
  more for 10-18 (band total 28); 18+ unchanged at 3. Playable total
  29 → 53.
- 6 items use the givens stated verbatim in their row; 18 items sit on
  rows that state no numbers, so their givens are authored (small,
  clean, school-method numbers), each flagged in its derivation in
  `src/subjects/math/answers.ts` for the educator, following the
  wave-1 mental-strategies precedent. All 24 entries are multiple
  choice; no typed-number entries.
- `math-applied:rates:linear-model` takes one part of its multi-part
  objective only: the day the tank reaches empty.
  `math-number:division:two-digit-divisors` asks one question only:
  the full pallets (13), with the 1 left over stated in the derivation.
- Build note (transparency): the first build of this branch was lost
  when the stream's workspace clone was wiped by an outside process
  mid-e2e-run (2026-11-14 ~23:07 CT; the run's partial output is kept
  with the stream's records). The branch was rebuilt from a fresh
  clone at the same base (`5fe47c1c`) with byte-identical diffs
  (same per-commit diff stats), and every gate below was run on the
  rebuilt tree.
- Tests (targeted, per AGENTS.md's testing-on-a-budget rule):
  `math.test.ts` 11 pass / 0 fail (counts 53 = 22/28/3, band
  membership for all 24, derivation recompute); `npx tsc --noEmit`
  clean; `npm run lint:content` GATE PASSED (violations=6, all
  baselined, new 0); `node scripts/lint-cards.mjs` GATE PASSED;
  `npm run build:pages` green; Playwright `math-subject.spec.ts`
  extended with a delimited wave-3 block playing the first wave-3
  item of each changed band to the result (results in the PR body).

## Next step

- Independent reviewer seats (educator/SME, a11y + reality checker)
  review the tip; the coordinator opens the PR with their verdicts.
  No merge without the owner's word.

## Open questions

- **Clue scenes (collision, owner's call):** main's clue-scene wave
  (#482/#486) covers exactly the 13 pre-wave-3 Math 7-10 items, and
  `src/subjects/math/scenes.test.ts` asserts that exact coverage.
  The 9 new 7-10 items have no scenes, so that suite fails on this
  branch (measured on the first build: 8 tests, 1 pass, 7 fail, all
  from the missing scenes). Scenes were not built here: this stream's
  rules are no-audio and no new UI, scene kinds live in
  `src/subjects/shared/clue-scene-types.ts` (shared files are out of
  bounds for this stream), and each scene carries a narrated summary
  clip that this stream may not create. The new items play through
  the unchanged clue-card path (the same path 10-18 items take,
  proven by the wave-3 e2e test). A scenes follow-up wave, or an
  owner-ruled contract change, is needed before merge if CI's full
  suite is the gate.
- Data accounting drift: the data files now hold 71 rows, not the 65
  of #477's accounting — 6 further 18+ rows (fractions:cloth-multiply,
  fractions:discount-percent, division:bulk-cases, rates:tank-fill,
  geometry:fence-posts, trig:slope-ratio) exist unplayed. They were
  never in #477's overflow or held lists and are out of this stream's
  scope; they stay unplayed.

## Ruled out

- Typed-number entries: every wave-3 item has at least two plausible
  common-mistake choices, so no item needed the typed kind to avoid
  giving its answer away.
- The 12 held rows from #477 (9 needs-a-scene plus
  tables:patterns, place:scientific, trig:law-of-sines) stay held,
  untouched.

## Graph

No graph.json edit (branch rule). Nodes this branch would add: none
— the wave-3 items are rows in the existing math data files, already
mapped; the integrator may add a "wave 3 playable" note to the math
subject node if one exists.
