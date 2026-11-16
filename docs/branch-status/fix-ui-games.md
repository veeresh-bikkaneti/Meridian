# Stream G — games (GeoDetective and Cold Trail)

Branch `fix/ui-games`. Base: main `2ce6757a`. Owner of the stream's game
files (`src/game/loop/LoopScreen.tsx`, `src/game/coldtrail/TrailScreen.tsx`);
game-app.tsx changes go to Stream N through the integrator.

## Items (prompt §4, Stream G)

- 30. Guess count reads the band cap (5 or 6), not a hardcoded "Five guesses" — pending (Phase 2).
- 31. **P0: Clue 1 gives away the answer — audit DONE in this PR (Phase 0.5). Data cure educator-gated, see below.**
- 32. Deck pill counts from one source; a subset never exceeds its total; one format — pending.
- 33. Scout Map mode shows the simple fallback map, not an empty space — pending.
- 34. "A mystery is afoot" popup must not cover Clue 1; background hard line ~700 px — pending.
- 35. Cold Trail sightings use the viewer's clock, not 24-hour — pending.
- 36. Holmes covers Brazil; "RU" label clipped; darker tile seam over the Atlantic — pending.
- 37. High contrast gets a label and a visible effect — pending.

## Item 31 — what this PR does

Audit of all 497 published cases (`scripts/clues/clue-giveaway.mjs`,
tests in `scripts/clues/clue-giveaway.test.mjs`, wired into `npm test`
via the scripts suite):

- NAME_LEAK (a clue contains the answer's name or an alias): **0 cases**
  in any slot [measured].
- CAPITAL_GIVEAWAY (a slot 1–4 clue states in the present tense that the
  answer is the capital/chief city of a named region): **8 cases, all
  slot 1** [measured]: 20 Karaj (Alborz), 133 Harare (Zimbabwe),
  147 Ufa (Bashkortostan — the reported B35 case), 176 Niamey (Niger),
  199 Brisbane (Queensland), 218 Ankara (Turkey),
  295 Santiago de Compostela (Galicia), 304 Am Timan (Salamat).
  These 8 are pinned in `scripts/clues/clue-giveaway-baseline.json`
  (KNOWN/STALE pattern, same as lint-subject-leads): a new violation
  fails the test; a cured case fails as STALE until its entry is
  removed, so the list only shrinks.

### Why no clue data changed in this PR

The cure for each case is moving the offending clue to slot 5 — but a
text-only reorder desyncs the pre-rendered speech. The detective audio
manifest pins each line's text and speed per slot, and the render plan
reads slot 1 at speed 100 and slot 5 at speed 105
(`CLUE_SPEEDS = [100, 97, 95, 92, 105]`). `verifyManifest` accepts a
moved line only if its stored speed equals the new slot's plan speed,
or differs by a multiple of 3 in [−6, +18] with a genuine retry-ladder
note. Checked against the stored speeds of all 8 cases [measured]:
every slot-1 line fails that test at slot 5 (deltas −5, −5, −5, +1, −5,
−8, −5, −5), and hand-editing the manifest to match would falsify a
render record. So each case needs the reorder **plus a re-render of the
two affected lines**, which is educator-gated content work. Per the
job's rule — a case that cannot be fixed by reordering alone keeps its
data and is listed for the educator — all 8 are listed in the PR body.

### Educator list (borderline classes the audit deliberately does not fail)

- "Capital of an unnamed subdivision in <country>" in slot 1 (~20
  cases, e.g. 16 Guadalajara, 43 Nanchang, 48 Imphal, 121 Chennai):
  the corpus's standard narrowing style; the educator rules whether
  the ladder allows it.
- Capital status plus a superlative or coarse location (197 Sucre
  "world's next-highest capital", 428 slot 2 "least rain of any capital
  on its continent", 9 La Rioja).
- Past-tense capital history in slots 3–4 (the Capitals pack's history
  tier especially): premise and history, not present identification.

## Handoff

- Done: item 31 audit + gate + baseline; negative control passed
  (planted violation in case 0 → audit exit 1; restored → exit 0).
- Next: educator seat rules on the 8 baselined cases + the borderline
  classes; approved cures land as reorder + re-render PRs that remove
  baseline entries. Stream G items 30, 32–37 in Phase 2.
- Open questions: none for the integrator.
- Ruled out: text-only clue reorder (breaks check:detective-audio and
  the spoken/printed clue match); rewriting clue text (fabrication
  risk, educator's call); weakening the audio gate.

## Graph

- Add node: `scripts/clues/clue-giveaway.mjs` (audit gate for item 31),
  edge: documents → public/loop/clues (the published clue files).
- Add node: `scripts/clues/clue-giveaway-baseline.json`, edge:
  depends-on → clue-giveaway audit.
