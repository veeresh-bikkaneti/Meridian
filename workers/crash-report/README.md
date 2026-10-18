# Crash-report receiver — Cloudflare Worker (forwarding variant)

Receives the events emitted by `src/lib/observability.ts` (schema:
`docs/observability.md`) and handles them by severity tier:

- **crash-class** — `suspected_crash`, `boot_failure`, `js_error`,
  `unhandled_rejection`, `map_error`: forwards a **compact, PII-free
  alert** to Discord and/or email **immediately**, exactly like before.
- **hiccup-class** — `tile_failed`, `webgl_context_lost` (resource
  signals that are usually benign/transient: a tile CDN hiccup, or a
  mobile OS reclaiming the GPU context on backgrounding): **counted,
  NOT forwarded individually.** They surface through a threshold alert
  and the hourly digest instead.

Every accepted event is also **counted** into per-hour buckets in a
Workers KV namespace (`TELEMETRY_COUNTS`), keyed by UTC hour × type ×
buildId × edition × region × os/form device bucket — **counts only**,
no payloads, no identifiers.

## Relationship to `worker/observability/` (v1)

The v1 worker is the older **logging-only** receiver: it validates events
and writes one structured JSON log line per event (read via
`wrangler tail`). This worker lives in a **new directory on purpose** —
the old one is untouched. It accepts the same schema **plus
`boot_failure` and `tile_failed`** and forwards alerts instead of
logging the full event.

Deploy **one** of them as the `observabilityEndpoint` target, not both.

## Files

- `src/index.ts` — zero-runtime-dependency Worker. `handleRequest(request,
env)` is exported pure for tests; the default export wires it as `fetch`
plus a `scheduled` handler for the hourly digest.
- `wrangler.toml` — worker name, entry point, compatibility date, the
  hourly cron trigger, and a commented-out `TELEMETRY_COUNTS` KV binding
  (the owner creates the namespace once and pastes its id — see Deploy).
  Contains **no secrets** and no `[vars]`.
- `tsconfig.json` — editor-only strict config. The root `tsconfig.json`
  includes only `src` and `server`, so root `npx tsc --noEmit` ignores
  this directory.
- `package.json` — devDependencies (`wrangler`, `@cloudflare/workers-types`,
  pinned). Not installed in this repo's CI; install only where you deploy
  from (`npm install` inside this directory).

## Behavior

- `GET /health` → `200 {"ok":true}`
- `POST /` or `/ingest` → validate one event, count it (best-effort;
  the ingest path never 500s because counting failed), and forward
  immediately **only if it is crash-class**. Response:
  `200 {"ok":true,"forwarded":true|false,"counted":true|false}`
  (`"forwarded":false` when no forwarding secrets are configured, or
  when the event is hiccup-class — both are normal modes, not errors).
- Cron (`15 * * * *`, the `scheduled` handler) → posts the **hourly
  digest** to Discord: one compact message per hour summarizing the
  PREVIOUS UTC hour. Zero events → nothing posted (silence is the
  healthy signal).
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

## Severity tiers

| Tier | Types | Behavior |
|---|---|---|
| crash-class | `suspected_crash`, `boot_failure`, `js_error`, `unhandled_rejection`, `map_error` | Forwarded to Discord/email **immediately** (unchanged format); also counted. |
| hiccup-class | `tile_failed`, `webgl_context_lost` | **Counted only** — no individual forward. Surfaced via the threshold alert and the hourly digest. |

Rationale: hiccup-class events are resource signals that are usually
benign/transient in production (`tile_failed` fires on ordinary tile CDN
hiccups; `webgl_context_lost` fires when a mobile OS reclaims the GPU
context on backgrounding). Forwarding each one as a 🚨 trained readers
to ignore the channel — the threshold alert and digest restore the
signal-to-noise ratio. Crash-class events are unaffected: same
immediate alert, same message format, same no-op mode when no
forwarding secrets are configured.

## Threshold alert

When a hiccup-class event arrives and its count for the current UTC
hour crosses a threshold, the worker posts **one** Discord alert for
that type+hour — exactly one, even if the count keeps climbing:

```
🚨 Meridian telemetry alert
type: tile_failed crossed the hiccup threshold (20/hour across builds)
hour: 2026-10-18 02 UTC · counts: 22 total (f331846 ×20, 50122c6 ×2)
one alert per type+hour — further events this hour only raise the counts
```

Defaults: **20 events/hour of one type across all builds**, or
**10/hour from a single buildId** — whichever trips first. Override
with the (optional, non-secret) env vars `TELEMETRY_THRESHOLD_PER_HOUR`
and `TELEMETRY_THRESHOLD_PER_BUILD` (positive ints; anything else falls
back to the defaults). Exact-once holds per isolate via a flag stored
in the hour's bucket; under pathological cross-isolate concurrency the
race window is near-zero at this traffic level (documented in the
code), and a duplicate would be the identical message.

## Hourly digest

The `[triggers]` cron (`15 * * * *`) runs the digest ~:15 of each hour
for the **previous** completed UTC hour. One compact Discord message:

```
📊 Meridian telemetry — hourly digest
hour: 2026-10-18 02:00–03:00 UTC (27 events)

js_error 2 · f331846 ×2 · country ×2 · linux/desktop ×2
tile_failed 22 · f331846 ×20, 50122c6 ×2 · country ×22 · linux/desktop ×22 ⚠️ >3× 24h avg (0.0)
webgl_context_lost 3 · f331846 ×3 · state ×3 · android/mobile ×3

alerts this hour: tile_failed threshold
```

Each type line shows the count plus the top builds, editions, and
device buckets. A line is flagged **⚠️** when its count exceeds
**3× the trailing 24-hour hourly average** for that type AND exceeds 3
events absolute — a first-ever burst (avg 0) flags too, which is the
point. **Zero events in the hour → nothing is posted** (silence is the
healthy signal). The digest needs the Discord webhook; with no webhook
it renders but stays silent.

## Counting store (why KV)

One key per (UTC hour × type), e.g. `tel:counts:2026-10-18T02:tile_failed`,
holding a small JSON bucket:

```json
{ "total": 22, "builds": {"f331846": 20}, "editions": {"country": 22},
  "regions": {"united-states": 22}, "devices": {"linux/desktop": 22},
  "alerts": ["threshold:tile_failed:2026-10-18T02"] }
```

**KV, not Analytics Engine:** the threshold check must read the
current hour's count *during* the ingest request, and the digest reads
the previous hour plus the trailing 24 — Analytics Engine reads are
eventual (minutes) and only queryable via its SQL API, so it cannot
drive either. KV gives read-your-writes in the worker behind one
binding, is free-tier safe at this volume (one GET + one PUT per
event; buckets are a few hundred bytes), and needs no new paid
services. Approximation accepted: read-modify-write races between
isolates can lose increments under concurrency — this is signal, not
billing.

**Fail-open (hard requirement):** counting is best-effort inside
try/catch; a KV error or a missing/ unbound `TELEMETRY_COUNTS` never
500s the client and never blocks a crash-class forward. Deploy is
safe with the binding absent (counting is skipped) — add it when
ready. Corrupt buckets are treated as absent and replaced on next
write.

Accepted `type` values: `suspected_crash`, `boot_failure`, `js_error`,
`unhandled_rejection`, `map_error`, `tile_failed`, `webgl_context_lost`.
Required: `type`, `ts` (finite number, epoch ms), `buildId`
(non-empty string). Optional fields pass through; the forwarded alert
uses only type, buildId, edition/region, lastMilestone, and a
truncated error name/message.

## Tests

```sh
npm run test:worker        # 32 unit tests (validation, alert builder, rate limiter, CORS,
                           #  Phase 1: tiering, counting, threshold exact-once, digest, fail-open)
npm run typecheck:worker   # strict tsc on the worker sources
```

Both run in CI (`.github/workflows/node.js.yml`). The Phase 1 tests run
the pure handlers against an in-memory store — **no live Cloudflare
calls**: KV, Discord, and Resend are all mocked or absent, including a
"KV down" case that proves the ingest path stays 200 and crash-class
forwards still fire.

## Deploy

```sh
cd workers/crash-report
npm install          # once, on the machine you deploy from
npx wrangler kv namespace create TELEMETRY_COUNTS   # Phase 1 counters (once)
# → paste the returned id into the [[kv_namespaces]] block in wrangler.toml (uncomment it)
npx wrangler deploy
curl https://<your-worker-host>/health   # → {"ok":true}
```

**Owner step, in this order** (the worker's live deploy is a repo-owner
step, and the wrangler-deploy vs manual-version_upload question is
still open — do NOT change the release method here):

1. Create the KV namespace (command above) and paste the id into
   `wrangler.toml`; the cron trigger needs no extra setup.
2. Deploy the worker and confirm `/health`.
3. Set secrets (`wrangler secret put …`) as above.
4. Verify: send one `tile_failed` event — it must be counted and NOT
   forwarded individually (`{"ok":true,"forwarded":false,"counted":true}`);
   the next hourly digest should include it. The existing production
   endpoint already set in `public/flags.json` does not change.

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

## Go-live — DONE (2026-10-17)

The worker is live at `meridian-crash-report.knowledgetest.workers.dev`
and `public/flags.json` on main points `observabilityEndpoint` at its
`/ingest`. The procedure below is what was run:

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

The field is set in production (see above); without it, the client
transport is a complete no-op (fail-closed). Do **not** commit the Worker URL into this repo's code —
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
- The Phase 1 counters contain: per-UTC-hour counts keyed by type,
  buildId, edition, region, and os/form device bucket. Counts only —
  no payloads, no identifiers, no session-level data.
- Never forwarded, logged, or stored: sessionId, UA, device facts,
  breadcrumb history, guess/place content, coordinates, stack traces,
  IPs (the rate limiter keys by `CF-Connecting-IP` in memory only,
  never persisted).
- The client (`src/lib/observability.ts`) never collects guess/place
  content or coordinates in the first place.
