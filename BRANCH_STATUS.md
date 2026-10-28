# BRANCH_STATUS — feat/high-contrast-view

**Branch:** `feat/high-contrast-view`
**Base:** `main` at `daa03ad028252060d57a5c83ee35aef8e988a1fe` (merge-base = base; no rebase needed)
**State: BUILT + ALL 5 GATES GREEN on the code-final tip `ce95ac3` (2026-10-27). This status commit is the only later change. Not merged — merge is the owner's word, after the panel approves the final tip.**

## Scope

Finish the high-contrast view: the palette tokens landed in `1cb6a41`
(`src/game/palette.ts` + tests — fail-closed `selectPalette`,
`STANDARD` / `HIGH_CONTRAST`, WCAG `contrastRatio`). This branch adds
persistence, a settings toggle, live swap, and the GeoDetective
label-safety guarantee, under the signed Tier-2 Consensus Manifest
`.council/manifests/2026-10-27-high-contrast-view.md` (committed first,
`5588233`, before any implementation code).

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
- [x] Palette verification: existing 8 tests pass; STANDARD arc ≥3:1 on
      water (13.9) and land (8.3) measured; missing STANDARD arc test added
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
- [x] E2E spec: `tests/e2e/high-contrast.desktop.spec.ts` (4 cases)

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

## Pending

- [ ] PR opened with manifest summary, gate results, Node 24 local /
      CI 22.x canonical disclosure, "Do not merge without owner word"
      (PR number/URL recorded in `P0-2-REPORT.md` and the PR body)
- [ ] Owner merge word + panel approval of the final tip (not this
      builder's to give)

## Docs note

`docs/feature-flags.md` documents feature flags only; high-contrast is
a settings toggle, not a flag, so no flag doc entry was added. The
brief's `friendChallenges` documentation example does not exist in
this repo (zero grep hits). No equivalent settings doc surface exists
to mirror; the feature is documented in the manifest, this file, and
code comments. No README change: the README does not enumerate
settings toggles, and no behaviour it describes changed shape.
