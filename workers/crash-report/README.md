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
- **conditional** — `recovery_outcome`: crash-class **only** when its
  `recoveryOutcome` field is `repeat_failure`; every other value (and
  a missing or invalid one) is counted only, never forwarded on its
  own. See the Verdict section — this type is how the app reports
  whether a self-recovery attempt worked.

Every accepted event is also **counted** into per-hour buckets in a
Workers KV namespace (`TELEMETRY_COUNTS`): one KV key per UTC
hour × type, with buildId × edition × region × os/form device-bucket
breakdowns inside the bucket value — **counts only**, no payloads,
no identifiers.

## Relationship to `worker/observability/` (v1)

The v1 worker is the older **logging-only** receiver: it validates events
and writes one structured JSON log line per event (read via
`wrangler tail`). This worker lives in a **new directory on purpose** —
the old one is untouched. It accepts the same schema and forwards
alerts instead of logging the full event. Against v1's five types,
this worker adds `boot_failure`, `tile_failed`, and
`recovery_outcome`.

Deploy **one** of them as the `observabilityEndpoint` target, not both.

## Files

- `src/index.ts` — zero-runtime-dependency Worker. `handleRequest(request,
env)` is exported pure for tests; the default export wires it as `fetch`
plus a `scheduled` handler for the hourly digest.
- `src/index.test.ts` — the unit suite (85 tests; run it with
  `npm run test:worker` from the repo root — see Tests).
- `src/dev-entry.ts` — local-dev wrapper for `wrangler dev` only:
  it re-exports just the default handler, because workerd rejects
  `index.ts`'s test-only named exports (plain constants) as handler
  candidates (#234). Production never uses it — a release bundles
  `src/index.ts` directly.
- `wrangler.toml` — the **human config record**: worker name, entry
  point, compatibility date, the hourly cron trigger, and the
  `TELEMETRY_COUNTS` KV binding block. The deploy path never reads
  this file (see Deploy) — the KV namespace exists (created
  2026-10-21), and the uncommented `[[kv_namespaces]]` block
  carrying the real namespace id is on `main` (PR #204).
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
  When at least one forwarder is actually attempted (a crash-class
  event with Discord and/or email configured), the response also
  carries a per-channel `results` object, e.g.
  `{"ok":true,"forwarded":true,"counted":true,"results":{"discord":true,"email":false}}`.
  Read `forwarded:true` as "forwarding was attempted" — whether each
  channel succeeded is in `results`, not in `forwarded`. The
  no-attempt response has no `results` field at all.
- Headers that matter: ingest POSTs and preflights must carry an
  allow-listed `Origin` (below). The rate limiter keys on the
  platform-set `CF-Connecting-IP` header (a missing one is treated
  as the shared key `"unknown"`). A declared `Content-Length` over
  the body cap is refused before the body is read. `Content-Type`
  is **not** enforced — the body is read as text whatever it says,
  which is what lets `navigator.sendBeacon` (`text/plain`) work.
  JSON responses carry `content-type: application/json`; ingest
  responses also carry `Vary: Origin` (and the CORS echo below).
- Cron (`15 * * * *`, the `scheduled` handler) → posts the **hourly
  digest** to Discord: one compact message per hour summarizing the
  PREVIOUS UTC hour. Zero events → nothing posted (silence is the
  healthy signal).
- **Origin allowlist (review S4, 2026-10-21):** ingest POSTs must carry
  `Origin: https://meridian.knowledgetest.workers.dev` or
  `Origin: https://veeresh-bikkaneti.github.io` (`ALLOWED_ORIGINS` in
  `src/index.ts`). Anything else, or no Origin at all, gets `403`. Browsers
  send Origin on every cross-origin POST, `navigator.sendBeacon` included,
  so real reports are unaffected. `curl` tests must add
  `-H 'origin: https://meridian.knowledgetest.workers.dev'`.
- Rate limit: **10 requests / 60 s** per client → `429` with a
  `Retry-After` header. Two layers:
  - always: an in-memory, per-isolate fixed window keyed by a salted hash of
    `CF-Connecting-IP` (the raw IP is never kept);
  - when bound: the free **Workers Rate Limiting** binding
    `CRASH_RATE_LIMITER`, which counts across isolates in a Cloudflare
    location. Its key is a daily-rotating hash of the IP. If the binding
    is missing, malformed, or throws, it fails open and the in-memory layer
    still applies.
- Body cap: **8 KB**, enforced while streaming (a chunked upload is
  cancelled at the cap, never buffered whole) → `413`. The app's own
  events are capped at 4 KB, and the boot watchdog's at 8 KB.
- Schema: the fields and caps in the Event schema section below.
- Forwarding is fire-and-collect via `Promise.allSettled`: one forwarder
  failing never fails the request. Each forwarder has a 5 s timeout.
- Log lines for an event carry only type/buildId/edition (operational
  lines add things like a forwarder's HTTP status or per-channel
  result booleans) — never PII, never the forwarded secrets, never
  full payloads.
- CORS: `OPTIONS` from an allow-listed origin → `204`, echoing that
  origin in `access-control-allow-origin` with `Vary: Origin`, plus
  `access-control-allow-methods: POST, OPTIONS`,
  `access-control-allow-headers: content-type`, and
  `access-control-max-age: 86400`. Any other origin, or none, → `403`
  with no CORS headers, so the browser never sends
  the POST. Responses to allowed POSTs echo the origin, never `*`.
  `/health` carries no CORS headers (it is for curl and monitors).

### Responses and errors

Every error body is JSON: `{"error": "<message>"}` — plus a
`problems` list on a schema failure. The worker never returns a
500 for a client error.

| Status | When | Body |
|---|---|---|
| `200` | Event accepted (forwarded or not) | `{"ok":true,"forwarded":…,"counted":…}` (+ `results` when forwarding was attempted — see above) |
| `200` | `GET /health` | `{"ok":true}` |
| `204` | CORS preflight from an allowed origin | *(empty)* |
| `400` | Body is not valid JSON | `{"error":"invalid JSON"}` |
| `400` | Event fails the schema | `{"error":"invalid event","problems":["…", …]}` — one human-readable string per problem |
| `403` | POST or preflight with a missing or non-allow-listed `Origin` | `{"error":"origin not allowed"}` (preflight: empty body, no CORS headers) |
| `404` | Any path other than `/`, `/ingest`, `/health` | `{"error":"not found"}` |
| `405` | Non-POST on `/` or `/ingest`; non-GET on `/health` | `{"error":"method not allowed"}` |
| `413` | Body over 8 KB (declared or streamed) | `{"error":"body too large"}` |
| `429` | Rate limit (10 / 60 s per client) | `{"error":"rate limit exceeded"}` + a `Retry-After` header (seconds) |

### Event schema

`validateEvent` in `src/index.ts` is the authority; this table is
what it enforces today. Anything that breaks a rule below gets a
`400` — it is never trimmed or guessed at.

| Field | Required? | Rule |
|---|---|---|
| `type` | yes | One of the 8 accepted types (see Counting, below, for the canonical list) |
| `ts` | yes | Finite number, epoch ms, between 2020-01-01 and one day in the future |
| `buildId` | yes | Non-empty string, ≤ 64 chars |
| `sessionId` | no | String ≤ 64 chars. Validated, but never forwarded, logged, or stored |
| `edition`, `regionId`, `chunkId`, `lastMilestone` | no | Strings ≤ 128 chars each |
| `error` | no | Object with `name` ≤ 80 chars and `message` ≤ 300 chars (both required if `error` is present) |
| `device`, `breadcrumb.device` | no | Object, ≤ 16 fields: `os`/`form`/`screen` strings ≤ 24 chars, `dpr`/`screenW`/`screenH` finite numbers, `webgl1`/`webgl2` booleans, legacy `ua` string ≤ 300 chars; any other key must hold a short primitive and be ≤ 32 chars |
| `breadcrumb` | no | Object; `breadcrumb.history` is an array of ≤ 32 entries |
| `bgTerminal`, `buildReplaced`, `trailStuck` | no | Booleans — the verdict evidence stamps (see Verdict) |
| `lcV` | no | String — the client's classifier logic version, stamped on every event |
| `recoveryOutcome` | no | String — the outcome value for `recovery_outcome` events (see Verdict) |
| anything else | no | Extra top-level fields are allowed only as short primitives: string ≤ 256 chars, finite number, boolean, or null, with a key ≤ 64 chars. At most 24 top-level fields in total |

The client also stamps fields the worker deliberately does **not**
act on: `mapMode`, `storageOk`, `afterRecovery`, and a provisional
`verdict` / `whyKey`. They pass validation as extra primitives
above; the worker re-derives the verdict itself and never reads
the client's stamp (see Verdict).

## Severity tiers

| Tier | Types | Behavior |
|---|---|---|
| crash-class | `suspected_crash`, `boot_failure`, `js_error`, `unhandled_rejection`, `map_error` | Forwarded to Discord/email **immediately**; also counted. |
| hiccup-class | `tile_failed`, `webgl_context_lost` | **Counted only** — no individual forward. Surfaced via the threshold alert and the hourly digest. |
| conditional | `recovery_outcome` | Crash-class **only** when `recoveryOutcome` is `repeat_failure`; every other value (or a missing/invalid one) is counted only. |

Rationale: hiccup-class events are resource signals that are usually
benign/transient in production (`tile_failed` fires on ordinary tile CDN
hiccups; `webgl_context_lost` fires when a mobile OS reclaims the GPU
context on backgrounding). Forwarding each one as a 🚨 trained readers
to ignore the channel — the threshold alert and digest restore the
signal-to-noise ratio. Crash-class events are unaffected by the
tiering: same immediate alert, same no-op mode when no forwarding
secrets are configured. (The alert's format itself later gained
the verdict line — see Verdict.)

## Verdict (the first line of every forwarded alert)

The worker does not just pass a crash report along — it classifies
it. The client stamps the evidence facts onto the event
(`bgTerminal`, `buildReplaced`, `trailStuck`, `lcV`, and for
`recovery_outcome` events the `recoveryOutcome` value); the worker
re-derives a verdict from those facts at ingest (`classifyCrashVerdict`
in `src/index.ts`) and renders **its own** derivation. A verdict the
client stamped is never read or trusted — it is only a cross-check.

| Verdict | Headline on the alert | Means |
|---|---|---|
| `not_a_real_issue` | ✅ IGNORE — No action needed | The pattern matches a harmless background close: app backgrounded, phone closed it, no error captured |
| `auto_fixed` | 🔧 IGNORE — Fixed itself (confirmed) | Only from `recovery_outcome` with `recoveryOutcome: confirmed` |
| `developer_needed` | 🚨 FIX — Developer action needed | A real error was captured, a foreground session died mid-game on the current build, or a recovery was followed by a repeat failure |
| `insufficient_evidence` | ❔ WAIT — Can't tell from this report | Anything else — including a report whose evidence stamps are missing (older builds). Missing evidence fails closed to here, never to "harmless" |

Under the headline, the alert carries a one-line plain-language
**why** (what the evidence shows, and its limit), an
`action: Read the error below.` line for `developer_needed` only,
then `type` · `build`, the coarse device bucket, `edition` ·
`region`, the last step in plain words (e.g. `game_loaded` reads
"playing — map on screen"), and the truncated error name/message.
Discord content is capped at 1500 characters. The email version
(subject `[Meridian] <headline> · <type> · build <buildId> ·
<edition>`) uses the same lines in a labelled list and adds the
event time (ISO). The `recovery_outcome` branch is classified
**first**, before the captured-error rule: `confirmed` →
`auto_fixed`; `repeat_failure` → `developer_needed`; `stood_down`,
`unconfirmed_closed`, `unconfirmed_died`, `unconfirmed_expired`,
and `marker_unreadable` → `insufficient_evidence` (each with its
own why-line).

## Threshold alert

The threshold check runs on **every** accepted event's bucket (not
just hiccup-class). When an event's count for the current UTC
hour crosses a threshold, the worker posts **one** Discord alert for
that type+hour — exactly one, even if the count keeps climbing
(and only when a Discord webhook is configured):

```
🚨 Meridian telemetry alert
type: tile_failed crossed the hiccup threshold (20/hour across builds)
hour: 2026-10-18T02 UTC · counts: 22 total (f331846 ×20, 50122c6 ×2)
one alert per type+hour — further events this hour only raise the counts
```

Defaults: **20 events/hour of one type across all builds**, or
**10/hour from a single buildId** — whichever trips first. Override
with the (optional, non-secret) env vars `TELEMETRY_THRESHOLD_PER_HOUR`
and `TELEMETRY_THRESHOLD_PER_BUILD` (positive ints; anything else falls
back to the defaults). They are config, not secrets — but there is
no `[vars]` block, so in production an override must ride as a
plain-text binding in the version-upload metadata, like the other
bindings in Deploy. Exact-once holds per isolate via a flag stored
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

Each type line shows the count plus the top 3 builds, top 2
editions, and top 2 device buckets. (Regions are counted in the
bucket but are not rendered in the digest.) A line is flagged **⚠️** when its count exceeds
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

Accepted `type` values (the canonical list — `EVENT_TYPES` in
`src/index.ts`): `suspected_crash`, `boot_failure`, `js_error`,
`unhandled_rejection`, `map_error`, `tile_failed`,
`webgl_context_lost`, `recovery_outcome`.
Required: `type`, `ts` (finite number, epoch ms), `buildId`
(non-empty string). Optional fields pass through (full caps in the
Event schema table above); the forwarded alert is built from type,
buildId, edition/region, lastMilestone, the coarse device bucket,
a truncated error name/message, and the verdict evidence stamps
(see Verdict).

## Tests

```sh
npm run test:worker        # 85 unit tests (validation, alert builder, rate limiter, CORS + Origin allowlist,
                           #  S4: streamed cap, schema, binding; Phase 1: tiering, counting, threshold, digest, fail-open;
                           #  Slice 1/2: verdict classifier, recovery_outcome tiering and alert format)
npm run typecheck:worker   # strict tsc on the worker sources
```

Both run in CI (`.github/workflows/node.js.yml`). The Phase 1 tests run
the pure handlers against an in-memory store — **no live Cloudflare
calls**: KV, Discord, and Resend are all mocked or absent, including a
"KV down" case that proves the ingest path stays 200 and crash-class
forwards still fire.

## Deploy

This worker has **only ever been deployed by manual API version
upload** — every deployment in the Cloudflare API history is
`source: api`, `triggered_by: upload` (ground truth API-verified
2026-10-21). `wrangler deploy` was never the mechanism; do not use
it for releases (wrangler remains fine for local dev — see the
dry-run below).

Why the version upload matters: bindings ride **with** the version
upload. A version that must carry the `DISCORD_WEBHOOK_URL` secret
or the `TELEMETRY_COUNTS` KV binding gets them in its upload
metadata. There is no "upload first, set the secret afterwards"
step — naming a secret without a value is rejected (error 10021),
and a script-level secret PUT is blocked (error 10215).

Two tools do the work:

- **`cf-version.py`** — the ops helper for versions and
  deployments (verbs: `list`, `get`, `deployments`, `deploy`). It
  lives **outside this repo**, with the crash-report watchdog
  goal's ops files. **Off that setup** there is no cf-version.py:
  use the Cloudflare dashboard, or the same API endpoints with
  your own API token, instead.
- **The TypeScript compiler** already in this repo's root
  dependencies. `src/index.ts` is a single self-contained module
  (no imports, no runtime dependencies), so the "bundle" is one
  `tsc` emit — there is no bundler step and no build script.

### The release, step by step

```sh
# 1. Bundle src/index.ts into a single JS module (from the repo root).
#    Tested on this VM: this produces exactly one file,
#    dist-worker/index.js, and the emitted module answers
#    /health with 200 {"ok":true}.
npx tsc workers/crash-report/src/index.ts --outDir dist-worker \
  --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

# 2. Upload a new version whose upload metadata carries the
#    bindings (see Secrets below for the full list). The secret
#    goes in WITH its value — there is no later step that adds it:
#      - DISCORD_WEBHOOK_URL: { "type": "secret_text",
#          "name": "DISCORD_WEBHOOK_URL", "text": "<value>" }
#      - TELEMETRY_COUNTS:    { "type": "kv_namespace",
#          "name": "TELEMETRY_COUNTS",
#          "namespace_id": "34884ed9aa46437f871278a517882e72" }
#      - CRASH_RATE_LIMITER (optional): see the next section.
#    Versions and deployments are managed with cf-version.py
#    (verbs: list, get, deployments, deploy), which lives outside
#    this repo with the crash-report watchdog goal's ops files.
#
# 3. Deploy that version, then verify BOTH checks:
curl https://meridian-crash-report.knowledgetest.workers.dev/health   # → {"ok":true}
#    …and a counted ingest — send one event with an allowed Origin
#    (see Behavior) and check the reply says "counted":true.
#    /health alone is NOT enough: it stays 200 on a blind version
#    (one uploaded without the bindings above).
```

> ⚠️ **Warning:** followed literally, the old instructions produce
> a live version with `TELEMETRY_COUNTS` unbound and
> `DISCORD_WEBHOOK_URL` absent — crash reporting silently blind
> while `/health` stays 200. A bare script upload (an upload whose
> metadata carries no bindings) produces exactly that blind version: a
> version without bindings and triggers. Always upload a version
> whose metadata carries the bindings, then deploy that version.

### Rate-limit binding (review S4, optional, free)

`wrangler.toml` records a `[[ratelimits]]` binding named
`CRASH_RATE_LIMITER` (namespace `72073`, 10 per 60 s). The Workers Rate
Limiting API has no plan gate and no billing line in Cloudflare's docs
(checked 2026-10-21). Like the KV binding, it only exists on a version
whose upload metadata carries it. In the API upload, add this to
`metadata.bindings`, next to the KV binding:

```json
{ "type": "ratelimit", "name": "CRASH_RATE_LIMITER", "namespace_id": "72073",
  "simple": { "limit": 10, "period": 60 } }
```

Without it, the worker runs on the in-memory limiter alone, which is the
behavior before S4. Nothing breaks.

### What a bare script upload does NOT carry: bindings and triggers

Bindings and cron triggers are **version metadata on the upload**,
not properties of the script file. A bare script upload sends
neither — which is why releases use the version-upload flow above,
never a bare upload. Two consequences:

- **KV binding (`TELEMETRY_COUNTS`).** The Phase 1 version was
  uploaded through the API version-upload path **with the binding
  in its upload metadata**, and counting was probe-verified live
  (2026-10-21). A bare script upload produces a version **without**
  the binding — the worker then runs counting-free (fail-open, by
  design). `wrangler.toml`'s role is the **human config record** of
  the intended setup. Keep the three states separate:
  - *Namespace created* — **done** 2026-10-21 via the API
    (id `34884ed9aa46437f871278a517882e72`).
  - *Binding recorded* — the uncommented `[[kv_namespaces]]` block
    carrying the real namespace id is on `main` (PR #204).
  - *Phase 1 live* — **done** 2026-10-21 (deployment `9bd9f669`,
    version `e3dc6b3b`); the live version carries the webhook as a
    secret binding in the upload, plus the KV binding.
- **Cron (`15 * * * *`).** The schedule was set once, on
  2026-10-21, through the Workers **schedules endpoint**
  (`PUT /accounts/{id}/workers/scripts/meridian-crash-report/schedules`),
  not by any deploy step, and it persists across uploads. Phase 1
  code (which has the `scheduled` handler) is the live version
  now, so the schedule is active. `wrangler.toml`'s `[triggers]`
  block is the record of it.

**Owner step — deploying a new version, in this order** (the
worker's live deploy is a repo-owner step):

1. Upload a fresh version carrying the bindings in its metadata
   (the `DISCORD_WEBHOOK_URL` secret **with its value**, and the
   `TELEMETRY_COUNTS` KV binding — see step 2 of the release
   above), then deploy that version. There is no re-supply step
   after the upload: the value travels with the version.
2. Verify: check `/health` **and** send one `tile_failed` event —
   it must be counted and NOT forwarded individually
   (`{"ok":true,"forwarded":false,"counted":true}`); the next
   hourly digest should include it. (`counted:true` requires the
   live version to carry the KV binding — after a bare script
   upload, expect `counted:false`, and `/health` will still say
   200.) The production endpoint already set in
   `public/flags.json` does not change.

**Rollback:** re-upload the previous worker version's script
(Cloudflare version history) or `git revert` + re-upload — hiccup-class events then resume
individual forwarding, exactly the pre-Phase-1 behavior. The KV
buckets are inert hour-keyed counters: they need no cleanup and can
stay bound.

Dry-run before deploy (catches validation mistakes locally): the
unit suite (`npm run test:worker`, from the repo root) exercises
the pure handlers with KV, Discord, and Resend mocked — no install
and no live calls. If you have wrangler available (it is this
directory's pinned devDependency; `npm install` in this directory
fetches it), a full local run also works:

```sh
npx wrangler dev -c wrangler.toml
curl -X POST localhost:8787/ingest -H 'content-type: application/json' \
  -H 'origin: https://meridian.knowledgetest.workers.dev' \
  -d '{"type":"suspected_crash","ts":1728300000000,"buildId":"test","edition":"globe","lastMilestone":"boot_ready"}'
# → {"ok":true,"forwarded":false,"counted":true}
#   (no secrets in dev = nothing is forwarded; counted:true because
#   wrangler.toml binds TELEMETRY_COUNTS locally — expect
#   "counted":false instead if that binding is ever absent)
```

## Secrets

> **Separation rule (2026-10-21):** these secrets belong to the crash
> pipeline only. The grown-ups contact form is the `/api/contact` route
> on the main `meridian` worker (`src/routes/api/contact.ts`). It has its
> own secret on that worker, `CONTACT_DISCORD_WEBHOOK_URL`, pointing at a
> different Discord channel. Never set `DISCORD_WEBHOOK_URL` on `meridian`
> for contact, and never route contact messages through this worker.

Secrets are **not** set in a separate step after an upload. They
travel **with** the version upload: each secret the version needs
goes into the upload metadata as a `secret_text` binding **with
its value**. Why: a new version cannot inherit a secret by naming
it — a value-less `secret_text` binding is rejected (**error
10021**) — and a script-level secret PUT is blocked (**error
10215**), so there is no working "set the secret afterwards" step.
The stored value also cannot be read back from the platform, so
only the owner, who holds the values, can supply them in the
upload.

The bindings the upload metadata must carry:

```json
{ "type": "secret_text", "name": "DISCORD_WEBHOOK_URL", "text": "<value>" }
```

Optional, same form, if email forwarding is wanted:
`RESEND_API_KEY` (https://resend.com/api-keys), `REPORT_EMAIL`
(the recipient), and `REPORT_FROM` (a verified sender; the
default is `Meridian Crash Reporter <onboarding@resend.dev>`,
Resend's test-domain sender).
`DISCORD_WEBHOOK_URL` itself comes from Discord: Server Settings
→ Integrations → Webhooks.

Remember: every new version needs the secret in its own upload
metadata, with the value. Leave it out and forwarding silently
stops while `/health` stays green — that is the blind-version
failure the Deploy warning describes.

Discord and email are independent: configure either or both. With
neither set, the worker accepts and acknowledges events without
forwarding (`"forwarded":false`), so it is safe to deploy **before**
secrets exist.

## Go-live — DONE (worker live by API upload; pipeline verified 2026-10-10)

The worker is live at `meridian-crash-report.knowledgetest.workers.dev`
and `public/flags.json` on main points `observabilityEndpoint` at its
`/ingest`. It got there by the API version-upload flow in Deploy
above. Phase 1 went live on 2026-10-21 (deployment `9bd9f669`,
version `e3dc6b3b`); the live version carries the webhook as a
secret binding in the upload, plus the KV binding. The
Game → Worker → Discord pipeline was verified live on 2026-10-10.
(An earlier version of this section dated go-live 2026-10-17; no
worker deployment happened that day — 2026-10-17 was the Phase 1
code merge, PR #171, on the flags/repo side.) The procedure below
is what was run:

1. Upload a version whose metadata carries the bindings (the
   `DISCORD_WEBHOOK_URL` secret with its value, and the
   `TELEMETRY_COUNTS` KV binding — see Deploy and Secrets above),
   deploy that version, and verify `/health` **and** a counted
   `/ingest` (`"counted":true`). `/health` alone stays green on a
   blind version.
2. Add the Worker URL as the **top-level** `observabilityEndpoint` in
   `public/flags.json` (NOT inside `flags`) and redeploy the site.
   The shape is:

```json
{
  "flags": { "learningOutcomes": true, "pwaUpdateToast": true },
  "version": 1,
  "observabilityEndpoint": "https://<your-worker-host>/ingest"
}
```

   That example shows the *shape* only — keep whatever flags and
   other top-level fields the file already carries; add the one
   field, change nothing else.

The field is set in production (see above); without it, the client
transport is a complete no-op (fail-closed). Do **not** commit the Worker URL into this repo's code —
`flags.json` is the only place it belongs.

## Staging vs production

**Not set up today** — this section describes the intended split,
which does not exist yet. Simplest reliable split, when it's
needed: deploy the same code twice under different names — e.g.
`meridian-crash-report-staging` (secrets point at a test Discord
channel / your own inbox) and `meridian-crash-report`
(production) — and point a staging flags deploy at the staging
worker. Note the ops helper (`cf-version.py`) is set up for the
production script name, so a staging upload would go through the
dashboard/API (or a copy of the helper with the name changed). Alternative: wrangler
environments (`[env.staging]`) — likewise not configured here; add
only if you outgrow the two-deploy approach.

## Volume-spike alerting

Crash-report volume is normally near zero; a spike usually means a bad
release, not abuse. The Workers free tier allows 100k requests/day —
more than enough headroom. Still, set up a Cloudflare notification
(Dashboards → Notifications → add: **Workers → Requests**) so an
unexpected flood (bug loop, someone replaying events) pages you before
it matters. The rate limiter caps any single client at 10/min, and
foreign origins are refused outright (S4).

## Privacy

- Alerts contain: the verdict headline/label and its why-line,
  type, buildId, edition/region, lastMilestone (in plain words),
  the coarse os/form device bucket, and a truncated error
  name/message. The email version also carries the event time.
  Nothing else.
- The Phase 1 counters contain: per-UTC-hour counts keyed by type,
  buildId, edition, region, and os/form device bucket. Counts only —
  no payloads, no identifiers, no session-level data.
- Never forwarded, logged, or stored: sessionId, raw UA, precise
  device facts (the coarse os/form bucket above is the only device
  data that ever leaves), breadcrumb history, guess/place content,
  coordinates, stack traces,
  IPs (the rate limiter keys by `CF-Connecting-IP` in memory only,
  never persisted).
- The client (`src/lib/observability.ts`) never collects guess/place
  content or coordinates in the first place.
