# feat/subject-holmes-watson (Stream E)

## Done

- Holmes and Watson mount once, in the shared `SubjectCase`, behind the
  `detectivePair` flag (same flag as LoopScreen). `hostsStaging` sets the halo.
- Prod's own rigs are used as they are (`HolmesRig`, `WatsonRig`). No file
  under `src/game/loop/detective/` changed.
- Answer-blind: the pair receives only `{ state, nonce }`, built by
  `buildSubjectPairProps`, which drops every other field.
- Clips are existing fixed lines in `public/audio/detective/manifest.json`:
  open `lets-find-clues` (Watson), correct `win-holmes` (Holmes),
  wrong `ack-3` (Holmes, "Noted, Watson.").
- Every clip plays through the shared voice channel. A pick wins the channel;
  the open line is autoplay and waits its turn.
- Unit tests: `src/subjects/shared/subject-pair.test.ts` (5 pass).
- E2E: 7 new tests in `tests/e2e/math-subject.spec.ts` (13 pass in total).

## Next step

- Owner review. Mount is in place for every subject case, but e2e covers
  math and physics only.

## Open questions

- The brief asked for the case to stay behind `?scale=1` with `released: false`.
  The Stream E brief says subjects are live from the card and asks for no
  flag changes. This branch follows the Stream E brief.
- The `finished` state is not used. The subject flow has no end-of-deal screen.

## Ruled out

- New audio, new poses, new art. Only prod's existing clips and rigs are used.
- A wrong-pick silence. `ack-3` fits any wrong answer ("Noted, Watson.").

## Graph

- Adds: none.
