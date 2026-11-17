# Stream G — games (GeoDetective and Cold Trail)

Branch `fix/ui-games`. Base: main `2ce6757a`. Owner of the stream's game
files (`src/game/loop/LoopScreen.tsx`, `src/game/coldtrail/TrailScreen.tsx`);
game-app.tsx changes go to Stream N through the integrator.

## Items (prompt §4, Stream G)

- 30. Guess count reads the band cap (5 or 6), not a hardcoded "Five guesses" — **LoopScreen half DONE (Phase 2)**; the game-app.tsx half is Stream N's (noted for the integrator; game-app.tsx not edited here).
- 31. **P0: Clue 1 gives away the answer — audit DONE in this PR (Phase 0.5). Data cure educator-gated, see below.**
- 32. Deck pill counts from one source; a subset never exceeds its total; one format — **DONE (Phase 2)**, see below.
- 33. Scout Map mode shows the simple fallback map, not an empty space — **VERIFIED (Phase 2)**, see below.
- 34. "A mystery is afoot" popup must not cover Clue 1; background hard line ~700 px — **INVESTIGATED, handed to Stream N with evidence (Phase 2)**, see below.
- 35. Cold Trail sightings use the viewer's clock, not 24-hour — **DONE (P2 sweep)**, see below.
- 36. Holmes covers Brazil; "RU" label clipped; darker tile seam over the Atlantic — **INVESTIGATED (P2 sweep), all three routed with evidence**, see below.
- 37. High contrast gets a label and a visible effect — **DONE (P2 sweep)**, see below.

## Phase 2 (Stream S cherry-picked: a0458929, cc745790)

- **Item 30 (LoopScreen half):** the intro now reads the number from the
  same cap the counter uses — `activeDealConfig.guessCap` (band deal in
  `src/game/age-profile/difficulty.ts`): "Six guesses…" on the 7-10 deal
  (cap 6), "Five guesses…" otherwise. No more hardcoded "Five".
- **Item 32:** counts measured first-hand: Cold Trail's bundled decks are
  60 core + 85 capitals (disjoint files), so the shelf showed "All cases"
  = 60 beside a deck chip of 85. New `resolveDeckCounts` in
  `src/components/pack-shelf-data.ts` is the one source both screens'
  chips resolve through: GeoDetective's pack (a subset of the core deck)
  is clamped to the core total; Cold Trail's "All cases" is the sum of
  its disjoint decks (145), with its closed count summed across both
  decks. A subset can never exceed its total — by construction, pinned
  by a unit test using the real 60/85 counts. Chip counts keep the one
  "{n} cases" format (`deckProgressLine`, the same format string the
  shared Pill uses; the chips are tappable, and the Pill contract
  prescribes Button + same format for tappable counts).
- **Item 33 (verify):** in Scout mode the main map renders
  `ScoutFallbackMap` (`src/map/satellite-map.tsx`, `buildScoutStyle` +
  `scout-fallback.tsx`) — a simple fallback map, not an empty space.
  GeoDetective's map already sits inside its map-error boundary, which
  swaps in the map-off line instead of a blank. PR 520 (in flight)
  extends the same containment to Cold Trail and the static fallback to
  full mode. Conclusion: no gap remains in Stream G's files; nothing to
  fix here.
- **Item 34 (investigated, handed to Stream N):** the "A mystery is
  afoot…" line is `src/components/storyteller-home-copy.ts:56`, rendered
  by the storyteller home surface — it never renders inside LoopScreen
  or TrailScreen, so the cover happens in the home→game layer that
  Stream N owns (game-app.tsx). GeoDetective's own background
  (`.mode-screen::before`, `src/styles.css`) is `position: fixed;
  inset: 0` — continuous by construction; the ~700 px hard line is not
  reproducible from LoopScreen's files and points at the shell behind
  the screen (also N's surface). Both halves go to N via the integrator
  with this evidence; no guessed CSS change made here.
- **Overlap note (PR 517):** LoopScreen.tsx and TrailScreen.tsx also
  carry PR 517's header hunks. This branch's LoopScreen hunk is the
  intro line only — outside the header block. TrailScreen untouched in
  Phase 2.
- **Screenshots:** NOT RUN — this sandbox did not produce a build +
  headless-Chrome run within the stream's budget; the Phase 3 QA seat
  checks the changed screens at 2560/1280/390.

## P2 sweep (2026-11-16, owner-approved)

- **Item 35 DONE:** sighting timestamps are fiction strings stored as
  "Tue 08:14" (24-hour). New `formatSightingTime` in
  `src/game/coldtrail/themes.ts` re-renders the clock with
  `Intl.DateTimeFormat` in the viewer's locale — "Tue 8:14 AM" for a
  12-hour viewer, "Tue 19:59"/"Tue 00:05" (two-digit hour) for a
  24-hour viewer — the same viewer-locale rule as the board's
  `formatUpdated`. Both themes' `sightingEyebrow` route through it;
  the gate-approved eyebrow wording is unchanged, only the clock
  segment is locale-formatted. Pins in `themes.test.ts` updated to
  the test runner's en-US rendering + explicit-locale tests added
  (en-US/en-GB/passthrough). SightingCard is the only render site.
- **Item 37 DONE:** the HighContrastToggle (`src/components/game-app.tsx`
  — the control lives there; this hunk lands on this branch under the
  P2-sweep assignment, flagged for the integrator) gains a visible
  "Contrast" text label beside the icon in both hosts, and the in-game
  host widens (`min-w-11` + padding, height still 44px) to fit it.
  Visible effect: the existing HC styles repaint only the `--map-*`
  tokens, which the satellite game screen never consumes, so the flip
  was invisible there. `src/styles.css` gains a second
  `:root[data-palette="high-contrast"]` block strengthening `--line`
  (fg 14% → 45% mix): every card/button/panel border on the game
  surface visibly strengthens on flip. Separate block on purpose —
  the palette pin tests slice the first block only, and `--line` is
  chrome, not map palette (pin tests still green).
- **Item 36 ROUTED (no fix in this layer):** all three sub-defects
  live outside Stream G's files, with evidence:
  1. *Holmes covers Brazil* — pair placement is the DetectiveHost /
     DetectivePair subsystem (`src/game/loop/detective/` +
     `detective.css` + `pair3d.ts`), a panel-gated surface with its
     own rig/flank/walk suites and the owner's staging spec; there is
     no rest-position constant in LoopScreen to offset. Moving the
     rest anchor needs that panel + the owner-config playthrough.
  2. *"RU" label clipped at the right edge* — the map is ONE raster
     source + ONE raster layer (`src/map/satellite-map.tsx:927-934`);
     there are no symbol/text layers in app code, so country labels
     are baked into the tile imagery and there is no label layer to
     pad. Map creation and camera are in the same file (line 905),
     which is PR 520's frozen surface — route there.
  3. *Darker tile seam over the Atlantic* — the style carries no
     background layer; per the comment at `satellite-map.tsx:1081-1083`
     a starfield backdrop shows wherever no tile paints. A darker seam
     is that backdrop showing through a tile gap/join — tile-source /
     frozen-map-file territory, not a style or blend setting in
     Stream G's files. Route with (2).

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
  Phase 2: item 30 (LoopScreen half), item 32 (one count source +
  test), item 33 verified (no gap in G's files).
- Next: educator seat rules on the 8 baselined cases + the borderline
  classes; approved cures land as reorder + re-render PRs that remove
  baseline entries. Stream N: item 30's game-app.tsx half; item 34
  (both halves — storyteller popup layer + shell background — evidence
  in the Phase 2 section above).
- P2 sweep (owner-approved 2026-11-16): item 35 DONE, item 37 DONE,
  item 36 investigated and routed with evidence (see P2 sweep section).
- Open questions: none for the integrator.
- Ruled out: text-only clue reorder (breaks check:detective-audio and
  the spoken/printed clue match); rewriting clue text (fabrication
  risk, educator's call); weakening the audio gate; a guessed CSS fix
  for item 34's background (its own background is fixed/inset-0 —
  continuous by construction).

## Graph

- Add node: `scripts/clues/clue-giveaway.mjs` (audit gate for item 31),
  edge: documents → public/loop/clues (the published clue files).
- Add node: `scripts/clues/clue-giveaway-baseline.json`, edge:
  depends-on → clue-giveaway audit.
