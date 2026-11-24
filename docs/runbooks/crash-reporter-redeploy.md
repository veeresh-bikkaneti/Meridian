# Crash-reporter redeploy and health check

The crash-report worker (`meridian-crash-report`) is not deployed by
this repository's CI, and not by `wrangler deploy`. Every live release
has been a manual API version upload: bindings ride in the version
metadata. This runbook is the owner step. Do not treat a green local
dry-run as a production deploy.

Retention on new KV writes (already in the worker, documented in
`workers/crash-report/README.md`): counter buckets 90 days, ops records
7 days, health incidents 30 days, the health-probe key 60 seconds.
Older keys written before the TTL change are left in place.

## Production deploy

From the repo root, bundle the worker. The emit is one file,
`dist-worker/index.js`. Production uploads that file, not
`src/dev-entry.ts`.

```sh
npx tsc workers/crash-report/src/index.ts --outDir dist-worker \
  --module esnext --target es2022 --moduleResolution bundler --skipLibCheck
```

Upload that module as a new version whose metadata carries the
bindings, then deploy that version. The ops helper lives outside this
repo, with the crash-report watchdog ops files:

```sh
cf-version.py deploy
```

The upload metadata must include, with values the owner holds (never
commit them):

- `DISCORD_WEBHOOK_URL` as `secret_text` (the text is the webhook).
- `TELEMETRY_COUNTS` as `kv_namespace`, namespace id
  `34884ed9aa46437f871278a517882e72`.
- Optional `CRASH_RATE_LIMITER` as `ratelimit`, namespace id `72073`,
  simple limit 10 per 60 seconds.

A version uploaded without those bindings still answers `/health` with
HTTP 200 and `ok: true`, and counting stays off. There is no later
step that adds a secret: a value-less secret binding is rejected, and
a script-level secret write is blocked.

Off the ops-files setup, use the Cloudflare dashboard or the Workers
versions API with the same metadata. Do not use `wrangler deploy` for
a release.

## Health check

After the version is deployed:

```sh
curl -sS -D - https://meridian-crash-report.knowledgetest.workers.dev/health
```

HTTP status is 200. `cache-control` is `no-store`. There is no CORS
header. The body is JSON. Liveness is `ok` and `live`. Read `health`
for dependency state: `healthy`, `unhealthy`, or `unknown`. HTTP 200
alone does not mean the bindings are present.

When no health record has been stored yet, the body is exactly:

```json
{"ok":true,"v":1,"live":true,"scope":"crash-report-worker","requiredChecks":4,"health":"unknown","reason":"no_record","sampledAt":null,"ageSec":null,"failing":[],"ranChecks":0}
```

A local dry-run with the KV binding and an empty store returns that
same body (see below). Production may instead report `healthy` or
`unhealthy` once a scheduled health run has written `ops:health:last`.
`/health` does not prove a counted ingest. A separate counted check,
only when the owner wants one, is one `tile_failed` POST from an
allowed Origin; the reply must include `"counted":true`.

## Local dry-run

This does not upload anything. From `workers/crash-report` (that
directory's `npm install` provides wrangler if the repo root has not):

```sh
npx wrangler dev -c wrangler.toml --port 8787 --ip 127.0.0.1
curl -sS -D - http://127.0.0.1:8787/health
```

Expected: HTTP/1.1 200, `content-type: application/json`,
`cache-control: no-store`, and the `no_record` JSON body above.
`wrangler.toml` points local dev at `src/dev-entry.ts`. A release
bundle still uses `src/index.ts`.
