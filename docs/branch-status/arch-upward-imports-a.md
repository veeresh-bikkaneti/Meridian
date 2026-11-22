# Upward imports A — status

Branch `arch/upward-imports-a`, based on main `9b32d31a72aff182e9a1c8053f1832c6150040b0` (built on `38468953`, then re-based onto the new main by re-applying the same file changes; PR #572 touched none of these files and did not touch the baseline).

## Result

- Cleared **25 of 26** planned (a) entries. Baseline `noUpwardImport`: **154 → 129**.
- One planned entry became STAYS during the build (entry 38, below).
- The 15 (b) entries stay baselined. No layer-map edit was made.

## What moved

- Pure types and data moved down to domain (`src/lib/**`, `src/game/**` .ts): `CardFilmMedia`, `MapMode`, the home-globe contract/controls/landmark builders, `assetBase`, `decideFirstGesture`, the detective pose arrays, `TrailEvidenceRing`/`TrailEvidenceMark`, `IMAGERY_TILES`, `TILE_FALLBACK_COPY`, the flag registry module, and the generated case JSON plus the admin-1 dataset into `src/game/data/**`.
- Presentational components moved down to shared-ui (`src/components/ui/**`): `BoundedText`, `FlagImg`, `GrownUpGate` (+ its cooldown helper), `ReadAloudButton`, `DetectivePair`, `DropPinButton`, `ZoomControls`, `pack-shelf-data`, `summary-celebration-line`.
- Old paths keep a re-export shim where an importer outside this lane uses them, so no do-not-touch file was edited: `bounded-text`, `flag-img`, `pack-shelf-data`, `summary-celebration-line`, `age-profile/GrownUpGate`, `age-profile/ReadAloudButton`, `game/loop/detective/DetectivePair`, `map/imagery`, `map/tile-fallback-copy`. Extracted pieces are re-exported by their old owners the same way (`card-film`, `capability`, `storyteller-lines`, `storyteller-audio-guards`, `LoopMap`, `DetectivePair`).
- Generators and tests that read a moved file by path were re-pointed: the two coldtrail generators and their read-back test, `build-admin1.mjs`, the flag build/check scripts, `pair3d.test.ts`, `pack-shelf-data.test.ts`, `storage-keys.test.ts`, the home-globe e2e spec, and the synthetic example in `scripts/layer-baseline.test.mjs` (it used a cleared entry as its fixture; it now uses atlas-map's still-baselined entry).

## STAYS — entry 38 (observability → map crash marker)

The plan moved `hasDurableMapCrashMarker` / `writeDurableMapCrashMarker` from `src/map/capability.ts` to `src/platform/storage/map-crash-marker.ts`. That home cannot work: the only outside consumer, `src/lib/observability.ts`, is domain (layer 2), and domain must not import platform (layer 3) — `lint:arch` proved it with the moved import in place. The entry stays baselined as `src/lib/observability.ts|../map/capability.ts`. It needs a layer ruling, like the (b) list: either the marker helpers get a domain home that takes the storage port as a parameter, or domain → platform for this one port is allowed.

## (b) list — stays baselined, needs a ruling (15)

- B1: atlas-map's 9 map-engine entries (`src/map/**` has no .ts/.tsx layer split).
- B2: LockedTileFilm's media module (`src/assets/**` has no layer).
- B3: the two CSS entries (age-profile.css, detective.css — stylesheets have no layer).
- B4: home-globe's two .webp entries (binary assets have no layer).
- B5: share-meta's `site.json` (colocated config JSON has no data home in the map).

Full reasoning per entry: the classification record for this branch.

## Tests added

One narrow regression test per moved module, proving old importers still get the same exports: moved globe tests (contract, controls) plus a new landmark-models test, `moved-components.test.ts` (drop-pin, zoom, flag-img and DetectivePair shim identity), map-mode type identity, imagery and tile-fallback shim identity, asset-base and first-gesture identity plus the gesture decision table, card-film-media type identity, flag registry contents, coldtrail case counts from the moved JSON, trail-evidence type identity, detective pose contents, pack-shelf-data and celebration-line shim identity, and the re-pointed cooldown test in `ui/`.

## Gates (final tree)

- `npx tsc --noEmit` — PASS
- `npm test` — PASS (exit 0; src suite 3282 pass / 0 fail; scripts suite 0 fail, includes `scripts/layer-baseline.test.mjs` 5/5)
- `npm run test:worker` — PASS (239 pass / 0 fail)
- `node scripts/lint-cards.mjs` (the lint-cards gate, run inside prebuild) — PASS
- `npm run build:pages` — vite build and prerender complete; the postbuild `fingerprint-sw` step fails on this machine on pristine main too (known local issue), CI is decisive
- `npm run lint:subjects` — PASS
- `npm run lint:arch` — PASS with the 25 lines deleted
- `npm run lint:nav` — PASS
- `npm run check:entry-size` — PASS (323,280 B of 323,865 B; limit unchanged)
- Baseline recount — 129 (`grep -c` on the baseline list after the deletions, verified against new main's copy: identical except the 25 removed lines)
- Targeted Playwright (desktop + phone, workers=1): home-globe, coldtrail, coldtrail mobile, detective-summary — 23 passed, 2 failed. Both failures are home-globe cold-load tests on this machine: one passed on re-run (browser closed mid-test), and "globe mounts and paints at 320x568" fails identically on a pristine build of the new main, so it is a pre-existing local failure, not from this change.
