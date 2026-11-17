# fix/board-spec-live-call — status

## Done
- Investigated the reported red kill-switch test (`board.desktop.spec.ts:562`,
  "sees a GitHub call with the live feed off"). Hermetically on unmodified
  main `4c3d84c8` it does NOT reproduce: test green alone, board file 18/18.
- Bisect by diff: neither #525 (`8661d0e3`) nor #523 (`072249bd`) touched
  `src/lib/flags.ts`, `src/board/live-feed.ts`, or the board's flag gate;
  #523's board.tsx changes are copy/layout only. No introducing merge in
  the gating path.
- Root cause found by trace: the live-feed gate **failed open**. When
  `flags.json` cannot be read (fetch abort/timeout — `loadFlags` never
  rejects, "defaults win"), the baked-in default `boardLiveFeed: true`
  fired the GitHub check anyway. Reproduced deterministically: with
  flags delivery blocked at context level, main code fires
  `GET api.github.com/.../pulls` (trace evidence); a service-worker-
  mediated flags fetch bypasses page-level routes, which is how the
  reviewers' env saw the call despite the test's page-level OFF body.
- Fix (product): `flags.ts` tracks whether a remote payload was actually
  applied (`flagsRemoteApplied()`); the board's live-feed effect now
  requires positive confirmation before running the check. Snapshot
  board is the safe state when flags are unreadable.
- Fix (harness): the kill-switch test now also serves its OFF payload at
  context level, so a service-worker flags fetch cannot be handed the
  opt-in payload from `beforeEach`. Assertions unchanged in strength.
- New regression test: "flags.json unreachable: the feed fails closed".
  Red on main code (revert check: src fix stashed → test fails on
  `githubCalled`), green on this branch.

## Evidence
- Branch: board file 19/19 green (hermetic recipe, pinned Chromium,
  workers=1); `npx tsc --noEmit` clean; `src/lib/flags.test.ts` green.
- Main, same env: kill-switch test green alone and in file (18/18) —
  the brief's red is environment-dependent (SW timing), mechanism above.

## Next step
- Owner reviews and merges on their word. CI carries the full suite.

## Open questions
- None for this branch. The service worker's flags cache fallback
  (stale ON payload when the network fails) is production design in
  `public/sw.js`, left untouched; the fail-closed gate now covers the
  board feed regardless.

## Ruled out
- Route-registration order between the spec route and `serveBuiltArtifact`
  (later-registration dispatch verified working via probes).
- A new fetch path from #523 bypassing the fixtures (no such change).
- Board fetching before flags land (effect awaits `loadFlags()`).

## Graph
- No graph nodes added (integrator: none needed; behaviour note lives here).
