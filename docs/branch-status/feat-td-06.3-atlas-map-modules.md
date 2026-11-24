# Branch status — feat/td-06.3-atlas-map-modules

**Task:** TD-06.3, atlas-map only (the `game-app.tsx` half of 06.3 and all of 06.4 are deferred; #606/#607 still hold those files). `src/components/atlas-map.tsx` carried all 9 baselined `noUpwardImport` rows on this tip — every one a cross-feature-area import (`components` → `map`). `docs/architecture/game-app-map.md` names `src/map/` as the home for these moves ("The import moves into `src/map/`", "A play view under components/ must not import map"), so the module moved there.

**What changed:**

- `src/components/atlas-map.tsx` → `src/map/atlas-map.tsx` (whole-file move, `git mv` — history preserved; byte-identical module body, only the nine `../map/*` import specifiers rewritten to `./…`). The component had no remaining importers in `src/` on this tip, so the move changes no module graph. Behavior identical.
- `eslint/layer-baseline.json` — the 9 cured `src/components/atlas-map.tsx|../map/*` rows deleted (shrink only, 129 → 120). Nothing else touched: `src/map/atlas-data.ts` (#604 hold) was not edited — its import simply became same-area (`./atlas-data.ts`).
- `scripts/layer-baseline.test.mjs` — the per-violation suppression fixture that leaned on the deleted `../map/atlas-data.ts` row now leans on the still-baselined `src/components/home-globe.tsx|@/assets/home-v5/globe-fallback.webp` row (same semantics: baselined key suppressed, a second unlisted import in the same file fires), and a new test pins the move: the detector finds zero violation keys in `src/map/atlas-map.tsx`.

**Ruled out:**

- Any `src/components/game-app.tsx` work (21 upward rows) — #606 holds it; not started.
- `game-app.tsx` size ceiling unchanged (8,869; the script and the file are untouched).
- `src/routes/` (06.4), `src/build-board/**` (#599), `package.json`, workflows (#606/#601), `eslint/shell-ban-baseline.json` (#607).
- Splitting the moved file into further sub-modules: the module is a single React component; the row cure is the move itself, and inventing extra seams just for 06.3 scope would risk behavior drift for no row gain.

**Gates:** recorded in the pull request body.

**Open questions:** none.
