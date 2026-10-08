# BRANCH_STATUS — feat/crash-pipeline-gaps

Close the invisible error classes the expert panel found after Emily's iOS
crash produced no Discord alert: tile failures, region-chunk start errors,
and route-boundary errors never emitted anything. Plus: device-blind
Discord alerts, fallback-UI a11y, and a post-deploy smoke script.

Rebased onto origin/main@4e09990 (PR #104 facts-ladder merged) — see "Merged base" below.

## Merged base — facts ladder (PR #104, main@4e09990)

The rebase base now contains the merged facts-ladder pipeline (was
facts-ladder-train). 247 kid-safe facts (arkansas 20, australia 227) in
derived per-region indexes (`src/game/data/geonames/facts/<regionId>.json`),
overlaid at runtime onto chunk places; production chunk files are never
written by build scripts. None of that is this branch's work — it is
inherited from main.

## Done

- `src/lib/observability.ts`
  - New `tile_failed` event type; `emitTileFailed()` (instance + module
    wrapper, mirroring `emitMapError`).
  - `emit()` now attaches the coarse `os`/`form` device bucket
    (`coarseDeviceFacts()`, COPPA-safe — never raw UA) to every event, so
    Discord alerts can say "ios/mobile".
- `src/map/satellite-map.tsx` — `useEffect` emits `tile_failed` when the
  tile status transitions to "failed" (one emit per failure episode; Retry
  resets to "loading").
- `src/components/game-app.tsx` — the region-chunk `startError` catch now
  also emits a `js_error` with the sanitized message.
- `src/lib/error-component.tsx` — `AppErrorComponent` (route error
  boundary) emits the caught error once per distinct error (`[error]` dep).
- `workers/crash-report/src/index.ts`
  - Accepts `tile_failed` (else the new app events 400).
  - Discord alert gains a `device: os/form` line (coarse bucket only);
    privacy comment updated.
- `scripts/crash-watchdog.mjs` (rendered 5109/5120 bytes)
  - a11y: safe-area insets on the veil (with `padding:16px` fallback for
    old browsers), 44px secondary link targets, `role="status"` on the
    confirmation.
  - Byte budget: removed the provably-dead second CAP-truncation block
    (error text capped at 300 chars at capture) and the dead button
    hover transition (+ its reduced-motion override).
- `scripts/crash-smoke.mjs` (new; `npm run smoke:crash`) — post-deploy
  gate: `GET /health`, invalid `POST /ingest` → 400 naming `tile_failed`
  (distinguishes the v2 forwarding worker from the v1 logging worker),
  `flags.json` endpoint validated with the app's exact gate, shell HTML
  watchdog markers. 15 s fetch timeouts; deploy-order + false-fail notes
  in the header.
- Review panel (2026-10-08): senior architect APPROVE-WITH-NITS (no P0;
  all P2s addressed or backlogged), DevOps APPROVE-WITH-NITS (2 P1s in
  the smoke script fixed), frontend APPROVE-WITH-NITS (1 P1 safe-area
  fallback + 1 P2 effect dep fixed).

## Merged base — sprint entry gates (PR #107, main@f07dad3)

The rebase base now contains the merged entry-gate fixes (were
feat/sprint-entry-gates). Entries preserved from main's BRANCH_STATUS.md:

### P1-3 — dead code-split removed
- `src/components/celebration-overlay.tsx`: removed BOTH ineffective
  dynamic imports (`play-guards`, `sfx`); static imports instead. Zero
  `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings; initial index chunk unchanged
  (435.80 kB vs 435.83 kB baseline).

### P2 — missing .catch
- `src/game/story-ai.ts` (`useAiStory`), `src/game/sports-ai.ts`
  (`useAiSportsTeams`): defensive `.catch` on the async IIFEs.

### P1-2 — chunks >500 kB: resolved by design (no code change)
- Entry chunk 435.83 kB (under the limit — no initial-load regression).
  The five >500 kB chunks are already lazy at the finest
  content-preserving granularity. Warning persists by design; senior
  architect signed off.

### P1-1 — SW offline gap + offline-uncached loop notice
- `public/sw.js`: `isStaticAsset()` cache-first covers `/Meridian/audio/`,
  `/Meridian/__grok/`, `/Meridian/loop/` (runtime only; only
  `loop/manifest.json` precached at install).
- `src/hooks/use-online-status.ts` (new, tested).
- `src/game/loop/LoopScreen.tsx`: offline-uncached notice in the
  error-card slot (`role="alert"`) — `This mystery can't open right now 🔍`
  / `Try again` (min-h-[48px]).
- `tests/e2e/offline-content.spec.ts` (new; 5/5 via `--project
  offline-content`).

## Pending

- PR handover (no merge per owner): coordinator opens the PR with this
  report; senior architect + DevOps + frontend have reviewed.
- Owner-side (Veeresh) deploy steps this branch does NOT do:
  - Deploy `workers/crash-report/` (v2 forwarding worker) — worker FIRST,
    then smoke, then flags (deploy-ordering hazard: old worker 400s
    `tile_failed`, silent telemetry loss).
  - Set `observabilityEndpoint` in `public/flags.json` (untouched here).
  - Decide deletion of `worker/observability/` (v1 dir, untouched here).
  - Run `npm run smoke:crash <workerBase> <gameBase>` after deploy.
- Backlog (P2, not blocking): per-session `tile_failed` dedupe (death
  spiral can hit the 10/IP/min worker cap); watchdog byte headroom now
  11 bytes — next addition needs a cut.

## Verification (local, 2026-10-08)

- `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED
- `npm test`: src suite 850/850 green; scripts suite 483/512 (22 failures
  pre-existing on clean main — env/fingerprint/preview tooling, 0 in
  crash-watchdog); observability 17/17 (incl. new emitTileFailed test)
- Worker: `npm run test:worker` 18/18 (incl. tile_failed accept + device
  line tests), `npm run typecheck:worker` clean
- Watchdog unit tests 36/36; rendered inline script 5109/5120 bytes
- `npm run build:pages` green (final rebuild with all review fixes)
- Playwright `tests/e2e/crash-watchdog.spec.ts`: 4/4 passed (stale-build
  test updated: chunk failure now emits one js_error by design)
- Browser QA (390px mobile, fallback UI): 10/10 PASS — safe-area
  padding falls back to 16px, env() enhancement present, links 44px,
  confirmation role=status, exactly one boot_failure POSTed, no console
  errors
- `npm run smoke:crash` validated against live prod: correctly FAILs 3/4
  checks on the current broken deploy (no /health, no /ingest, no
  endpoint) — proves it detects the outage class
