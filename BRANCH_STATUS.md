# BRANCH_STATUS — feat/high-contrast-view

**Branch:** `feat/high-contrast-view`
**Base:** `main` at `daa03ad028252060d57a5c83ee35aef8e988a1fe` (merge-base = base; no rebase needed)
**State: MERGED 2026-10-28 (squash `d39bc3e`, PR #275) on the owner's word, after the cure-round panel re-vote approved the final tip `c68e3f6` (READY, 0 BLOCKs, DevEx PASS-WITH-NITS). This file's branch record is now historical; main's live status is tracked per-branch as new work opens.**

## Scope

Finish the high-contrast view: the palette tokens landed in `1cb6a41`
(`src/game/palette.ts` + tests — fail-closed `selectPalette`,
`STANDARD` / `HIGH_CONTRAST`, WCAG `contrastRatio`). This branch adds
persistence, a settings toggle, live swap, and the GeoDetective
label-safety guarantee, under the signed Tier-2 Consensus Manifest
`.council/manifests/2026-10-27-high-contrast-view.md`.

**Manifest-first claim, corrected (panel BLOCK 4 cure):** Palette
tokens (`1cb6a41`) predate the manifest; the manifest (`5588233`) was
committed before the preference/toggle wiring implementation and
scopes itself to post-`1cb6a41` work. The cure addendum (2026-10-28)
was committed before the cure implementation.

Task capsule (summary; the manifest is the record of record):
- **Done condition:** scenarios 1–8 of the manifest — toggle on/off in
  place, persistence across reload, mid-run live swap without
  navigation or round loss, corrupt/throwing storage fails closed to
  standard, GeoDetective labels untouched, arc ≥3:1 on water+land in
  BOTH palettes proven by test.
- **Deviation D1:** storage key is the shipped `PALETTE_STORAGE_KEY`
  `"meridian.palette"` (dot form, pinned by the existing test and the
  `meridian.sound` family pattern), not the brief's `"meridian:palette"`
  spelling. Values: `"high-contrast"` / `"standard"`.

## Done

- [x] Tier-2 Consensus Manifest signed + committed alone + pushed (`5588233`)
- [x] Palette verification: the 8 pre-existing palette tests pass, and
      the STANDARD arc test this branch adds (the suite's 9th test at
      build time) proves STANDARD arc ≥3:1 on water (13.9) and land
      (8.3), measured — not assumed
- [x] `src/game/palette-preference.ts` — storage + apply module
      (sfx.ts pattern: try/catch storage, `data-palette` attribute,
      `meridian:palette-change` event), fail-closed via `selectPalette`
- [x] `src/styles.css` — `:root[data-palette="high-contrast"]` block with
      the five HIGH_CONTRAST `--map-*` overrides (source-pinned to tokens)
- [x] `game-app.tsx` — `HighContrastToggle` beside `SoundToggle` on home
      (`high-contrast-toggle`) and in-game (`high-contrast-toggle-game`,
      44px target), plus the boot `applyPalettePreference()` effect
- [x] Live swap: `atlas-map.tsx` palette-change listener (dirty +
      redraw); `satellite-map.tsx` ring layer takes the active palette
      arc at style load + palette-change `setPaintProperty`
- [x] GeoDetective: no label/marker/imagery code touched (manifest D5)
- [x] Unit contracts: `palette-preference.test.ts` (RED first, then GREEN)
- [x] E2E spec: `tests/e2e/high-contrast.desktop.spec.ts` (4 cases at build)

## Gates (on code-final tip `ce95ac3`, Node v24.22.1 local; CI 22.x canonical)

- [x] (a) `npx tsc --noEmit` — exit 0, clean
- [x] (b) `npm test` — exit 0 (scripts 861 tests: 850 pass / 11 skip /
      0 fail; src 1720: 1720 pass / 0 fail) + `npm run test:worker` —
      exit 0 (85: 85 pass / 0 fail). One cure cycle en route: a
      source pin in `palette-preference.test.ts` asserted the wrong
      source shape (`data-testid=` literal vs the `testId` prop
      pattern) — pin fixed in `ce95ac3`, feature unchanged.
- [x] (c) `node scripts/lint-cards.mjs` — exit 0, GATE PASSED
- [x] (d) `npm run build:pages` — exit 0
- [x] (e) `flock ~/workspace/.e2e.lock npx playwright test
      tests/e2e/high-contrast.desktop.spec.ts --workers=1` — exit 0,
      4/4 passed

## Cure round (2026-10-28, panel BLOCKs 1–4)

Council addendum `.council/manifests/2026-10-28-high-contrast-view-addendum.md`
(decision D9) committed alone first (`b5f051d`), before the cure
implementation. D9's principle: the scope of a palette change is the
surface the player must read, not the definition site — flipping land
dark→cream invalidates every dark-land-tuned token until re-measured.

- [x] **Cure 1 — mark tokens (`dc0673e`):** additive `palette.ts` lift
      (`MapMarkTokens` + `STANDARD_MARKS` / `HIGH_CONTRAST_MARKS`;
      existing exports unchanged apart from the stale "future toggle"
      comment). HC marks: pin `#b04a9e`, answer ≡ highlight `#a86c00`,
      cross `#757575` (each ≥3:1 vs HC land, water, AND lake), lit
      `#f0dca0` pale wash (marks ≥3:1 vs lit; lit 1.23 vs land), border
      `#beaf8d` (1.9500 vs land, inside the binding [1.90, 2.00]),
      park `#cfdcb4` (1.30). HC CSS block gains the seven mark vars.
      River keeps both theme values (re-measured, both ≥3:1 vs HC
      anchors); roads get NO HC override (see follow-up below).
      Pin centre-dot cure: dot rides `--map-pin-dot` through
      `colors.ts` (`pinDot`) into `drawGuessPin` — standard keeps
      `rgba(0,0,0,0.38)`, HC goes solid `#f6f3ea` (4.38:1 vs pin body).
      Tests RED first (missing-export signature), then GREEN.
- [x] **Cure 2 — visible pressed state (`b465eed`, test fix `bd82e56`):**
      `HighContrastToggle` renders a dedicated `atlas-contrast-toggle`
      class in both hosts; `[aria-pressed="true"]` gets the `.atlas-seg`
      brass fill (brass background, brass-ink foreground) and the
      Contrast icon fills solid. E2E asserts the computed
      background/foreground actually differ between states (RED first:
      both were `rgba(0, 0, 0, 0)`). One test-only fix en route:
      Chromium serializes the standard dot as `#00000061`, so the E2E
      compares the captured computed value, not the authored spelling.
- [x] **Cure 3 — records:** this file and the PR body carry the
      corrected manifest-first claim (above) and the Workers Builds
      disclosure (PR body).
- **Satellite GOLD divergence (disclosed, D9):** under HC the vector
  highlight darkens to `#a86c00`; the satellite region highlight
  (`region-highlight.ts` GOLD `#f2c14e`) is untouched per D5. The
  "matches region-highlight gold" coupling holds only outside HC;
  comments in `styles.css` / `colors.ts` are reworded accordingly.

### Cure gates (Node v24.22.1 local; CI 22.x canonical)

Run on cured code tip `b465eed`; the only later code change is
`bd82e56` (E2E-test-only), on which `build:pages` and the E2E gate
were re-run, and `tsc` / `lint-cards` re-verified:

- [x] (1) `npx tsc --noEmit` — exit 0 (both tips)
- [x] (2) `npm test` — exit 0 (scripts 861: 850 pass / 11 skip / 0 fail;
      src 1735: 1735 pass / 0 fail — 15 new cure tests over the build's
      1720) + `npm run test:worker` — exit 0 (85: 85 pass / 0 fail)
- [x] (3) `node scripts/lint-cards.mjs` — exit 0, GATE PASSED
- [x] (4) `npm run build:pages` — exit 0 (rebuilt from `bd82e56`)
- [x] (5) `flock ~/workspace/.e2e.lock npx playwright test
      tests/e2e/high-contrast.desktop.spec.ts --workers=1` — exit 0,
      **5/5 passed** on `bd82e56` (the 4 original cases + the new
      visible-pressed-state case)

## Follow-up (named, not in this cure)

- **Roads residual:** the dark theme's `--map-road-case` `#241f1a`
  measures 14.72:1 vs HC land. Councilor C's roads-system change was
  NOT adopted in this cure (Chair disposition in the D9 addendum;
  his CHALLENGE is recorded there). This needs a separate design
  pass over the road/highway/road-case system under high contrast.

## Pending

- [x] PR opened — PR #275 (manifest summary, gate results, Node 24
      local / CI 22.x canonical disclosure, "Do not merge without
      owner word")
- [ ] Panel re-vote on the cured final tip, then owner merge word
      (neither is this builder's to give)

## Docs note

`docs/feature-flags.md` documents feature flags only; high-contrast is
a settings toggle, not a flag, so no flag doc entry was added. The
brief's `friendChallenges` documentation example does not exist in
this repo (zero grep hits). No equivalent settings doc surface exists
to mirror; the feature is documented in the manifest, the D9
addendum, this file, and code comments. No README change: the README
does not enumerate settings toggles, and no behaviour it describes
changed shape.
