# BRANCH_STATUS — ops/telemetry-phase1-deploy

**State: config change for the owner's merge word. The production deploy
itself was executed from this checkout on the owner's explicit order
(2026-10-21: "Enable deeper observability into crash reports") — this
branch exists so the wrangler.toml change lands in git; merging it does
not redeploy anything.**

Base: `origin/main cc23d30`. Files changed (2): `workers/crash-report/wrangler.toml`,
this file.

## What changed

- `workers/crash-report/wrangler.toml`: the `TELEMETRY_COUNTS` KV binding
  is uncommented with the real namespace id (`34884ed9aa46437f871278a517882e72`,
  created 2026-10-21 via the Cloudflare API). This is the one config piece
  Telemetry Phase 1 (PR #171, merged 2026-10-17) was waiting on: per-hour
  event counters, hiccup threshold alerts, and the hourly digest cron
  (`15 * * * *`, already declared in the same file).

## Deploy facts (for the record)

- Production worker `meridian-crash-report` previously ran pre-Phase-1
  code, last uploaded 2026-10-09 via the Cloudflare API (every deployment
  in the API history is `source: api`, `triggered_by: upload` — the
  manual upload path, not `wrangler deploy`).
- Phase 1 was deployed 2026-10-21 from this checkout via the same API
  upload path, with the KV binding in the upload metadata and the cron
  trigger set through the schedules endpoint. Verified end-to-end with
  synthetic probe events (buildId `observability-probe`): crash-class
  forwarded + counted; hiccup-class counted, not forwarded.

## Pending

- Owner's merge word for this branch (config-only; no code change).
- Threshold-alert path is verified from code + config, not live (a live
  check would need 10+ synthetic events in one hour).
