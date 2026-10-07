# Crash-report receiver — Cloudflare Worker (forwarding variant)

Receives the events emitted by `src/lib/observability.ts` (schema:
`docs/observability.md`) and forwards a **compact, PII-free alert** to
Discord and/or email. This is the recommended production receiver: it
pages a human instead of relying on someone reading worker logs.

## Relationship to `worker/observability/` (v1)

The v1 worker is the older **logging-only** receiver: it validates events
and writes one structured JSON log line per event (read via
`wrangler tail`). This worker lives in a **new directory on purpose** —
the old one is untouched. It accepts the same schema **plus
`boot_failure`** and forwards alerts instead of logging the full event.

Deploy **one** of them as the `observabilityEndpoint` target, not both.

## Files

- `src/index.ts` — zero-runtime-dependency Worker. `handleRequest(request,
env)` is exported pure for tests; the default export wires it as `fetch`.
- `wrangler.toml` — worker name, entry point, compatibility date. Contains
  **no secrets** and no `[vars]`.
- `tsconfig.json` — editor-only strict config. The root `tsconfig.json`
  includes only `src` and `server`, so root `npx tsc --noEmit` ignores
  this directory.
- `package.json` — devDependencies (`wrangler`, `@cloudflare/workers-types`,
  pinned). Not installed in this repo's CI; install only where you deploy
  from (`npm install` inside this directory).

## Behavior

- `GET /health` → `200 {"ok":true}`
- `POST /` or `/ingest` → validate one event, forward a compact alert,
  return `200 {"ok":true,"forwarded":true}` (or `"forwarded":false` when
  no forwarding secrets are configured — the no-op mode).
- Bodies over 8 KB → 413. Invalid JSON / schema violations → 400.
  Non-POST on ingest paths → 405. Unknown paths → 404.
- Per-IP fixed-window rate limit: **10 requests / 60 s** per
  `CF-Connecting-IP` → `429` with a `Retry-After` header. (The map is
  in-memory per isolate — fine at this event volume; a true distributed
  limiter is overkill for rare crash reports.)
- Forwarding is fire-and-collect via `Promise.allSettled`: one forwarder
  failing never fails the request. Each forwarder has a 5 s timeout.
- Log lines carry only type/buildId/edition — never PII, never the
  forwarded secrets, never full payloads.
- CORS: the game posts from `https://veeresh-bikkaneti.github.io` to this
  worker's `*.workers.dev` origin. `OPTIONS` → `204` with
  `access-control-allow-origin: *` (safe: no cookies/auth on this
  endpoint), and every response carries the allow-origin header. Without
  this the browser blocks the report POST.

Accepted `type` values: `suspected_crash`, `boot_failure`, `js_error`,
`unhandled_rejection`, `map_error`, `webgl_context_lost`. Required:
`type`, `ts` (finite number, epoch ms), `buildId` (non-empty string).
Optional fields pass through; the forwarded alert uses only type,
buildId, edition/region, lastMilestone, and a truncated error
name/message.

## Deploy

```sh
cd workers/crash-report
npm install          # once, on the machine you deploy from
npx wrangler deploy
curl https://<your-worker-host>/health   # → {"ok":true}
```

Dry-run before deploy (catches validation mistakes locally):

```sh
npx wrangler dev
curl -X POST localhost:8787/ingest -H 'content-type: application/json' \
  -d '{"type":"suspected_crash","ts":1728300000000,"buildId":"test","edition":"globe","lastMilestone":"boot_ready"}'
# → {"ok":true,"forwarded":false}  (no secrets in dev = no-op mode)
```

## Secrets

```sh
cd workers/crash-report
npx wrangler secret put DISCORD_WEBHOOK_URL   # Discord channel → Integrations → Webhooks → New Webhook
npx wrangler secret put RESEND_API_KEY        # https://resend.com/api-keys
npx wrangler secret put REPORT_EMAIL          # recipient, e.g. you@example.com
# Optional (non-secret, but contains an address — use a secret anyway):
npx wrangler secret put REPORT_FROM           # verified sender; default is Resend's onboarding@resend.dev test domain
```

Discord and email are independent: configure either or both. With
neither set, the worker accepts and acknowledges events without
forwarding (`"forwarded":false`), so it is safe to deploy **before**
secrets exist.

## Go-live (repo owner step — NOT done from this branch)

1. Deploy the worker and confirm `/health`.
2. Set secrets (`wrangler secret put …`) as above.
3. Add the Worker URL as the **top-level** `observabilityEndpoint` in
   `public/flags.json` (NOT inside `flags`) and redeploy the site:

```json
{
  "flags": { "learningOutcomes": true, "pwaUpdateToast": true },
  "version": 1,
  "observabilityEndpoint": "https://<your-worker-host>/ingest"
}
```

Until that field is set, the client transport is a complete no-op
(fail-closed). Do **not** commit the Worker URL into this repo's code —
`flags.json` is the only place it belongs.

## Staging vs production

Simplest reliable split: deploy the same code twice under different
names — e.g. `meridian-crash-report-staging` (secrets point at a
test Discord channel / your own inbox) and `meridian-crash-report`
(production). Point a staging flags deploy at the staging worker.
Alternative: wrangler environments (`[env.staging]`) — not configured
here; add only if you outgrow the two-deploy approach.

## Volume-spike alerting

Crash-report volume is normally near zero; a spike usually means a bad
release, not abuse. The Workers free tier allows 100k requests/day —
more than enough headroom. Still, set up a Cloudflare notification
(Dashboards → Notifications → add: **Workers → Requests**) so an
unexpected flood (bug loop, someone replaying events) pages you before
it matters. The per-IP rate limiter caps any single client at 10/min.

## Privacy

- Alerts contain: type, buildId, edition/region, lastMilestone,
  truncated error name/message. Nothing else.
- Never forwarded or logged: sessionId, UA, device facts, breadcrumb
  history, guess/place content, coordinates, stack traces.
- The client (`src/lib/observability.ts`) never collects guess/place
  content or coordinates in the first place.
