# BRANCH_STATUS.md — fix/ios-crash-observability

## What / why

iPhone 11 / iOS 16.4.1 players hit page crashes / game-not-loading
(coordinator + reviewer reports, 2026-10-04: leading mechanism is a
jetsam memory kill at run start; verdict PLAUSIBLE / NEEDS WORK — no
on-device repro exists). Two prior P0s stalled for lack of
observability: the existing `meridian.cleanExit` flag detects a process
kill but was never reported and carried no context. This branch adds
that observability, plus one small memory mitigation. **No payload fix
(Globe chunk split) is in this branch** — see Follow-ups.

Base: `origin/main` @ `650065e95f01` (the live build investigated).

## Done

- [x] `src/lib/observability.ts` — breadcrumb trail in sessionStorage
  (`meridian.breadcrumb`: anonymous per-tab sessionId, buildId,
  startedAt, lastMilestone, history capped at 12, edition/regionId/
  chunkId, coarse device facts; every field optional, collection never
  throws; injectable storage + transport seams like clean-exit.ts).
- [x] Next-boot `suspected_crash`: in game-app's boot path,
  `initObservability()` runs **before** the crash-loop-breaker effect
  consumes clean-exit state. If `isUncleanShutdown()` and a previous
  breadcrumb exist, exactly one event carrying the previous trail is
  emitted; the previous trail is rotated/cleared immediately, even if
  transport fails. (A jetsam kill cannot beacon during the kill —
  detection is by asymmetry at next boot; stated in code + docs.)
- [x] Milestones wired at real call sites: `boot_start` (init),
  `boot_ready` (ready state), `run_start` / `data_chunk_load_start` /
  `data_loaded` (openRun around `placesFor`), `map_init_start` /
  `map_ready` (satellite-map construction / map `load`), `game_loaded`
  (Play: places loaded + aim phase). Milestone calls are internally
  wrapped and can never throw into gameplay.
- [x] Live events on the same emit path: window `error`,
  `unhandledrejection` (installed once, guarded), `MapErrorBoundary`
  `componentDidCatch` → `map_error`, `webglcontextlost` on the MapLibre
  canvas → `webgl_context_lost`. Error payloads: name + message
  truncated to 300 chars; no stacks, no PII, no guess/place content.
- [x] Transport: no endpoint → complete network no-op (returns false).
  Endpoint set → `navigator.sendBeacon` first, `fetch` POST +
  keepalive fallback, failures swallowed. Payload hard cap 4096 bytes
  (serialize → history trimmed to last 4 → history dropped → breadcrumb
  + device dropped → string fields progressively truncated → core-only
  fallback) — implemented + unit-tested.
- [x] Endpoint config via flags: top-level `observabilityEndpoint` in
  flags.json, validated in `src/lib/flags.ts` (https or root-relative
  only, fail closed to null). **Shipped flags.json sets NO endpoint** —
  production behavior unchanged. Boot events queue in memory and flush
  once `loadFlags()` resolves and the endpoint is applied (chosen
  design; documented in `docs/observability.md`).
- [x] Worker receiver, in-repo only: `worker/observability/`
  (`worker.js` zero-dep handler: POST-only ingest 204, >8 KB → 413,
  invalid schema → 400, non-POST → 405, `GET /health`; v1 store =
  structured JSON log line enriched with UA-derived iOS version;
  `wrangler.toml.example` with no real account ids; README with deploy
  steps, count-by buildId × edition × iOS-version example, and
  D1/KV/Analytics-Engine upgrade path).
- [x] Secondary mitigation: `src/map/map-options.ts` —
  `mapOptionsForDevice()` caps `pixelRatio` at 1.5 on coarse-pointer
  devices and sets `maxTileCacheSize: 64`; wired into the `new Map()`
  construction in `src/map/satellite-map.tsx`. (Extracted as a helper —
  not inline — so the policy is unit-tested.)
- [x] Docs: `docs/observability.md` — event schema (all types/fields),
  jetsam next-boot explanation, privacy statement, enable steps,
  how to read counts/funnel, Globe-split follow-up noted.

## Reviewer follow-up fixes (2026-10-04, after REPORT-fix-review)

Independent review of `ec81ff0` returned NEEDS WORK: one major defect
(D1) + two minor (D2, D3), one minor out of scope (D4), one
informational (D5). Disposition on this branch:

- [x] **D1 (major) — FIXED.** `cleanExit` was only stamped dirty by
  `writeRun`, which runs *after* the data-chunk load, so a first-run
  jetsam kill during the chunk load left the flag missing/`"1"` and
  no `suspected_crash` ever fired for the headline window.
  `openRun` (`src/components/game-app.tsx`) now calls
  `stampCleanExitDirty()` at run start, **before** `await placesFor(...)`
  (comment at the call site covers breaker interplay, no spurious
  report after a caught chunk-load error, and re-arming on every
  retry). Breaker logic, `writeRun`, and `clean-exit.ts` semantics
  unchanged. No other arming point was added: the game-screen
  `placesFor` runs after commit (flag already dirty) and `onReplay`
  uses already-loaded places.
  Proven by REAL-SEQUENCE tests (no seeded flag, no fake unclean
  check — the real `isUncleanShutdown` / `stampCleanExitDirty` /
  `handlePageHide` / `clearRunAfterUncleanShutdown` against one shared
  fake storage): 4 new unit tests in `src/lib/observability.test.ts`
  (kill-during-load → exactly one `suspected_crash`, globe /
  `data_chunk_load_start`; synchronous arming; clean exit after an
  armed start → none; repeat kill after breaker re-arm → second
  report). Plus a new E2E test in `tests/e2e/observability.spec.ts`
  that holds the real built Globe chunk request
  (`assets/globe-*.js`, 13,696,487 B), starts a run via the real UI,
  polls in-page state (reads only) until `cleanExit === "0"` and the
  breadcrumb's `lastMilestone === "data_chunk_load_start"`, then
  opens the next boot via `window.open` (Chromium clones the armed
  tab's sessionStorage per spec; the armed tab never fires pagehide
  first): exactly one `suspected_crash` (globe /
  `data_chunk_load_start`, armed session id) and the popup lands on
  the menu. The spec comment states precisely what this does and
  does not simulate (storage-equivalent next boot in a different
  tab; no real process kill; desktop Chromium).
- [x] **D2 (minor) — DOCS CORRECTED** (persistence deliberately not
  built). Delivery is now stated as **at-most-once** in
  `docs/observability.md` and the `observability.ts` header: a queued
  `suspected_crash` lives only in memory until flags resolve and
  flush it (bounded by the flags load/timeout); if the tab is closed
  or killed again in that window, the report is lost and will not
  re-fire (the trail was already rotated). The "never lost just
  because config is async" wording is removed everywhere.
- [x] **D3 (minor) — FIXED.** Queue eviction in `emit()` removes the
  oldest **non-`suspected_crash`** event first; only an entirely
  `suspected_crash` queue may drop its oldest. Memory bound
  (MAX_QUEUE 20) unchanged. 2 new unit tests (burst of 25 errors
  cannot evict a queued `suspected_crash`, which flushes first;
  error-only queue still caps at 20 FIFO).
- [x] **D5 (informational) — FIXED.** Cap sequence now stated exactly
  as implemented everywhere it is described (`docs/observability.md`,
  this file, the `truncateEventToCap` docstring): serialize → trim
  history to last 4 → drop history → drop breadcrumb + device →
  progressively truncate string fields (120/60/24, error name/message
  also cut) → core-only fallback (type/ts/buildId).
- [ ] **D4 (minor) — DEFERRED**, out of scope for this fix round:
  Worker ingest schema is a subset of the documented schema
  (breadcrumb internals / device numeric types / unknown fields not
  validated). Recorded as a worker-schema follow-up for the deploy
  step; client behavior unaffected.

## Gates (run on this branch, this VM)

- `npx tsc --noEmit` — **clean**.
- `npm test` — **exit 0**. Suite 1 (scripts): 389 tests, 382 pass,
  7 skipped (pre-existing skips in files this branch does not touch),
  0 fail. Suite 2 (src): **588/588 pass**, including 21 new tests
  (observability 15 — 9 original + 4 D1 real-sequence + 2 D3 —
  map-options 3, flags-endpoint 3).
- `npm run test:worker` — **9/9 pass** (separate script; main test
  script scope unchanged apart from the added src test files).
- `node scripts/lint-cards.mjs` — **GATE PASSED**.
- `npm run build:pages` — **green**. Boot assets vs the `ec81ff0`
  figure (1,469,949 B): new total **1,470,026 B, delta +77 B**
  (routes 991,947 +77; index 435,521, shell 4,828, styles 37,730
  unchanged). Satellite chunk 1,068,203 B (unchanged).
  Note: the build was run at HEAD `e323b4f` (before the docs/status-only
  final commit); no client code changed after it.
- Playwright E2E — **ran in this environment** (Chromium 152,
  `/opt/meta-chromium/chrome`, built artifact):
  - `tests/e2e/observability.spec.ts` (project added to
    `playwright.config.ts`): **3/3 pass** — seeded unclean boot emits
    exactly one `suspected_crash` with previous edition context
    (globe / `data_chunk_load_start`), reload emits none; clean boot
    emits none; **new D1 real-sequence test** (chunk held, armed via
    the real run start, no seeding) emits exactly one on next boot.
  - Regression: `crash-loop-breaker.spec.ts` **3/3 pass**,
    `feature-flags.spec.ts` **8/8 pass**. The full E2E suite was NOT
    run end-to-end.

## Enablement — NOT DONE (by design; needs Liz/Veeresh)

- [ ] Deploy the Worker (`worker/observability/README.md`) — **not
  deployed**, no account used, nothing paid.
- [ ] Set `observabilityEndpoint` in `public/flags.json` and redeploy
  flags — **not set**; shipped flags.json is byte-identical to main.
- [ ] Merge / PR — **none opened**. Push is to this feature branch only.

## Follow-ups (not in this branch)

- **Globe 13.7 MB chunk split** (page by country/continent, fetch as
  JSON) — the documented highest-impact payload fix; this branch only
  makes its cost measurable.
- Real-device gate (iPhone 11 / iOS 16.4.1) remains the confirmation
  step for the jetsam hypothesis — observability data from the field
  is what this branch enables.
- Prior suspects S1/S2 (projection-swap race; +10 s boundary-geometry
  load) untouched.
