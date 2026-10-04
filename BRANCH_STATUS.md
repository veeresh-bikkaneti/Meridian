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
  (history dropped first, then strings truncated) — implemented +
  unit-tested.
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

## Gates (run on this branch, this VM)

- `npx tsc --noEmit` — **clean**.
- `npm test` — **exit 0**. Suite 1 (scripts): 389 tests, 382 pass,
  7 skipped (pre-existing skips in files this branch does not touch),
  0 fail. Suite 2 (src): **582/582 pass**, including 15 new tests
  (observability 9, map-options 3, flags-endpoint 3).
- `npm run test:worker` — **9/9 pass** (separate script; main test
  script scope unchanged apart from the added src test files).
- `node scripts/lint-cards.mjs` — **GATE PASSED**.
- `npm run build:pages` — **green**. Boot assets vs the investigated
  live baseline (1,463,898 B = shell 4,828 + index 435,175 + routes
  986,165 + styles 37,730): new total **1,469,949 B, delta +6,051 B**
  (index 435,521 +346; routes 991,870 +5,705; styles/shell unchanged).
  Satellite chunk 1,068,203 B (+816 vs live 1,067,387). Bundle grep:
  `suspected_crash` present in the built routes chunk — shipped.
  Note: the build was run at HEAD `d195a72` (before the docs/E2E-only
  final commit); no client code changed after it.
- Playwright E2E — **ran in this environment** (Chromium 152,
  `/opt/meta-chromium/chrome`, built artifact):
  - `tests/e2e/observability.spec.ts` (new; project added to
    `playwright.config.ts`): **2/2 pass** — seeded unclean boot emits
    exactly one `suspected_crash` with previous edition context
    (globe / `data_chunk_load_start`), reload emits none; clean boot
    emits none.
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
