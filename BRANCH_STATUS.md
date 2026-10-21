# BRANCH_STATUS — ops/telemetry-phase1-deploy

**State: config change for the owner's merge word. The Phase 1 deploy was
ATTEMPTED 2026-10-21 on the owner's order ("Enable deeper observability
into crash reports") and is BLOCKED on one owner-only step (below).
Production was restored to the exact pre-attempt state — no behavior
change is live.**

Base: `origin/main cc23d30`. Files changed (2): `workers/crash-report/wrangler.toml`,
this file.

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

## Pending

- Owner's merge word for this branch (config-only; no code change).
- Threshold-alert path verified from code + config, not live (a live
  check would need 10+ synthetic events in one hour).
