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
- [ ] territory.ts: lazy memoized `feature()` conversion + unit test
- [ ] game-app.tsx: `React.lazy(SatelliteMap)` + Suspense + error boundary w/ retry
- [ ] region-index.ts: stays sync; moves to lazy map chunk (documented deviation)
- [ ] `?nosw` hatch: `scripts/nosw-hatch.mjs` (testable) + vite build plugin + unit tests
- [ ] E2E: boot-chunk-size assertion, lazy map run, `?nosw` path
- [ ] Gates: tsc, npm test, lint-cards, build:pages, Playwright

## Pending
- [ ] Fix implementation crew → full gates (unit, tsc, lint-cards, build, E2E incl. boot-chunk-size assertion + full run + ?nosw path)
- [ ] Technical-architect review + tone/docs/a11y review
- [ ] PR → merge per standing auth → live Pages verification (build id)
- [ ] Field answers from Veeresh (iOS versions, private-tab test, ?nosw test post-ship)

## Rules
- Minimal launch fix only. Do NOT ship anything that strands users further.
- Push early and often; stage named files only, never `git add -A`.
