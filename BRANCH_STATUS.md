# fix/safari-launch-outage — status

**Branch:** `fix/safari-launch-outage` · **Base:** `origin/main` @ `3c32085` (PR #41 live)

## Incident
P0: Safari users CANNOT LAUNCH https://veeresh-bikkaneti.github.io/Meridian/ — persists AFTER PR #41's crash-loop breaker (live build `3c3208570fe5` verified).

**Key deduction:** the breaker only stops auto-resume after a kill. "Cannot launch" = the trigger is in the BOOT path (fresh load, no saved run), where the breaker never engages. PR #41 fixed the loop, not the trigger. This branch owns the trigger.

## Done
- [x] Worktree `~/workspace/meridian-worktrees/safari-launch-outage`, branch `fix/safari-launch-outage` from `origin/main` (`3c32085`)
- [x] node_modules symlinked from sibling worktree (no download); worktree AGENTS.md read
- [x] Field questions drafted → sent to parent as first handoff
- [x] **Crew D (bisect) — DONE.** `3c32085` + `8f81e13` both boot to interactive menu in ~3.1s, zero console errors, byte-identical heavy assets → trigger is iOS-only (desktop = system Chromium + iPhone UA; no Playwright WebKit installable here). Bisect worktrees cleaned up.
- [x] **Crew B (map-on-boot) — DONE.** Premise correction: menu mounts NO map (fresh load = plain DOM only); zero map-code changes in PRs #35–#41. Map init cannot kill the process before first paint. Latent hazard for later: `boundsFor(run)` fresh `[0,0,0,0]` → remount churn on corrupt saved runs.
- [x] **Crew C (SW catch-22) — DONE.** Verdict: catch-22 does NOT hold for Safari browser tabs — navigations are network-first, one reload delivers any fixed bundle regardless of SW state. SW logic unchanged since PR #36. "Persists after #41" = the #41 bundle still contains the boot-path trigger. Genuine unreachable cases: offline users, iOS home-screen standalone PWA, zombie tabs. Escape hatches ranked: (b) `?nosw` inline-script hatch RECOMMENDED, (c) pre-React staleness banner = follow-up, (a) kill-switch NOT recommended, (d) docs fallback.
- [x] **Crew A (boot-path audit) — DONE.** TanStack Start SPA: `_shell.html` → `__root.tsx` → `index.tsx` → `GameApp`. Fresh load = static splash DOM, no map, no tile fetches; 3 sessionStorage reads, all try/catch fail-closed. **Zero `React.lazy` in src/** — 2.57 MB boot JS evaluated synchronously pre-paint (index 433 KB + routes 2.14 MB), topojson JSON.parse + full-country `feature()` conversion AT IMPORT TIME (`territory.ts:16`, `region-index.ts:35-38`), all of maplibre-gl evaluated before first paint.

## Ranked suspects (iOS-only trigger)
1. **Jetsam during synchronous pre-paint module evaluation** — 2.57 MB JS + import-time topojson work, zero code-splitting, against the iPhone WebContent memory ceiling. Fixable + verifiable → the code-split below.
2. **iOS SW intercepting navigation/boot assets before page JS runs** — PWA wiring landed 2026-10-02, the day before the P0; the one place the in-page breaker can't reach. Recovery/diagnostic → the `?nosw` hatch below. (Note: one crew's "iOS 18.4 = first SW support" claim is shaky — iOS has had SW since 11.3 — but the interception mechanism doesn't depend on it. iOS version from field data is the discriminator.)
3. **Whole-document `hydrateRoot` + known-flaky React #418** — amplifies suspect 1's spike; weakest standalone.

## Fix plan (in implementation — fix crew active 2026-10-03)
1. **Code-split the boot bundle:** `React.lazy` for `SatelliteMap` (+ other game-only modules), lazy-init the territory `feature()` conversion off module top-level, error boundary + retry around the lazy map import. Menu must boot on a fraction of current JS.
2. **`?nosw` escape hatch:** tiny inline `<script>` in the shell HTML — on `?nosw=1`, unregister all SWs, delete `meridian-*` caches, strip param via replaceState, reload once. Works with zero functioning app JS; doubles as the SW diagnostic.
- NOT doing: SW kill-switch (violates no-forced-update), pre-React staleness banner (follow-up).

## Fix-crew progress
- [x] territory.ts: lazy memoized `feature()` conversion + unit test (3 tests green)
- [x] game-app.tsx: `React.lazy(SatelliteMap)` + Suspense + MapErrorBoundary w/ retry
  - Boot JS: 2,574,296 B → 1,395,446 B (index 424 KB + routes 939 KB); maplibre +
    atlas payloads in separate `satellite-map-*.js` chunk (1.18 MB), zero maplibre
    in boot chunks (verified in built output)
  - region-index.ts: deviation — kept sync; the module (incl. its static
    atlas JSON imports) ships in the lazy map chunk. BUT the "no atlas JSON
    is parsed until the map chunk loads" claim was WRONG: countries-50m
    (~750 KB) is ALSO statically imported by src/game/territory.ts, which
    rides the BOOT routes chunk via src/game/scoring.ts (verified in the
    built artifact: countries-50m-*.js re-exports from routes-*.js, and the
    routes chunk contains the topojson arcs). Only states-10m rides the lazy
    satellite-map chunk. The territory feature() walk is lazy+memoized (runs
    at the first pin drop, not boot), but the ~750 KB JSON.parse still runs
    at module evaluation in the boot chunk — the largest remaining
    import-time allocation, and a known residual risk under the jetsam
    hypothesis (not a blocker: menu boot is still 1.40 MB vs 2.57 MB).
  - question-bubble/result-card/run-summary: NOT lazy-loaded (deliberate) —
    small, game-path-only, needed immediately when a run starts
- [x] `?nosw` hatch: `scripts/nosw-hatch.mjs` (testable, 8 tests green) +
  `scripts/nosw-hatch-plugin.mjs` (buildApp-post injection into _shell.html,
  verified: marker present, before </head>, before bundle scripts, node --check clean)
- [x] E2E `tests/e2e/safari-launch.spec.ts` (project `safari-launch`): 3/3 green
  - menu boots w/o satellite-map chunk + under 1.8 MB boot-JS ceiling
  - run start lazy-loads map chunk; pin drop → reveal → Next place works
  - ?nosw=1: SW unregistered, meridian-* cache purged, param stripped, clean boot
  - Note: tile-status "ready" waits avoided — 15 s tile watchdog is a known
    flake under VM CPU contention (sibling crews running Chromium concurrently);
    overlay root is pointer-events-none so the game loop is testable regardless
- [x] Full gates: tsc clean, npm test green (scripts 315: 308 pass / 7 pre-existing
  skips / 0 fail; src 396/396), lint-cards GATE PASSED, build:pages green,
  safari-launch E2E 3/3 green against the final build artifact
- [x] Pushed: 5774a33 (fix) + e2465c9 (E2E) on origin/fix/safari-launch-outage

## Pending (for coordinator)
- [ ] Technical-architect review + tone/docs/a11y review
- [ ] PR → merge per standing auth → live Pages verification (build id)
- [ ] ?nosw-hatch validation on a real iOS device post-ship (crew-side; per Veeresh's 2026-10-03 bar: no device census and no user-side troubleshooting required — field intel is not a gate)

## Pending
- [x] Review-notes fix crew — DONE (all 8 items addressed, gates re-run):
  - Blocker: "Try again" now mints a FRESH React.lazy per attempt
    (`mapAttempt` state + useMemo in PlayLoaded; boundary takes `onRetry`);
    false "remounting re-invokes the factory" comment removed. New E2E
    retry-path test: abort the satellite-map chunk → error card + focus on
    the alert → unblock → Try again → map mounts (proves the import is
    actually re-attempted, which the old code could never do).
  - `unregister()` now scoped to registrations whose scope is under the app
    base (derived from the shell's own directory; BASE_URL="/Meridian/");
    sibling projects on the shared origin untouched. Cache deletion was
    already `meridian-*`-prefixed. Unit tests updated + extended.
  - Plugin buildApp handler now FAILS Pages builds (`GITHUB_PAGES=1`) when
    the shell is missing or the marker is absent (non-Pages builds keep the
    non-fatal warn). New scripts/nosw-hatch-plugin.test.mjs (6 tests).
  - A11y: error fallback focuses the `role="alert"` container
    (`tabIndex={-1}`) on mount/update.
  - `?nosw` operator note added to the scripts/nosw-hatch.mjs module
    docstring (durable, ships with the code).
  - Copy reworded per tone reviewer: "Your game is safe — the map just
    didn't finish loading. Check your connection, then try again."
    (accurate for both chunk-load failures and post-load render errors).
  - Fail-open is loop-proof: ran-flag + post-strip check — if
    history.replaceState threw, the hatch navigates to the stripped URL via
    location.replace instead of reloading with `?nosw=1` intact. Unit-tested.
  - Record corrected (see fix-crew progress above): countries-50m (~750 KB)
    is hoisted into the BOOT routes chunk (scoring.ts → territory.ts static
    JSON import); only states-10m rides the lazy chunk. The feature() walk
    is deferred but the JSON.parse still runs at boot-chunk module
    evaluation — largest remaining import-time allocation, known residual
    jetsam risk, not a blocker.
- [x] Fix implementation crew — DONE (commits 5774a33, e2465c9, 3ab442d, pushed). Boot JS 2,574,296 B → 1,395,446 B (−46%); satellite-map 1,180,740 B lazy chunk, zero maplibre in boot chunks; territory feature() lazy+memoized (156 ms import-time removed); ?nosw inline hatch verified in built _shell.html. Gates: tsc clean, 396/396 src + 308 script tests pass, lint-cards GATE PASSED, build:pages green, E2E 3/3 (menu boot under 1.8 MB ceiling, lazy map run, ?nosw purge+strip+boot).
- [x] Tone/docs/a11y review — DONE: **PASS-WITH-NOTES**. Copy at Veeresh's bar ("Couldn't load the map / Your game is safe — only the map download failed"), "Your game is safe" verified accurate (sessionStorage restore). One should-fix: focus management on the error-boundary fallback (move focus to alert/Try-again on appearance). One nit: durable 3-line `?nosw` usage note for phone support. Nothing user-visible wrong with the hatch.
- [x] Technical-architect review — DONE: **FAIL** — 1 blocker: "Try again" can't re-invoke the dynamic import (React.lazy caches the rejected promise per component type; retry re-renders the same lazy() → throws cached error). 2 should-fix: (a) `unregister()` is origin-wide — scope to app base; (b) plugin buildApp handler silently skips if TanStack changes hooks — add build-time assertion for Pages builds. Nits: countries-50m (~750KB) rides the BOOT chunk (record correction + residual jetsam risk), copy scoping, fail-open ran-flag. Verified independently: split is real in built artifact, hatch well-tested, deviations sound, zero new deps.
- [x] Review-notes fix crew — DONE (all 8 items addressed; gates re-run green; committed as this revision)
- [ ] Re-verify reviews' blockers cleared → PR → merge per standing auth → live Pages verification (build id)
- [ ] ?nosw-hatch validation on a real iOS device post-ship (crew-side; per Veeresh's 2026-10-03 bar: no device census and no user-side troubleshooting required — field intel is not a gate)

## Rules
- Minimal launch fix only. Do NOT ship anything that strands users further.
- Push early and often; stage named files only, never `git add -A`.
