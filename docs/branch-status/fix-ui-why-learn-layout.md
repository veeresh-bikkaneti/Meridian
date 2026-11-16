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

## Deferred (recorded, not built)

- Item 18 (Journals card message) — deferred per the re-priced
  plan (P2).
- Item 19 (Math clue repeats the question) — report-only per the
  prompt; no affected item was hit in this stream's files beyond
  what the educator seat already owns. Nothing changed.
- Item 20 (dead space below the grid / storyteller art) — deferred
  per the re-priced plan (P2).

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

## CI cure (2026-11-16)

- CI build failed on 2 subtests of `scripts/e2e-telemetry-guard.test.mjs`
  ((c) + (c2) pin): the item-22 montage recheck spec calls
  `browser.newContext(` but was not listed in the guard's
  `CONTEXT_FILES`. The spec already imports and calls
  `serveBuiltArtifact` from `./helpers`, so the cure is registration
  only — one line added to `CONTEXT_FILES`; no spec behaviour changed.
- Verified locally: telemetry-guard suite 6/6 pass · `lint:subjects`
  GATE PASSED.
