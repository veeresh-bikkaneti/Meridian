# fix/art-off-content-visibility

**Task:** QA/UI-UX council fix (2026-11-16): stop the plain-surface
("art off") CSS rule from deleting content. The rule in `src/styles.css`
set `display: none` on the Why Learn montage hero and on every clue
scene under the high-contrast palette, `prefers-contrast: more`, and
forced colours — so a player in any of those states (including anyone
who had only turned on the map's persisted High-contrast view) got the
picker's title band with no film and cases with no visual explanations.

**Owner calls used:**

- Radhae, 2026-11-16: council of QA + UI/UX to find what else is broken
  on the live workers.dev site and fix it before handover; the montage
  must play and every question should have its video explanation.
- Standing: the montage plays whole and visible; visual explanation for
  every question is the product requirement.

**Status:** Built and gated locally; draft PR, awaiting the owner's
merge word. Base: main 0d47ad5f (verified 2026-11-16).
**Deliberate behaviour change for the owner to ratify:** under
forced colours / high contrast the film and scenes now stay visible
(forced colours delineate them with a CanvasText border) instead of
being removed. Decorative layers (wash, drift, world band, GK overlay)
are still hidden in those states, as before.

## Done

- `src/styles.css`: removed `.why-learn-hero`, `.why-learn-hero-wrap`
  and `.clue-scene` from all three `display: none` lists; extended the
  forced-colors `border: 1px solid CanvasText` treatment to
  `.why-learn-hero-wrap`, `.clue-scene` and `.why-learn-hero` itself
  (panel-review cure, 2026-11-16: the reduced-motion/film-failed
  branch renders a bare poster `<img>` with no wrap, and it is the
  hero most forced-colours users will actually get).
- `src/subjects/shared/why-learn-hero.test.ts`: regression pin — no
  plain-surface `display: none` rule may name the hero or the clue
  scenes; the decorative drift stays hidden; forced colours delineate
  content with CanvasText borders.
- Targeted gates: why-learn-hero + clue-scene + palette +
  palette-preference suites 59/59 pass. Full suite, tsc and build are
  carried by CI (see PR body).

## Next step

Owner merges; then verify on the live workers.dev picker with the
high-contrast view on: film visible, Math 7-10 case scene visible.

## Open questions

- Whether Radhae's own machine triggers this via the persisted palette
  or an OS contrast state — the 30-second DevTools check in the council
  report settles it; the fix makes the content visible either way.

## Ruled out

- Service worker / stale build as the cause of the band-only hero card:
  every media-failure path in WhyLearnHero leaves a visible box; only
  `display: none` leaves nothing. (SW media hardening is a separate
  branch: fix/hero-media-fallback.)

## Graph

- None. (Finding recorded in the council report
  `~/workspace/meridian-work/qa-uiux-council-2026-11-16.md` — outside the
  repo by the owner's handover instruction.)
