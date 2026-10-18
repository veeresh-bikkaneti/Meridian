# BRANCH_STATUS — feat/telemetry-phase1-counts

**Mission (owner: Veeresh; approved 2026-10-17):** Phase 1 of the
telemetry upgrade — make the crash-report worker count events, tier
severity, and post digests, so bursts are distinguishable from
background noise without collecting any identity. Worker-side ONLY.

**Base:** `origin/main` @ `6817186` (PR #170 docs refresh). The branch
was rebased onto it mid-build (commit `a6a9aa9`; `6817186` is an
ancestor of HEAD — verified by the review panel); no rebase is pending.

**Scope:** `workers/crash-report/` only (code + README + wrangler.toml).
NO client/app changes (`src/`, `public/` untouched). NO deployment —
deploy stays an owner step; the wrangler-vs-manual-version_upload
question is NOT resolved here.

## Design (claims — Chitti reviews before merge)

- **Store: Workers KV, one key per (UTC hour × event type).**
  Rejected: Analytics Engine — its reads are eventual (minutes) and only
  queryable via its SQL API, so it cannot drive the in-request threshold
  check or the "current hour" digest reads. KV: read-your-writes in the
  worker, one binding, free-tier safe (1 GET + 1 PUT per event), no new
  paid services. Approximation accepted: read-modify-write races can lose
  increments — signal, not billing.
- **Severity tiers** (see README for the rationale):

  | Tier | Types | Behavior |
  |---|---|---|
  | crash-class | `suspected_crash`, `boot_failure`, `js_error`, `unhandled_rejection`, `map_error` | Immediate Discord/email forward, unchanged format; also counted. |
  | hiccup-class | `tile_failed`, `webgl_context_lost` | Counted only; no individual forward. Threshold alert + digest. |

- **Threshold:** 20 events/hour of one hiccup type across builds, or
  10/hour from a single buildId — exactly one Discord alert per
  type+hour (flag stored in the bucket; near-zero cross-isolate race
  window documented in code). Env-overridable:
  `TELEMETRY_THRESHOLD_PER_HOUR`, `TELEMETRY_THRESHOLD_PER_BUILD`.
- **Hourly digest:** cron `15 * * * *` posts ONE Discord message for the
  previous UTC hour (📊 header); zero events → posts nothing. Flags a
  type at >3× its trailing-24h hourly average AND >3 events absolute.
- **Fail-open (hard):** counting is best-effort try/catch; KV absent or
  erroring never 500s the client and never blocks a crash-class
  forward. Tests prove this with a "KV down" store.
- **Privacy invariant preserved:** buckets hold COUNTS ONLY, keyed by
  the coarse dimensions the alerts already carry. No sessionId, no UA,
  no IPs, no payloads — forwarded, logged, or stored.

## Gates

- `npm run test:worker` — **32/32 pass** (18 existing + 14 new:
  tiering, counting per dimension, crash-forwards/hiccup-doesn't,
  threshold exact-once (both rules) + env override, digest renders /
  anomaly / silent-on-zero / no-webhook, fail-open ×2).
- `npm run typecheck:worker` — **clean.**
- Root cross-impact — **all green**: `npx tsc --noEmit` clean,
  `npm test` 0 failures (799 + 1351), `node scripts/lint-cards.mjs`
  GATE PASSED, `npm run build:pages` green. (Independently reproduced
  by Chitti and Scrum Squad 3 at tip `09d57d3`.)

## Deploy steps for the owner (after merge; PR body repeats this)

1. `npx wrangler kv namespace create TELEMETRY_COUNTS` → paste id into
   the commented `[[kv_namespaces]]` block in `wrangler.toml`.
2. Deploy the worker (existing release method — unchanged by this PR).
3. Set secrets as in the README (unchanged); the `observabilityEndpoint`
   in `public/flags.json` does not change.
4. Verify: one `tile_failed` → `{"ok":true,"forwarded":false,
   "counted":true}`; appears in the next hourly digest.

## MERGE NOTE

This branch replaces `BRANCH_STATUS.md` with this branch record, per
repo convention (each feature branch carries its own). The mid-build
rebase onto `6817186` conflicted on this file and the worker README;
both were resolved toward this branch's record + PR #170's framing
(commits `a6a9aa9`, `09d57d3`). On merge the file becomes this branch's
record — the next branch rewrites it again.

**Do-not-touch:** client code, `public/flags.json`, the release
method, secrets. Nobody merges — owner merges on his word.
