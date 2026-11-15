# feat/clue-scenes-math-7-10 — status

## Done

- Wave 1 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`, delivered with the programme brief):
  every Math item for ages 7-10 now carries a clue scene — the
  pilot's 3 kinds plus 8 new ones (bus-boarding, pack-boxes,
  place-value, place-compare, rounding-line, digit-shift,
  split-product, chunk-share) — so all 13 items in the band have
  the three-act treatment.
- Act 3 inherited from the pilot amendment, not reinvented: each
  description carries its narrated summary (clip, script, beat
  map) in the solved-phase data path; the performance re-paces
  the solved beat to the narration through the shared voice
  channel, captions step under the film, and the full script
  stands as text in the result section. The ten new clips were
  rendered locally in the pilot clips' voice (am_michael) at the
  same loudness targets; scenes data, manifest and clip files
  agree to the tenth of a second.
- The wave-1 kinds accept the same `stepDelay` pacing prop the
  pilot kinds use, so a summary performance re-paces them exactly
  like the pilot scenes.
- Tests: the subjects suite (135) passes, including the extended
  data contract (coverage = the band's items, labels digit-free,
  givens never the answer — two documented exemptions — beat maps
  pacing exactly the solved beat's steps, closings stating the
  answer); tsc clean; nav/content/cards lints pass; build green.
  Browser verification ran locally in headless Chromium against
  the built artifact (the disclosed Playwright substitute): 281
  checks over all 13 cases at desktop and 390 px plus a
  reduced-motion walk — all passed, no page errors. The e2e specs
  are extended to the full deal order for CI.
- Added JS: +5,303 B gzip (MathCase chunk) against the amended
  pilot build — far under the wave's 60 KB cap.

## Next step

- Owner review. Later waves follow the inventory's wave plan
  (Wave 2 = Math 10-18) and start only on the owner's word.

## Open questions

- Stacked on the pilot amendment (PR #482's act-3 commit): if the
  pilot branch changes again before merge, this branch rebases
  and the three pilot items' summary data follows the pilot's.
- place-compare and rounding-line carry the answer among their
  givens by necessity (the candidates / the hundreds ARE the
  question); blindness rests on the scene never marking the
  winner or the nearer end before the pick. Educator seat ruled
  in the PR body.
- math-number:division:big-quotients was flagged above-band by
  the inventory's educator seat (four-digit division); its scene
  teaches the chunking method as the stretch. Content unchanged —
  the flag is the owner's decision, recorded in the inventory.

## Ruled out

- A speech-synthesis narration for act 3 (an earlier draft of
  this wave): superseded by the pilot amendment's recorded-clip
  pattern — one voice, measured timings, captions that step with
  the clip. No per-item TTS at runtime.
- New scene kinds for items the existing kinds already fit
  (equal-groups rides pencil-packs with a new description only).

## Graph

No graph.json edit (branch rule). Nodes this branch would add:
the eight wave-1 scene kinds as renderer concepts under the clue
scene system; edges: each kind → the Math 7-10 items it serves
(bus-boarding → tables:buses, division:remainders; pack-boxes →
division:unknown-factor; place-value → place:hundreds-tens-ones;
place-compare → place:compare; rounding-line → place:round;
digit-shift → place:ten-times; split-product →
tables:big-products; chunk-share → division:big-quotients).

**Rebase onto main (2026-11-14, merge train authorised by Radhae):** the pilot (#482, merge commit `617e5391`) and the case-navigation fix (#485, merge commit `b5c9e569`) merged first. This wave's 24-file delta was rebased onto that main: every delta file's base version proved byte-identical to the version now on main (blob-hash comparison), so the wave's files apply unchanged — no conflicts, and the pilot items' scene data is byte-identical to what #482 merged. Wave 1 does not touch `SubjectCase.tsx` or `MathCase.tsx`, so #485's navigation work needed no merging here. Gates re-run on the rebased tree before merge (subjects unit tests, tsc, lints, build, added-JS measurement), with CI on the new head as the merge gate.
