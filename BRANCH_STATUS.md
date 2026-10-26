# BRANCH_STATUS — fix/209-210-211-chunk-territory

**Branch:** `fix/209-210-211-chunk-territory`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: BUILT + GATES GREEN (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 1 of 3. Not merged —
merge is the owner's word.

## Scope (all three issues come from the PR #203 review panel)

- **#209 — territory/chunk load has no timeout.** A *hung* import
  never settles, so every awaiter sat behind its loading fallback
  forever. Now bounded at 10 s everywhere it matters:
  `territory.ts` races its atlas load (timeout evicts like a failure;
  preload still never rejects, still fail-closed; the boot restore's
  deferred commit therefore always settles), `src/lib/chunk-timeout.ts`
  adds `withChunkTimeout`/`ChunkLoadTimeoutError`, and game-app races
  the Loop/Trail/SatelliteMap lazy factories and openRun's
  places+territory await. A timeout lands in the EXISTING recoverable
  paths (boundary card / start-error catch), stale-probe included.
- **#210 — stale-deploy chunk failure showed the generic map card.**
  First checked against open PR #248 (`fix/a11y-reload-announcement`):
  it does **NOT** cover #210 — #248 is announcement dwell + a
  post-reload notice layered on #245's auto-reload; it never probes
  staleness inside the boundary and keeps the map-only copy. Here,
  `MapErrorBoundary` probes `isNewBuildDeployed()` once per error:
  stale → the approved "A new version of Meridian is available." +
  Refresh card; otherwise destination-neutral copy naming the
  wrapped surface (`surface` prop — GeoDetective / Cold Trail sites
  pass theirs; the map site keeps "the map", so #248's
  `MAP_ERROR_CARD_COPY` dwell probe still matches the map card when
  that branch rebases).
- **#211 — perf follow-ups.** (1) The focus-triggered territory
  prefetch is gated on Save-Data (`prefetchTerritoryDataOnFocus`;
  pointer intent ungated; the home-globe precedent). (2) Trail's
  fail-closed heading now carries `caseHeadingRef` + `tabIndex={-1}`
  — arrival-focus parity with Loop in one line. (3) A source-pin in
  `territory-lazy-boundary.test.ts`: scoring never starts the load,
  and in game-app every awaited preload sits before the commit that
  scores from it.

## Files

- `src/game/territory.ts`, `src/game/territory-timeout.test.ts` (#209)
- `src/lib/chunk-timeout.ts`, `src/lib/chunk-timeout.test.ts` (#209)
- `src/components/game-app.tsx` (#209 wraps + #210 surface props +
  #211 Save-Data focus gate)
- `src/components/map-error-boundary.tsx`,
  `src/components/map-error-boundary.test.ts` (#210)
- `src/game/coldtrail/TrailScreen.tsx`,
  `src/game/coldtrail/trail-heading-focus.test.ts` (#211 item 2)
- `src/game/territory-lazy-boundary.test.ts` (#211 items 1+3 pins;
  two F2b pins updated for the #209 preload signature)
- `src/components/game-app-lazy-boundary.test.ts` (#209 wiring pins;
  branch pins updated for the #210 surface props; focus hook updated)
- `tests/e2e/chunk-boundary-copy.desktop.spec.ts` (#210 E2E: real
  aborted LoopScreen chunk → neutral GeoDetective card; + stubbed
  build-meta mismatch → new-version prompt)
- `docs/handbook/02-game-design-decisions.md` (§11 extended)

## Panel-spec amendment (2026-10-26, after the squad specs landed)

Four refinements from the UX/Frontend squad's full spec, folded in
before panel review:

- **#209 zombie guard:** a territory import that lands AFTER its
  timeout is now discarded via a load-generation check — it no
  longer populates the cache or double-counts the conversion seam;
  the retry owns the cache. Executed pin in territory-timeout.test.ts.
- **#209 HomeGlobe:** its lazy factory is timeout-wrapped too — a
  hang lands on the existing GlobeChunkFallback.
- **#210 one-shot guard:** the boundary's Refresh offer honors the
  shared `meridian.staleRefresh` guard (probe skipped once armed;
  Refresh arms it) — parity with openRun / LoopScreen, pinned
  against game-app's identical key literal.
- **#211 item 3, executed:** `scoring-territory-pin.test.ts` pins
  the money invariant with real calls — regionBonus 0 before the
  preload, +15 after.

## Gates (2026-10-26, this head)

- [x] `npx tsc --noEmit` — clean, exit 0
- [x] `npm test` — scripts 832 pass / 0 fail / 9 skipped;
      src 1652/1652 pass (incl. the amendment pins)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- [x] Playwright `--workers=1`: chunk-boundary-copy **2/2** (new
      #210 legs) + chunk-recovery **15/15** (neighbors, incl. the
      6-E stand-down oracle) = 17/17; coldtrail **11/11** (Trail
      heading neighbor, pre-amendment head)

## Out of scope / sequencing notes

- PR #248 (Liz's crew) also touches `map-error-boundary.tsx`
  (retry-path notice flag). Whichever lands second rebases; the map
  card's heading copy is unchanged by this branch so #248's dwell
  probe constant keeps matching.
- PR #245's chunk-recovery auto-reload is untouched and composes:
  it may reload a stale tab on its own schedule; this branch's card
  is the visible, tappable recovery while it is on screen.
- No merge, no branch-protection changes.
