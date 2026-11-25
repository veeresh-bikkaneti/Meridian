# Branch status: feat/td-06.8-map-mode

- Branch: `feat/td-06.8-map-mode`
- Base: `origin/main` at `f5448d850` (post-TD-06.7 #620)
- PR: (draft, to be opened by the parent)
- Goal: TD-06.8 — game-app-map step 8: extract the map-mode hook,
  move the map types / copy down to `src/lib`, retarget and delete
  the `tile-fallback-copy` shim. Behavior unchanged.

## Done

- Map-mode hook: new `src/map/use-map-mode.ts` (`useMapMode`) owns the
  cluster that lived inline in GameApp — `mapMode`, `bootQualified`,
  `mapModeAnnouncement`, `mapSwitchedNote`, `autoScoutNote`,
  `scoutUpgradeEligible`, `welcomeMapPick` — plus `applyMapMode`,
  `applySessionMapMode`, `applyScoutUpgrade`, `handleWelcomeMapMode`
  and `qualifyBootMapMode` (the boot qualification block, called from
  GameApp's boot effect at the point the inline block ran).
  `welcomeMapPick` moved with the cluster: its only writers/readers
  are the welcome card staging and the Start commit, both map-mode
  surfaces. `handleManualMapMode` and `handleHomeMapMode` stay in the
  shell (they force-home the run / land focus); they drive the hook
  state through its returned setters, and the hook surfaces
  `readStoredMapMode` / `writeStoredMapMode` so PlayLoaded's upgrade
  re-check and the manual toggles never import the capability module
  from the composer. `readStoredMapMode` is threaded to PlayLoaded as
  a prop for that re-check. `SatelliteMap` stays lazy (row 19 kept).
- Types down: new `src/lib/map-view-types.ts` holds `MapMark`,
  `MapVariation`, `ScoutRestoreView`; `satellite-map.tsx` imports and
  re-exports them (its existing importers are untouched).
- `map-options` down: `src/map/map-options.ts` → `src/lib/map-options.ts`
  (test moved with it); its `MapMode` type now comes from
  `src/lib/map-mode.ts`. Importers retargeted: game-app (via the
  hook), `satellite-map.tsx`, `starfield.ts`.
- Copy down: `game-app.tsx`, `TrailScreen.tsx` and `satellite-map.tsx`
  now import `TILE_FALLBACK_COPY` from `src/lib/tile-fallback-copy`;
  the shim `src/map/tile-fallback-copy.ts` is deleted (zero remaining
  importers). The copy assertions from the map-side test now live in
  `src/lib/tile-fallback-copy.test.ts`, which stays the copy's test.
- Baseline: 7 `noUpwardImport` rows cured and removed (game-app
  `capability` ×2, `map-options`, satellite-map types ×2,
  `tile-fallback-copy.ts`, TrailScreen `tile-fallback-copy`); one new
  row added for the composer's hook import
  (`game-app.tsx|@/map/use-map-mode`), the leftover-host row the §2
  preamble allows, cleared in the last PR. Row 19 (lazy
  `SatelliteMap`) remains. `noUpwardImport` 110 → 104;
  `LIMITS.noUpwardImport` lowered to 104. `noRawIo` stays 0.
- Size: `game-app.tsx` 7,695 → 7,481 lines; ceiling lowered to 7,481.
- Entry size: the extraction's wiring (hook return/destructure, the
  `readStoredMapMode` prop thread) grows the entry chunk by ~270 B
  gzip over base (324,884 B on `f5448d85`). The caps were first raised
  to the measured 325,157 B; the owner then ruled the 324,995 B cap
  was for #620 only, with no further bump (follow-up: issue #621), so
  `ENTRY_JS_GZIP_LIMIT` and the regression `LIMITS.entryBytes` are
  REVERTED to 324,995 B and this branch is BLOCKED on entry size:
  measured entry is 325,158 B local / 325,167 B CI, 163-172 B over.
  Shrink investigation (bundle-report + chunk diff): all growth is in
  the `routes` chunk (+922 raw / +272 gzip); no duplicated code or
  strings. The interface names compress too well to recover the gap —
  converting both the hook return object and the shell destructure to
  positional form in the built chunk (696 raw removed) saves only
  134 B gzip (~325,024 B, still over), and that shape contradicts the
  named-object pattern every other extracted hook uses. Folding the
  boot effect into the hook (dropping `qualifyBootMapMode` from the
  interface) is worth only ~30-40 B more and changes effect ordering.
  No honest, behaviour-identical cut reaches 324,995 B; owner call
  needed (issue #621).
- Pins retargeted (TD-06.7 pattern): `src/map/capability.test.ts`
  boot-wiring pin now reads the hook; `scout-upgrade-lifecycle`
  pins for `applyScoutUpgrade` and the boot arming now read the hook
  (manual/home/Play segments still pin game-app). The seam ratchet
  gained a file-level allowlist entry for the hook (its boot comment
  records the removed #154 bypass).
- Tests (narrow): capability, map-options, map-mode,
  tile-fallback-copy, scout-upgrade-lifecycle,
  map-switched-notice-lifecycle, game-app-lazy-boundary,
  use-overlay-queue, storage-keys — 81 pass. Script tests:
  layer-baseline, check-game-app-size, check-test-seams — pass.
- Gates: tsc PASS, lint:arch PASS, lint:nav PASS.

## Ruled out / deferred

- Moving `src/map/capability.ts` itself down to `src/lib` (the
  brief's first plan): its default storage path imports the platform
  storage port (`src/platform/storage/*`, layer 3), which the domain
  layer may not import — `lint:arch` fails on the moved file.
  Rerouting it through the domain storage slot would change storage
  semantics (port decode / fail-soft / notify) and is a separate,
  reviewable change; the hook importing it same-area cures the
  checklist rows without that risk. Owner call if it should follow.

## Next step

- BLOCKED on entry size (see Size above): caps reverted to
  324,995 B per the owner's ruling; entry is 325,158 B local.
  Owner call on how the ~170 B is funded (issue #621). TD-06.10
  starts only after this merges (one open game-app PR at a time).

## Graph

- Node: `branch:feat/td-06.8-map-mode`
- Edge: `branch:feat/td-06.8-map-mode` — depends-on → `doc:docs/architecture/game-app-map.md` (step 8)
- Edge: `branch:feat/td-06.8-map-mode` — supersedes → the inline map-mode cluster in `src/components/game-app.tsx` (now `src/map/use-map-mode.ts`)
