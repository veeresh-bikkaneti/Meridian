# BRANCH_STATUS — ops/telemetry-phase1-deploy

**State: READY TO MERGE on the owner's order ("rebase-> test
thoroughly->merge", 2026-10-21) — rebased onto current main (below).
The coordinated window this branch waited for is COMPLETE:
Telemetry Phase 1 went LIVE 2026-10-21 (deployment `9bd9f669` →
version `e3dc6b3b`, code byte-identical to the staged `405db4b5`,
bindings = `DISCORD_WEBHOOK_URL` secret_text + `TELEMETRY_COUNTS`
KV; probe verified `forwarded:true` AND `counted:true`; digest
cron `15 * * * *` in place). The blocked/restored narrative below
is the historical record of the morning's attempts. This branch
now lands only the config record — merging it deploys nothing.**

Base: `origin/main 157d215`. Files changed (2): `workers/crash-report/wrangler.toml`,
this file. The rebase resolved the `BRANCH_STATUS.md` conflict by
keeping this branch's own record (the standing pattern); the
`wrangler.toml` change applied cleanly.

## What this branch changes

- `workers/crash-report/wrangler.toml`: the `TELEMETRY_COUNTS` KV binding
  uncommented with the real namespace id (`34884ed9aa46437f871278a517882e72`).
  The namespace was created 2026-10-21 via the Cloudflare API and exists.
  The hourly digest cron (`15 * * * *`, declared in the same file) was
  also set on the live worker via the schedules endpoint — it is inert
  until Phase 1 code (which has the `scheduled` handler) is deployed.

## Deploy attempt — what happened (2026-10-21)

- Audit first: the live worker ran pre-Phase-1 code (last upload
  2026-10-09; every deployment in API history is `source: api`,
  `triggered_by: upload` — the manual API upload path, not
  `wrangler deploy`). No KV namespaces existed; no cron was set; the
  only secret is `DISCORD_WEBHOOK_URL`.
- Phase 1 code was deployed briefly and PROVEN working: a synthetic
  probe (`js_error`, buildId `observability-probe`) returned
  `{"counted": true}` and the KV bucket `tel:counts:2026-10-21T09:js_error`
  holds that count.
- BUT any newly deployed version runs WITHOUT the Discord webhook
  secret: both upload APIs reject a `secret_text` binding that carries
  no value (error 10021), and a version that omits the secret does not
  inherit it at runtime (probe: `forwarded: false`). The webhook value
  exists only in the platform's secret store, bound to the current
  version lineage; it cannot be read back, and it was never asked for
  in chat.
- Production was therefore rolled back to the previous version
  (`cc323715`, pre-Phase-1) and verified: probe →
  `{"forwarded": true, "results": {"discord": true}}`. Alerting is
  exactly as functional as before the attempt.

## The one owner step that unblocks

Re-supply the webhook value so it can be bound to the new version —
either run, with the URL from Discord (Server Settings → Integrations
→ Webhooks), `python3 ~/workspace/skills/cloudflare/bin/cf.py secret
DISCORD_WEBHOOK_URL <value>` AFTER the agent deploys the Phase 1
version (order matters; coordinate the two steps), or add the deploy
from the Cloudflare dashboard, where the existing secret binding can be
kept as-is. After that: deploy the already-uploaded Phase 1 version,
re-probe (`forwarded: true` AND `counted: true`), done — namespace and
cron are already in place.

## Readiness re-verification (2026-10-21, Cloudflare API, read-only)

- **Live version:** current deployment `3613c1ad` (2026-10-21
  09:45:56Z) routes 100% to version `cc323715` (pre-Phase-1,
  uploaded 2026-10-09) — the known-good restore. Its only binding
  is `DISCORD_WEBHOOK_URL` (secret_text). `/health` → `{"ok":true}`.
- **Phase 1 version still staged:** `405db4b5` exists in version
  history with the `TELEMETRY_COUNTS` KV binding in its metadata
  (annotation: "Telemetry Phase 1 (PR #171)…"). Versions are
  immutable snapshots — it is deployable as-is via a deployments
  call; no re-upload is needed. (It carries no secret binding —
  that is the known gap the window's step 2 closes.)
- **KV + cron in place:** namespace `34884ed9…` (title
  TELEMETRY_COUNTS) exists and still holds the probe bucket
  `tel:counts:2026-10-21T09:js_error`; schedule `15 * * * *` is
  still set on the worker (inert until Phase 1 code is live).
- **Rollback path (proven 2026-10-21):** create a deployment
  routing 100% to version `cc323715` (deployments API, strategy
  "percentage") — exactly what deployment `3613c1ad` did. One call,
  seconds to propagate; `cc323715` remains in version history.
- **`wrangler.toml` header comments cured** (commit `3a527f7`):
  the header no longer prescribes `wrangler secret put` /
  `wrangler kv namespace create` — it now matches the merged docs
  (PR #192): secrets via `cf.py secret` / API, namespace created
  via the API, deploys by API script upload, and this file is the
  human config record (`cf.py deploy` never reads it).

## Pending

- Owner's merge word for this branch (config-only; no code change).
- The coordinated go-live window (deploy `405db4b5` → owner
  re-supplies `DISCORD_WEBHOOK_URL` → probe for `forwarded:true`
  AND `counted:true`).
- Threshold-alert path verified from code + config, not live (a live
  check would need 10+ synthetic events in one hour).
