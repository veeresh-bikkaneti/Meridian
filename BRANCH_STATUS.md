# BRANCH_STATUS.md — feat/geodetective-map

**Branch:** `feat/geodetective-map` (off `origin/main` @ `a66a4161`, the GeoDetective merge)
**Task:** GeoDetective "Detective's Atlas" — Option A from `~/workspace/your_files/geodetective-map-brainstorm.md` (Veeresh approved 2026-10-05; decided: rings YES, typeahead stays as camera-jump search)
**Status:** build complete, all gates green — architect review in progress, then PR.

## What's done

- Map infra (`src/game/loop/`):
  - `map-labels.ts` — Esri `Reference/World_Boundaries_and_Places` labels layer + attribution (endpoint verified HTTP 200, PNG 256×256)
  - `place-resolve.ts` — grid spatial index (2° cells, antimeridian-safe) + tap→place resolution; 44px→km tap tolerance capped at 150 km (ocean taps never select)
  - `rings.ts` — exact-km distance ring polygon + direction arrow (shaft 30% of miss distance, ≥1 km floor, head barbs); **antimeridian fix:** longitudes unwrapped so planet-scale rings (e.g. Tokyo→Ankara 8,764 km) don't tear into a 350°-jump polygon the tile worker drops — 5 unit tests
  - `LoopMap.tsx` — MapLibre component: satellite + labels, tap→`onSelectPlace`/`onEmptyTap`, rings/arrows/✕/searched-shading layers, gold target star on finished day, `flyToEntry` handle, `__loopMap` E2E seam, reduced-motion camera jumps, `ringAnnouncement()` for screen readers
- Guess flow: `guess-input.tsx` gained `mode="jump"` (camera fly + auto-select, never submits); `LoopGuess` carries optional `lon`/`lat` (`types.ts`, `store.ts` validator, `engine.ts`) — pre-map days validate fine, draw no ring
- `LoopScreen.tsx`: map section (~52dvh) + jump search below; bottom sheet (tapped place name + "Guess this place" 48px + "Not this one" cancel, Escape/backdrop safe); ocean taps → gentle hint; same-place-twice blocked; mid-game reload restores guesses + rings (existing persistence); clue cards + guess list + reveal + share unchanged; ring announcements via aria-live region
- E2E specs rewritten for the map flow (`tests/e2e/geodetective.spec.ts`, `geodetective.reduced.spec.ts`): jump-search guess, map tap select + cancel/confirm, ocean-tap hint, ring source feature counts (polls until tiled), reload restores rings, stored lon/lat assertion
- Committed + pushed early/often (named files only)

## Gates (all green, 2026-10-05)

- `npx tsc --noEmit` — clean
- `npm test` — 696/696 (11 new: 6 place-resolve, 5 rings)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (buildId 31baf49)
- Playwright E2E (via `flock ~/workspace/.e2e.lock --workers=1`): geodetective project **9/9**, geodetective reduced-motion **1/1**, main-game smoke (endless-game keyboard) **1/1**

## What's pending

1. Architect review: game architect (gameplay/systems) + software architect (SOLID/CLEAN, no State/Country/Globe regressions) — zero blockers required; fix findings, re-run gates
2. Push, open PR (target main) with design summary + gate evidence; report PR URL to parent. **Do NOT merge — Veeresh merges.**

## Non-negotiables (untouched)

5 guesses, UTC daily, clue ladder, exact-match win logic, share format `meridian geodetective <date>`, reveal cards, kid-friendly blurbs, honest `near …` naming.
