# Stream W — Why Learn picker + subject cases (fix/ui-why-learn-layout)

Phase 2 stream of the UI/UX consistency fix. Base main `2ce6757a` +
Stream S cherry-picks (`a0458929`, `cc745790` as landed on this
branch). Frozen files untouched: `SubjectPicker.tsx`,
`screen-shell.tsx` (PR 515). Main files: `SubjectCase.tsx`,
`used-in-line.ts` (new), `styles.css`.

## Done

- **Item 12 leftover** — styles only, `@media (min-width: 1024px)`:
  hero height clamp dropped, film slot `flex: 1 1 auto` at its
  16/9, titles band a fixed 230px rail (the rail PR 515's Change
  band lands in). 681–1023px and phone layouts untouched.
- **Item 11 leftover** — horizontal scrollbar at 1280px: the
  full-bleed wash/world layers use the 100vw trick, which counts
  the vertical scrollbar's width and overflows by exactly that.
  `body:has(.why-learn-screen) { overflow-x: clip; }` (clip, not
  hidden: no scroll container, sticky untouched).
- **Item 13** — montage controls moved from the film's bottom-right
  (over the film's own lower-third text) to its top-right, still
  inside the film box and hero card. The pair half: measured in
  code, the SubjectCase pair host is in normal flow above the
  scene card — nothing positions it over the film; the picker
  hero's overlays are clipped inside `.screen-hero`
  (`overflow-hidden` in the shell markup). No code change needed
  there; recorded so the Phase 3 screenshot seat can confirm.
- **Item 14** — case-count stamp `.why-learn-chip` 10.5px → 14px
  in the AA brass `#6e4a0e`; case eyebrow 14px on case screens;
  `.clue-scene-replay` 13.5px → 14px; the case header's count now
  rides Stream S's `Pill`. ("Open case" is the picker's own button
  text at body size; its chip was the failing half.)
- **Item 15** — `usedInLine()` composes the result line per value
  shape ("<area>: <example>" → real-life framing; full sentence →
  stands alone; bare phrase → completes the line; empty → plain
  everyday-life sentence). Both render sites (win + lose reveal)
  use it. Unit-tested for every shape.
- **Item 16** — setup beat fully drawn on arrival: in the setup
  phase the scene's draw-in stagger is off (same treatment as the
  reduced-motion still: animations none, `.cs-draw` forced drawn,
  ticks hidden), so Physics Case 1 no longer opens nearly blank;
  the solved phase keeps its paced performance. Celebration: while
  a case screen is up, the overlay card docks to the bottom of the
  screen (`body:has(.subject-case-screen)`), below the film.
- **Item 6 slice** — the case's bottom "Start over" duplicate is
  removed; the header's End game is the case's one exit word. The
  picker keeps its own Start over. `onResetHistory` stays in the
  prop contract (wrappers unchanged); the case renders nothing
  from it. The case-navigation pin was updated in the same commit.
- **Item 21** — the picker media slot is never empty: the
  `.wl-card-film` wrapper now carries the atlas paper tone as a
  loading placeholder behind CardFilm's poster/film.
- **Item 22** — new e2e spec
  `tests/e2e/why-learn-montage-recheck.desktop.spec.ts`: draws the
  montage to a canvas twice ~700ms apart and requires the pixels
  to differ + currentTime to advance; unmutes via the sound
  control and requires playing + (where exposed) growing decoded
  audio bytes; asserts no sideways scroll at 1280. **Result: not
  run locally** — this sandbox's Chromium is the Muse browser
  binary and refuses plain headless startup ("Hatch WebGL domain
  policy is required"), the same limit PR 517's builder recorded.
  CI carries the spec; the recheck verdict waits on that run.

## Item 17 — root cause (measured), cure routed

Neither the count nor the filter is wrong. Probe on this branch:
Math deals 22 (7-10) / 28 (10-18) / 3 (18+) and `pickerRows`
reports exactly those — pinned in `stream-w-items.test.ts`.
The stale display comes from the band-change path: GameApp passes
`bandChangeRunInProgress={run !== null || loopOpen}` to the
picker, so with a GeoDetective case left open, `saveBand` defers
the change event to a round boundary that the picker never hits;
the picker's band state never re-reads, while AgeBandControl
shows the new band picked. Cure (one line, in files frozen or
owned by Stream N, so routed via the integrator, not edited
here): the picker host should not treat a background `loopOpen`
as a run in progress for the picker's own band control — e.g.
GameApp passes `bandChangeRunInProgress={run !== null}` to
SubjectPicker (the settings host keeps the current expression),
or SubjectPicker re-reads `getAgeGroup()` when its band control's
write lands.

## P2 sweep (owner-approved 2026-11-16)

- **Item 18 — DONE.** Root cause [measured]: Journals shipped
  (module `released: true`, cases in every band — the card reads
  "7 cases" + "Open case"), but the card's static one-liner still
  said "New journals are on the way." — written when Journals was
  planned-only. The card now speaks one message per state: ready →
  one-liner "Field notes from real places" and the kicker "Latest
  journal entry"; coming-soon → the one-liner is "New journals are
  on the way." and chip + action already say "Coming soon". The
  stale planned-only comment in `picker-rows.ts` is corrected.
- **Item 19 — REPORT (no content changed).** Scan of every Math
  item: the clue/lead text (the item's `why`, shown on the clue
  card) against its question prompt (`answers.ts`), plus every
  clue-scene script line against both. Verbatim repeat — the lead
  IS the question, word for word, nothing added: **1 item,
  `math-applied:measure:convert-metric`** (10-18). Near-verbatim,
  for the educator's eye: `math-number:fractions:divide` (lead and
  prompt differ only by "can be cut") and `math-number:tables:buses`
  (the why's first half is the prompt verbatim, then a strategy
  sentence). All other items: no repeat. Content fixes are the
  educator seat's; this list is the report to the integrator.
- **Item 20 — INVESTIGATED, not pinned; no code changed.** The
  grid's dead space is already cured in code: the fill rule
  (`.why-learn-screen > ul { flex: 1 1 auto; grid-auto-rows: 1fr }`,
  feat/picker-cards-fill-page) stretches the grid into the shell's
  leftover height, and the footer follows the grid in flow, so no
  fixed height or spacer below either was found in the picker or
  the shell. Storyteller art: the banner figure's sprite layers
  (`background-size: 300% 300%` in a square 56px box) and the
  static fallback (`object-fit: contain`) show no clipped-overflow
  container in code. The remaining mechanism needs the C5 capture
  in front of the Phase 3 screenshot seat (this sandbox cannot
  render — the item 13/22 limit); no CSS was guessed.
- **Item 20 — MEASURED on a complete install (tip `9067f91b`,
  rebuilt `build:pages`, headless Chromium): NOT REPRODUCED.**
  Picker, both 1280×800 and 390×844: grid bottom → footer top is
  103px, fully accounted for — 40px top margin + the 63px
  reset-history control row (border, 16px padding, 44px button);
  no empty band. Below the footer on picker and Home: exactly
  32px at both viewports = the shell main's `padding-bottom`
  (symmetric with its 32px top padding); after a full scroll the
  footer stops exactly 32px above the viewport bottom. Home's
  356px below the footer is the read-aloud preference prompt
  section (312px of real content mounted after the footer) plus
  that 32px padding — not void. Storyteller art NOT clipped at
  either viewport: the full head-and-shoulders figure renders
  inside the 56×56 banner box and the sprite layers exactly fill
  it (`300% 300%` sheet, one frame). No code changed.
  Screenshots: `~/workspace/verify-evidence-34b/item20-*`.

## Gates run here

- Targeted unit tests: all `src/subjects/**` suites 268/268,
  `src/components/ui/**` green (incl. the new stream-w-items tests).
- `npx tsc --noEmit` clean. `npm run lint:nav` clean.
  `npm run lint:subjects` GATE PASSED.
- `npm run build:pages` green.
- E2E: not run in this sandbox (browser limit above); the new
  recheck spec + the existing picker/case specs run in CI.
- Screenshots: not producible in this sandbox for the same
  reason; Phase 3's screenshot seat owns before/after at
  2560/1280/390.

## Graph

- Adds: branch node `fix/ui-why-learn-layout` (stream W), depends
  on Stream S components (`Pill` adopted in SubjectCase).

## Handoff

- Done: items 6 (slice), 11, 12, 13, 14, 15, 16, 21 as above;
  item 17 root-caused with its cure routed; item 22 spec written.
- Next: Phase 3 council + screenshot seat; CI e2e verdict on the
  montage recheck spec.
- Open questions: none for the owner from this stream.
- Ruled out: editing `SubjectPicker.tsx` for item 17 (frozen by
  PR 515); rewriting clue text for item 19 (educator's call).

## P2 sweep gates

- Subjects suites: 257/258 pass — the one failure is
  `answer-card.test.ts` failing to LOAD (`ERR_MODULE_NOT_FOUND`
  for typescript under this sandbox's linked node_modules; the
  known environment defect Streams G/K recorded, not an assertion
  failure). CI is the arbiter.
- `npx tsc --noEmit` clean · `npm run lint:subjects` GATE PASSED.

## CI cure (2026-11-16)

- CI build failed on 2 subtests of `scripts/e2e-telemetry-guard.test.mjs`
  ((c) + (c2) pin): the item-22 montage recheck spec calls
  `browser.newContext(` but was not listed in the guard's
  `CONTEXT_FILES`. The spec already imports and calls
  `serveBuiltArtifact` from `./helpers`, so the cure is registration
  only — one line added to `CONTEXT_FILES`; no spec behaviour changed.
- Verified locally: telemetry-guard suite 6/6 pass · `lint:subjects`
  GATE PASSED.

## Round 2 — Q2 hero cap landed (Variant B, owner's pick)

- Owner's pick: Variant B — bigger film, first card row just peeks.
  He approved the B mock (1920 shot) with a thumbs-up (2026-11-16).
- Landed: in the ≥1024px hero rule in `src/styles.css`, the film
  slot (`.why-learn-hero-wrap` and the direct-child
  `.why-learn-hero`) gets
  `max-width: calc((100dvh - 276px) * 16 / 9)`; the existing 16 / 9
  aspect drives the height. Commit `221a9d7e`.
- Measured on the landed tip (hermetic recipe, verify worktree,
  complete `npm ci`, pinned Chromium): 1280×800 film 931.5×524
  (mock 932×524), first card row slot top y=750 → 50px visible
  (mock 50px). 1920×1080: regression spec green (row top inside the
  viewport, visible slice in the 35–65px band, film 16/9); mock
  measured 1429×804 with 50px visible.
- Regression test: `tests/e2e/why-learn-hero-cap.desktop.spec.ts`
  asserts behaviour only (film keeps 16/9; first card row's slot
  top inside the viewport with a 35–65px slice showing) at
  1280×800 and 1920×1080. RED on the uncapped tip `da37878e`
  (1920 case fails — row below the fold; the 1280 case passes
  there, its 36px sliver sits inside the band). GREEN 2/2 on the
  capped tip. The spec measures the grid `<li>` row slot, not the
  card button: the button carries the home-rise entrance
  animation and sits ~18px lower until the rise settles.
- Gates on the landed tip: `npx tsc --noEmit` clean · `npm test`
  green (exit 0) · `npm run build:pages` green.
- Open item (515 layout math): PR 515's `lg:max-w-7xl` narrows the
  1920 column to 1280px, which changes the uncapped film size; the
  cap formula must be re-checked against the merged layout when
  515 lands. No 515 files touched here.
- Next: owner's merge word for this PR (merge train: 521 first).
- Ruled out: tuning the cap formula to the test — the landed
  formula is the mocked one, unchanged.
