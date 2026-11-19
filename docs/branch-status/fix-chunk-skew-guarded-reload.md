# fix/chunk-skew-guarded-reload — status

Base: `8ba3a94768868bfc425e54ed86b3999c285c8b33` (current main at branch time).

## Done
- Crash (report 2026-11-17T20:43:58Z, build 87159d2a, mode scout, last
  step "story ready", 66,004 ms after boot): `TypeError: Failed to
  fetch dynamically imported module: …/assets/LoopScreen-BllbNWzl.js`;
  the chunk 404s on the live site.
- Root cause, mechanism (b) — mid-session deploy rotation, not a stale
  service-worker shell: the tab booted ~66 s before the crash on the
  then-current build 87159d2a (committed 19:54:00Z); the next merge,
  8ba3a947 (20:41:54Z), deployed inside that window and rotated the
  hashed assets, so the old tab's lazy LoopScreen import 404'd. The tab
  was ~1 minute old and current at boot; SW navigations are
  network-first, so no stale shell is needed to explain it.
- Why the existing machinery did not protect this path — reproduced on
  pristine main with the built artifact (LoopScreen requests 404'd,
  build-meta naming a newer build): `vite:preloadError` fired (count
  1) and the chunk-recovery handler (#245) opened its 1.5 s decision
  window, but MapErrorBoundary's staleness probe confirmed the new
  build first and swapped its card to the stale-offer copy; the
  handler defers to ANY on-screen stale offer, so it stood down
  (telemetry shows its `recovery_outcome` stand-down) and never
  reloaded. The card's Refresh is a manual tap — a player who never
  taps is never recovered. The two recoveries deadlocked, each
  deferring to the other. Independently, the boundary filed
  `map_error` at catch time, before any recovery outcome, so even the
  paths where the auto-reload does fire still produced a crash report
  for a healed skew.
- Fix, `src/lib/chunk-recovery.ts`: new exported
  `attemptGuardedChunkReload()` — the guarded one-time reload outside
  the install closure, under the same discipline as the auto-reload
  decision: fresh `meridian.chunkReloadAt` stamp → refuse; stale stamp
  → clear and proceed; stamp must persist and read back verified or
  no reload; the Slice 2 outcome marker and the post-reload notice
  ride the verified reload; an optional `beforeReload` hook runs
  after verification, immediately before the reload.
- Fix, `src/components/map-error-boundary.tsx` (the shared boundary
  for every lazy gameplay screen — the map, GeoDetective, Cold Trail,
  Subjects):
  - On a stale probe verdict for a chunk-load error, the boundary
    issues the guarded reload itself, re-arming the persisted screen
    inside the reload so the fresh shell restores the screen the
    player asked for. If the guard refuses, the existing stale card
    remains as the manual path.
  - Reporting: a chunk-load failure is no longer reported at catch
    time. It is reported only as the post-reload repeat (a fresh
    reload stamp is present when it fails again — the build is then
    genuinely broken), or when session storage is unreadable and no
    recovery can be verified. Non-chunk errors report exactly as
    before. The crash reporter is not silenced globally.
- Tests: 5 new unit tests for `attemptGuardedChunkReload`
  (`src/lib/chunk-recovery.test.ts`, 16-U: reloads once with stamp +
  notice + marker written together; fresh stamp refuses; stale stamp
  proceeds; unverifiable stamp stands down; beforeReload ordering and
  throw-safety) and 2 new source pins in
  `src/components/map-error-boundary.test.ts` (stale chunk failure
  self-reloads from the probe path; the catch reports only through
  the chunk-aware rule).

## Behaviour proof (built artifact, headless Chrome over CDP; the
## sandbox's bundled Playwright Chromium refuses to launch — the
## disclosed substitute pattern of the earlier wave proofs)
Harness: `~/workspace/meridian-work/chunkfix-work/probe.mjs`; facts in
`proof-{pristine,fixed}-{rotate,persistent,control}.json` beside it.
- Pristine, rotate: navigations 1 (no reload in 30 s), `map_error` ×1,
  `recovery_outcome` (stand-down) ×1, final screen = the stale-offer
  card. The captured crash, reproduced.
- Pristine, persistent 404: auto-reload fired once, but `map_error`
  was still filed for the first failure.
- Fixed, rotate: navigations 2 (exactly one guarded reload),
  telemetry empty (no crash report), GeoDetective loaded on the fresh
  shell, no card.
- Fixed, persistent 404 + re-tap after the reload: navigations stay
  2 (no loop), the repeat failure files exactly one `map_error` and
  lands on the neutral error card.
- Fixed and pristine control (no interference): unchanged — one
  navigation, no telemetry, GeoDetective loads.

## Gates (local, raw results; builder does not certify)
- Targeted: chunk-recovery 89/89, map-error-boundary 8/8 (97 total
  across both files when run together).
- `npx tsc --noEmit`: clean.
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run lint:nav`: clean. `npm run lint:subjects`: GATE PASSED.
- `npm run test:worker`: 235/235.
- `npm test`: src suite 2868 tests, 2864 pass, 4 fail; scripts suite
  1213 tests, 1203 pass, 1 fail (9 skipped/todo in the scripts run's
  remainder). All 5 failures reproduce on pristine main with this
  branch's edits reverted, so none is caused by this change: the 4 src
  failures are the WebGL2 source pins
  (`src/game/coldtrail/webgl2-fallback.test.ts`, written against
  PR #520's file versions; later main commits changed TrailScreen /
  satellite-map and the pins are stale on main itself), and the
  scripts failure is the known environmental `ssr-build-shape` case
  ("emitted ssr wrangler.json keeps the custom-entry shape").
  Adjacent suites re-run green on this tip: game-app lazy boundary,
  build-staleness, chunk-timeout, observability — 121/121 with the
  boundary pins.
- `npm run build:pages`: the vite build is green and the artifact
  runs (the proof above); the npm wrapper exits 1 at the postbuild
  fingerprint step ("placeholder __BUILD_ID__ not found") — the known
  sandbox quirk, reproduced identically on pristine main, because the
  in-build fingerprint plugin already stamped sw.js.
- Provenance: no git in the sandbox, so `check:provenance` is
  emulated — the changed files were scanned for the script's banned
  name list and the gpt pattern: no matches. Commit author identity
  is the owner's, per the standing convention for API-published
  branches.

## Graph
- No new graph nodes: the fix extends the existing chunk-recovery /
  error-boundary machinery (PR #245 / #210 surfaces) without adding
  modules, routes, or decisions.

## Phase 2+3 — arena hardening (second commit)

- An adversarial arena (5 fresh seats) attacked the Phase 1 fix and
  confirmed ~20 holes in the crash-stranding / reporting edges.
  Fixed, each with regression pins: F1 exit/restore (retry marker
  cleared by clearPersistedScreenOpen; goHome exit-intent guard,
  hash stripped to Home's, deferred report emitted on exit), F2
  dwell attribute on every boundary card, F3 shared
  shouldReportChunkFailure at all four emit sites + ChunkLoadTimeoutError
  classification + the meridian.chunkReloadSurface companion record,
  F4 Age hosts wrapped in the boundary, journal fail-closed boundary
  (src/components/journal-boundary.tsx), router-page Try again,
  globe-fallback stand-down, F5 episode 15-minute cap + countdown
  re-arm + future-stamp handling, F6 staleRefresh timestamps via
  staleRefreshRecentlyUsed, F7 watchdog (future-notice lower bound,
  boot-scoped ASKED, one timer re-arm, notice consumed at ready;
  inline budget 6,600 → 6,700, worst case 6,641 measured), F8 menu
  card Try again, F9 doc correction.
- Follow-ons named in the PR body (not fixed): cross-surface outcome
  misattribution + multi-emit dedupe (observability-pipeline call),
  handler/probe 1.5 s vs 8 s race + cross-surface stale-offer
  stand-down, single removable stamp key (accepted), watchdog
  removeItem-throws residual, restored-<Play> boundary gap (Seat H),
  innerText-less engines' textContent fallback.
- Two existing pins updated with reasons in-file: 4-U-max (latch
  past MAX_AGE via restarts — superseded by the F5a cap) and the
  exact write-sets in 11-U / 14-U1 (the F3 companion record now
  rides each reload); 3A-U2's boundary leg re-seeded so its decision
  lands exactly on MAX.
- Gates on the Phase 2 tip: targeted 118/118 + 132/132 + watchdog
  65/65; tsc clean; lint-cards / lint:subjects GATE PASSED;
  lint:nav clean; test:worker 235/235; npm test src 2895/2899,
  scripts 1207/1217 — the same 5 pre-existing failures as Phase 1
  (4 WebGL2 pins + ssr-build-shape), unchanged in character.
  build:pages: vite green, wrapper exit 1 at the known fingerprint
  postbuild quirk (identical on pristine main). Provenance emulated
  with the checker's own findVendorName over every changed file:
  no matches.
- Behaviour proof (CDP, built artifact; harnesses + JSON +
  screenshots in ~/workspace/meridian-work/chunkfix-work/arena-proof/):
  ageask rotate healed with zero telemetry; journal persistent —
  Home intact, section failed closed, no js_error; homeglobe rotate —
  no reload, fallback disc shown; GeoDetective failure → Home tap —
  boots Home (#home, marker/flag cleared, exactly one deferred
  map_error); LoopScreen rotate unchanged from Phase 1 (one reload,
  zero reports) with pristine phase-1 JSONs kept beside for contrast.

## Next step
- Owner review and merge word. CI carries the full Playwright suite
  (AGENTS.md §4: the sandbox cannot launch the bundled Chromium).

## Open questions
- None for the owner. One adjacent gap left untouched on purpose:
  chunk-recovery's announcement-dwell probe matches only the map
  surface's card copy ("Couldn't load the map."), so GeoDetective /
  Cold Trail cards get no dwell before a handler-driven reload; the
  boundary path added here reloads those surfaces on the probe's
  verdict instead. Flagged for a later change, not folded into this
  fix.

## Ruled out
- Service-worker stale shell as the mechanism (see above).
- Silencing the crash reporter for chunk errors entirely: the
  post-reload repeat still reports, exactly once.
- Changing the update toast / SW: navigations are already
  network-first, so a reload fetches the current shell; no SW change
  is needed.
