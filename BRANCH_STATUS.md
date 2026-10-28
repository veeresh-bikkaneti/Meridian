# BRANCH_STATUS — feat/high-contrast-view

**Branch:** `feat/high-contrast-view`
**Base:** `main` at `daa03ad028252060d57a5c83ee35aef8e988a1fe` (merge-base = base; no rebase needed)
**State: BUILT — gates recorded below as they land. Not merged — merge is the owner's word, after the panel approves the final tip.**

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

## Pending

- [ ] Gates (a)–(e) on the final tip — results appended here and in
      `P0-2-REPORT.md` (workspace run record, not committed)
- [ ] PR opened with manifest summary, gate results, Node 24 local /
      CI 22.x canonical disclosure, "Do not merge without owner word"

## Docs note

`docs/feature-flags.md` documents feature flags only; high-contrast is
a settings toggle, not a flag, so no flag doc entry was added. The
brief's `friendChallenges` documentation example does not exist in
this repo (zero grep hits). No equivalent settings doc surface exists
to mirror; the feature is documented in the manifest, this file, and
code comments. No README change: the README does not enumerate
settings toggles, and no behaviour it describes changed shape.
