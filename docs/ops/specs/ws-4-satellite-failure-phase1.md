# WS-4 Phase 1: satellite failure path (one retry, then session-only fallback)

Status: implemented (Phase 1). Owner answers to section 11 are applied (see the table below); section 11 is kept as the record. Branch: `claude/hopeful-darwin-dp7ket` (single working branch, PR #148).
Charter change: recorded in `docs/scout-offer-policy.md` (commit `56c642c`).

## 1. Decisions (owner, 2026-10-14)

| # | Decision |
| --- | --- |
| D-a | One failed retry switches the map automatically. The switch lasts for this visit only and is never stored. |
| D-b | Phase 1 fallback is the existing Scout outline map (no Three.js, no new imagery). Phase 2 (bundled low-res Earth image in MapLibre, licence check first, credit added) and Phase 3 (self-hosted Sentinel-2) are out of scope here. |
| D-c | No expiry. The saved map-mode rules are unchanged. The fallback is not written to `meridian:map-mode`. |
| D-d | GeoDetective has no separate fallback game. If its loop works with the map hidden, that is its fallback. (Verified in section 5: it does.) |
| D-e | Copy: no "ArcGIS" anywhere a child can see it. See section 4. |
| D-f | Single branch. No new branch. |

## 2. Scope

In scope (Phase 1):
- Endless run satellite map (`src/map/satellite-map.tsx`): one "Try again", then a session-only switch to Scout outline.
- GeoDetective (`src/game/loop/LoopMap.tsx`): when tiles fail, the map is hidden and the clue -> guess -> feedback loop continues with text feedback.
- Copy changes for the failure card and the switch note.
- Tests (unit and E2E) and the docs listed in section 9.

Out of scope: Three.js, bundled imagery, Sentinel-2, any change to the frozen Scout files (`map-options.ts`, `scout-style.ts`, `scout-fallback.tsx`), `qualifyMapMode()` order, the prior-crash accept path, the manual toggle, the `webglcontextlost` auto-switch, or the saved-mode decay rules.

## 3. Endless run behaviour

State flow for one map mount in full mode:

1. Tiles fail on the first verdict (the existing `failed` state in `src/map/tile-status.ts`). Show the failure card with "Try again" (attempt 1 of 1 retry). Count so far: 0 retries.
2. The child taps "Try again". Count becomes 1. The map remounts with the same viewport (existing `retryViewRef` path).
3. If the verdict is `failed` again with count = 1, switch to Scout outline for this visit. Do not show "Try again" a second time.
4. If the retry succeeds, nothing changes. The count stays at 1 for the visit, so a later failure goes straight to the switch.

Rules:
- The counter lives in `game-app.tsx`, not in the map, so it survives place changes. It is in memory only. A reload resets it.
- The switch uses the same in-memory path as `handleWebglContextLost` (`game-app.tsx` around lines 2903-2934) with two differences:
  - it calls no `writeStoredMapMode`, so nothing is stored;
  - its source is a new `MapModeSource` value, `"tile-fallback"`, used for telemetry only.
- Because nothing is stored, a reload returns to the full map, and the one-retry rule applies again.
- The manual toggle still wins. A child who sets Scout or Full in settings gets that choice on the next place mount.
- The switch note is queued to the next game-natural break, the same way the `webglcontextlost` note is (`scoutSwitchNote`), so it never appears mid-aim.
- Only real satellite-map verdicts count. The early boundary-fetch false failure documented at `game-app.tsx` around lines 1358-1363 must not count.

## 4. Copy

| Where | Current | Phase 1 |
| --- | --- | --- |
| Failure card body | "Couldn't load satellite imagery." / "Check your connection and try again." | "The map pictures won't load right now. Check your internet, then tap Try again." |
| Failure card button | "Retry" | "Try again" |
| Switch note (after the fallback) | "Switched to Scout Map to keep the game running — your round is right where you left it." | **Open, see section 11.** Owner asked for "We switched to the explorer globe so you can keep playing." That wording describes Phase 2. Phase 1 is the outline map, so the default here is: "We switched to the outline map so you can keep playing." |
| GeoDetective map hidden | (none; the map is blank) | No new text. The clue, guess box and feedback list stay visible. |

Kid-facing rules: no "ArcGIS", no "lite", no technical error text, plain words.

## 5. GeoDetective behaviour

Verified (Explore agent, read-only, 2026-10-14):
- The loop works with the map hidden. `submitGuess` (`src/game/loop/engine.ts` 93-116) is pure. Typed guesses resolve through the place index (`evaluate.ts` 91-117). Feedback is pure math (`evaluate.ts` 197-215) with no network call. The guess list renders distance, Warmer/Colder and direction as text (`LoopScreen.tsx` around 1020-1040).
- The map only paints rings and arrows. `LoopGame` gates only on `load.phase` (`LoopScreen.tsx` around 641), not on any map state.
- Tile errors have no handling today. The only map listeners are click and load (`LoopMap.tsx` 372, 477).
- The real offline blocker is not the map. Every guess needs `loop/names.json` (about 11.5 MB, runtime cache-first, not precached: `public/sw.js` 62, 157). Clues and the manifest are also fetched at runtime. These already fail loudly: "Couldn't load the place list" with retry (`guess-input.tsx`), and a `role="alert"` card with "Try again" (`LoopScreen.tsx` around 640-660).
- Risk: `LoopMap` builds MapLibre inside an effect (around `LoopMap.tsx` 241). `LoopScreen` has no error boundary. `MapErrorBoundary` wraps only `SatelliteMap` (`game-app.tsx` around 3487). A constructor throw (for example, no WebGL) would likely crash the loop.
- Unverified at runtime: MapLibre `flyTo` on a hidden or zero-size container, and the comment at `LoopMap.tsx` 474-476 that the map stays interactive offline.

Phase 1 changes:
- G1. `LoopMap` listens for tile failures. After the first failed verdict, it hides the map container and shows no map chrome. The loop continues. Clue, guess box and feedback are unchanged. Hiding only applies to the map; the guess box does not depend on it.
- G2. Wrap `LoopMap` in an error boundary. If the map throws on mount, the same hidden state applies. The loop must not crash.
- G3. When the place index is not cached and offline, keep the existing designed error (`guess-input.tsx`, `LoopScreen.tsx`). This is the "needs the internet" behaviour the owner asked for when the map-hidden loop cannot run. Do not add a second error.
- G4. No change to scoring, the win/lose rules, or the place index.

## 6. Touchpoints (line numbers are from the 2026-10-14 read; re-check before editing)

Endless run:
- `src/map/tile-status.ts` 31-84: states and events. Phase 1 may need no change if the counter is kept in `game-app.tsx`.
- `src/map/satellite-map.tsx` around 1596-1625 (`handleRetryTiles`, no cap today), 1782-1815 (failure card), 1292-1310 (map error listener and watchdog), 862-883 (`webglcontextlost` listener, the precedent).
- `src/components/game-app.tsx` around 858-871 (`applyMapMode`), 2903-2934 (`handleWebglContextLost`), 3492-3494 (wiring).
- `src/components/scout-copy.ts` 19-20 (`switchNote`).
- `src/map/capability.ts` 36 (`MapModeSource`), 124-129 (source allowlist). Add `"tile-fallback"` to the type only; do not add it to the allowlist, so it is never read back from storage.

GeoDetective:
- `src/game/loop/LoopMap.tsx` 241 (MapLibre construction), 372 and 477 (listeners), 651-653 (overlay early return).
- `src/components/game-app.tsx` around 3487 (existing `MapErrorBoundary` usage to copy).
- `src/game/loop/LoopScreen.tsx` around 910-921 (map and guess sibling layout).

## 7. Tests

Unit (node:test, DOM-free):
- `src/map/tile-fallback.ts` (new, pure): `nextTileAction({ verdict, retriesUsed })` returns `"show-try-again"`, `"switch-to-outline"`, or `"none"`. Cases: first failure shows Try again; failure after one retry switches; success never switches; a second failure after a successful retry still switches on the next failure only.
- Source-allowlist test: `"tile-fallback"` is not accepted by `readStoredMapMode` (a stored record with that source reads back as default).

E2E (Playwright, desktop and mobile):
- E-1: all satellite tile requests fail. Expect the failure card with "Try again" and no "Retry" text. Tap it. Expect the card again (attempt 2 is not offered), then the outline map with the switch note at the next reveal.
- E-2: after the switch, `localStorage["meridian:map-mode"]` is absent or unchanged from before the test.
- E-3: reload. Expect the full map and the failure card again (tiles still blocked), with "Try again" available once.
- E-4: tiles fail once, then succeed on retry. Expect no switch.
- E-5 (GeoDetective): block the imagery and label hosts. Expect the map hidden, the guess box and feedback working, and a correct text distance/direction after a guess.
- E-6 (GeoDetective): uncached place index while offline. Expect the existing "Couldn't load the place list" error, not a crash.
- E-7: force a `LoopMap` mount error. Expect the loop to keep running with the map hidden.

Red first: E-1 and E-5 must fail before the code change. Show the failing output in the PR.

Visual: screenshots of the failure card and the outline-map switch at 390 px and 1280 px, reviewed by eye (no clipping, no overlap). Reuse the mockup copy.

## 8. Gates

`npx tsc --noEmit`; `npm test`; `node scripts/lint-cards.mjs`; `npm run build:pages`; the new specs and the existing Scout, failed-tile, and offline-content specs. Full Playwright is reported with the known 93 VM failures called out (see `BRANCH_STATUS.md`).

## 9. Docs to update when the work lands

- `docs/scout-offer-policy.md`: already carries the charter change; update the table if the source name ships.
- `docs/feature-flags.md` if any flag is added (none planned).
- `BRANCH_STATUS.md`: move WS-4 Phase 1 to Done with gate results.
- `docs/ops/run-log.md`: one row per step.

## 10. Risks

- A mid-round switch. The note is deferred, but the map itself changes under the child. Mirror the existing `webglcontextlost` behaviour and say so in the PR.
- A false failure would trigger the switch. The boundary-fetch case is the known one; the counter must only see satellite-map verdicts.
- Policy-doc conflict with PR #151 (add/add on `docs/scout-offer-policy.md`). Resolve by keeping this branch's version.
- GeoDetective with the map hidden is a new visible state. Needs a real-device check on a phone before the claim "it works offline" is made.

## 11. Open questions for the owner

1. Switch-note wording for Phase 1: "We switched to the outline map so you can keep playing." (default here) or wait until Phase 2 and use "explorer globe"?
2. Should the failure card keep "Check your internet" wording for a child who has no internet? (Default: yes, as written in section 4.)
3. GeoDetective map-hidden state: is a small text line such as "Map pictures are off for now" wanted, or silence? (Default: silence, per D-d.)

## 12. Final decisions and implementation (2026-10-14)

| Question | Final |
| --- | --- |
| Switch note | "We switched to Scout Map so you can keep playing." (product name, per owner) |
| Failure card | "The map pictures won't load right now. Check your internet, then tap Try again." |
| GeoDetective map off | "Map pictures are off for now. Your clues and guesses still work!" in a role="status" line where the map was |

UX review (read-only, Opus): all four strings approved. One optional note: "Check your internet" may be beyond a young child; "Ask a grown-up to check the internet" is an option if the owner wants it.

Implemented:
- `src/map/tile-fallback.ts`: pure decision (`nextTileFallbackAction`, `TILE_RETRY_LIMIT = 1`).
- `src/map/tile-fallback-copy.ts`: the four strings; copy test rejects provider names and "lite".
- `src/map/satellite-map.tsx`: the card copy; one "Try again" tap; a fallback callback once per failure episode.
- `src/components/game-app.tsx`: the visit-only retry counter; `handleTileFallback` sets Scout Map in memory and calls no `writeStoredMapMode`; the switch note; the setter is threaded to `PlayLoaded` the same way `applyMapMode` is.
- `src/game/loop/LoopMap.tsx`: reports tile failure on an idle frame after a tile error, or after the 15 s budget the satellite watchdog uses (MapLibre did not idle on blocked tiles).
- `src/game/loop/LoopScreen.tsx` and `src/game/loop/loop-map-boundary.tsx`: the map is replaced by the line when tiles fail or the map cannot start.

Tests (failing first, then green):
- Unit: `tile-fallback.test.ts`, `tile-fallback-copy.test.ts`. Red on missing modules; green with 9 passing.
- E2E: `ws4-tile-fallback.desktop.spec.ts` (4) and `ws4-geodetective-map-hidden.desktop.spec.ts` (3). Red: 5 of 6 failed before the change. The offline place-list test passed before the change, as a regression guard. Green after: all 7 pass across both files (6 failing-first + 1 guard; the guard was counted in the red run).
- Copy updates in existing specs (`tests/e2e/helpers.ts`, `tests/e2e/tap-verify.spec.ts`) to the new card text and button.

Regression check: unit suite 1,295 pass. Related E2E: 32 of 34 pass. `scout-switch-note` passed on an isolated re-run twice; it failed only inside the batch, which points to VM load. `tap-verify` was already failing on the main-equivalent build (`e2e-main-rerun.txt`).

Known limit: the tile-stub flake on this VM can now hand a child to Scout Map in the middle of a test. That is the intended behaviour, not a bug, but full-mode touch tests should not depend on the stub.
