# TD-10.1 drop the baselined re-export shims (three of four) — status

Branch `chore/td-10.1-drop-baselined-shims`, based on main `9314c6def54b3a8e66810408048c04f5f7c9cd86` (#606).

## Result

Deleted the three baselined `export *` shims and retargeted every importer to the canonical module; `src/map/tile-fallback-copy.ts` is left alone (game-app.tsx still imports it; deferred to the Phase 4 lane that owns game-app).

- `src/components/pack-shelf-data.ts` → canonical `src/components/ui/pack-shelf-data.ts`. Importers retargeted: `TrailScreen.tsx`, `LoopScreen.tsx`, `pack-shelf.tsx`, `pack-shelf-data.test.ts`, `storage-keys.test.ts`.
- `src/components/flag-img.tsx` → canonical `src/components/ui/flag-img.tsx`. Importers: `TrailScreen.tsx`, `LoopScreen.tsx`.
- `src/game/loop/detective/DetectivePair.tsx` → canonical `src/components/ui/DetectivePair.tsx`. Importers: `SubjectDetectiveHost.tsx`, `LoopSummaryCelebration.tsx`, `DetectiveHost.tsx`, `detective-rig.test.ts`, `scripts/detective/render-rig-sheet.mjs`.
- Shim-only test cases now assert the deleted paths no longer resolve (`moved-components.test.ts`, `pack-shelf-data-shim.test.ts`); canonical-module cases kept. The `coldtrail/store.ts` comment now names the canonical path.
- `eslint/layer-baseline.json`: exactly the 5 cured rows removed; `noUpwardImport` 120 → 115, `noRawIo` 0, shell-ban 10. `LIMITS` untouched (Lane 2 owns the caps).
