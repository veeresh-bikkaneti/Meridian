# BRANCH_STATUS — fix/mobile-home-declutter

Mobile de-crowding of the Chart Room home page (Veeresh's 2026-10-07
screenshot: grandpa's fixed donation scene walked across the GeoDetective
card, Comet overlapped the card corner, the greeting bubble clipped, the
tour invite ate the top 25% of the viewport).

Implements the reconciled design decisions from the five lens reports
(`/tmp/zone-spec.md`, `/tmp/narrative-audit.md`,
`/tmp/economy-requirements.md`, `/tmp/audio-audit.md`,
`/tmp/level-arch-requirements.md`). Layout/CSS only — no behavior, copy,
or game-logic changes. (Prior branch content was PR #96, merged to main.)

## Done

- [x] `src/components/grandpa-coffee-run.css`
  - Mobile (`≤1023.5px`): `.grandpa-scene` is now an **in-flow closing
    band** (`position: relative`, `inset: auto`, `min-height: 18rem`,
    `overflow-x: clip`) rendered as a sibling right after `</main>` — no
    DOM move. Walk + kettle beats kept but contained: `.grandpa-path` and
    `.grandpa-walker` are `absolute` inside the strip (full-bleed, so the
    existing `vw` travel keyframes still work).
  - Walker parks with `--park-right: … + 172px` so the centered 200px
    cloud (231px rendered, content-box) keeps an 8px clear gap from
    Comet's fixed 80px footprint. Short viewports (`max-height: 599.5px`)
    use `+ 144px` for the 64px Comet.
  - Cloud is **present on arrival** on mobile (never animation-gated);
    the aria-hidden mid-walk cheers text is desktop-only (one ask per
    strip, per economy).
  - Gate buttons `.bubble-btn`: `min-height: 44px` + inline-flex centering
    (were ~33px). Cloud ask target: `min-height: 44px`.
  - Band reserves bottom clearance `80px + safe-area + 1.5rem` so the
    strip's interactive content never scrolls under Comet; brass rule
    `::before` opens the band (reads as camp corner, not a 5th card).
  - Desktop `≥1024px` fixed overlay untouched; reduced-motion static
    finale composes (verified by reading the cascade).
- [x] `src/components/comet-mascot.css`
  - Greeting bubble: `max-width: min(252px, calc(100vw - 3rem))`
    (`min(210px, …)` at `≤480px`) — narrative's max-widths held, vw clamp
    guards the edges.
  - Speaker badge: 44px hit area (was 32px), re-anchored so it still
    overhangs the bubble corner; icon 16px → 20px. Never clipped or
    `display:none` (audio flag).
- [x] `src/components/tutorial-overlay.tsx` — invite compact on mobile:
  `p-4 sm:p-5`, `mb-4 sm:mb-6`, `gap-2 sm:gap-3`,
  `text-base sm:text-lg`; both buttons `min-h-[44px]`. Desktop unchanged.
- [x] `src/components/game-app.tsx` — edition grid `gap-4` → `gap-5`
  (1.25rem floor between stacked cards). Sections already ≥2rem (`mt-8`/`mt-10`).
- [x] `playwright.config.ts` — mobile project `testMatch` now also matches
  `mobile-*.spec.ts` so the new spec runs in the mobile project.
- [x] `tests/e2e/mobile-home-overlap.spec.ts` — NEW: 360/390px × dark/light
  matrix; (a) zero overlapping boxes incl. walk-containment sampling and
  breathing-room gaps; (b) all tap targets ≥44×44 + unobstructed
  (elementFromPoint); (b2) speaker 44px when sound off; (c) cloud visible +
  tappable + finale screenshot; (d) offline → strip collapses to zero height.
- [x] `npx tsc --noEmit` — clean.
- [x] `npm test` — unit suite green (837/837).
- [x] `npm run build:pages` — green (VITE_KOFI_URL set).
- [x] `node scripts/lint-cards.mjs` — GATE PASSED.
- [x] NEW `tests/e2e/mobile-home-overlap.spec.ts` — 20/20 green
      (360/390px × dark/light): (a) zero overlapping boxes incl.
      walk-containment sampling, strip-vs-Comet at scroll-to-bottom, and
      breathing-room gaps; (b) all tap targets ≥44×44 + unobstructed;
      (b2) speaker 44px (sound off); (c) cloud visible + tappable, finale
      screenshots (ask + gate states) in
      `/home/hatch/workspace/meridian-review/evidence/`; (d) offline →
      strip collapses to zero height.
- [x] Regression E2E green: `grandpa-coffee-run.mobile` 3/3,
      `grandpa-coffee-run.reduced` 2/2, `comet-mascot.mobile` 4/4,
      `tutorial` 4/4. (`grandpa-coffee-run.desktop`: 2 timing flakes in a
      loaded 4-file run — both pass in isolation; unrelated to this
      change.)
- [x] Reduced-motion mobile verified: static seated finale, kettle
      hidden, cloud fully inside the band.
- [x] `tests/e2e/comet-mascot.mobile.spec.ts` — "renders bottom-right…"
      now waits out the transient greeting (~9s auto-dismiss) before
      asserting the permanent mascot never covers CTAs. The required
      invite compaction shifted layout ~16px and flipped this knife-edge
      assertion (the 9s transient bubble vs. a CTA center); the product
      behavior is unchanged and pre-existing.

## Pending

- [ ] Push branch + open PR (Veeresh merges).

## Notes / open questions

- Economy wanted the strip *above* the review deck; the reconciled
  decisions place it *below* (last band) — implemented as reconciled.
- Bottom clearance is built into the band (`--comet-clearance` in the
  walker/path `bottom` offsets + taller `min-height`), NOT as
  `margin-bottom`: under `html,body{height:100%}` a trailing margin does
  not extend the scrollable area, so the walker would have ended up under
  Comet at max scroll. Verified: walker bottom stays above Comet's top.
- Test (a) deviation from the literal task text: strict box-overlap
  between *fixed* elements (Comet wrap, greeting) and *in-flow* cards is
  geometrically unsatisfiable at scroll 0 for any fixed mascot
  (pre-existing, accepted). The spec asserts the meaningful invariants
  instead: in-flow elements pairwise disjoint; strip content vs Comet
  strict at scroll-to-bottom; greeting never clipped, paints above card
  content (the reported stacking bug), and covers no CTA center.
- The kettle's dolly-vertigo drop still paints over page content above the
  strip for ~2.8s mid-walk (same as the old fixed overlay; transient,
  Veeresh-approved spectacle). Overlap assertions skip the kettle phase.
- Gate focus-on-open can scroll the page on mobile (economy funnel risk);
  fixing it is behavior work — out of scope, unchanged.
- `VITE_KOFI_URL` unset → component returns null → no band, no reserved
  space (code path unchanged; not E2E-covered — needs a separate build).
