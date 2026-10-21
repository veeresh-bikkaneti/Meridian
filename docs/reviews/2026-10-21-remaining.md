# Remaining review items: hardening pass (2026-10-21)

Branch: `fix/review-remaining-hardening`, stacked on
`fix/review-p0-p2-kids-privacy-ux` (PR #207, head `e361937`). No PR yet:
it gets rebased or merged onto `main` after #207 lands.

Source: the original review (`TECHNICAL_REPORT.md`, 2026-10-21) and the
"Remaining" section of `docs/reviews/2026-10-21-p0-p2-remediation.md`.
Each item was checked against the code on #207 and on the stacked P3
branch (`fix/review-p3-hardening`, local) before any work started.

Legend: **Done** = changed on this branch. **Covered** = already handled
on #207, #203 (merged), or P3. **Deferred** = assessed only, with a
recommendation.

## Status

| ID | Finding | Status | Where |
| --- | --- | --- | --- |
| S4 | Crash-report worker accepts any origin | **Done** | `workers/crash-report/src/index.ts` |
| S3 | Client accepts any https `observabilityEndpoint` | **Done** | `src/lib/flags.ts`, `scripts/crash-watchdog.mjs`, `scripts/crash-smoke.mjs` |
| S5 | `GET /_serverFn/` → unhandled 500 | **Done** | `src/server.ts`, `src/lib/server/server-fn-guard.ts` |
| R7 | No `security.txt`, no sitemap, empty robots | **Done** | `public/.well-known/security.txt`, `public/robots.txt`, `public/sitemap.xml` |
| S10 | Dead `meridian_session` / `waymark_session` cookie config | **Done** | `src/game/brand.ts` |
| P6 | Ko-fi prompt behind a plain Continue | **Done** | `src/components/grandpa-coffee-run.tsx` |
| CI | No Playwright e2e in CI | **Done** | `.github/workflows/node.js.yml`, `playwright.config.ts` |
| S1 | No security headers | Covered (#207) | `src/lib/security-headers.ts`, `src/start.ts`, `public/_headers` |
| S2 | Inline scripts force `'unsafe-inline'` | Covered (#207 removed GA/Clarity; P3 hashes the static shell) | P3 branch; the worker SSR still needs a nonce (see P3 doc) |
| S6 | No HSTS | Covered (#207) | `Strict-Transport-Security` in `SECURITY_HEADERS` |
| S7–S9, S11 | Info / positives | No action | — |
| P1, P2 | Clarity, GA4 | Covered (#207, removed) | — |
| P3 | No privacy notice | Covered (#207) | `/privacy` |
| P4 | Crash telemetry fingerprint-ish fields | Covered (#207, coarsened) | `src/lib/observability.ts`, watchdog |
| R1 | PWA base path | Covered (#207) | manifest, `sw.js` |
| R2 | Hashed assets not immutable | Covered (#203, merged) | `public/_headers` |
| R5 | build-meta / SW stamping in the Workers pipeline | Covered (`postbuild` runs `fingerprint-sw.mjs` for `npm run build` too) | `package.json` |
| R3 | Heavy payloads | **Deferred** | see below |
| R4 | Slow TTFB on `/` | **Deferred** | see below |
| P5 | Esri tiles: licensing and child IPs | **Deferred** (owner decision) | see below |
| P7 | On-device AI story text | **Deferred** (owner decision) | see below |
| — | Easy pool lacks big world cities | **Deferred** (content work) | see below |

## Done on this branch

### S4: crash-report worker (`meridian-crash-report`)

Found already in place: schema validation (types and caps on the known
fields), an 8 KB `Content-Length` check, and an in-memory per-IP limit of
10 per minute. Missing: an Origin check (it answered with `ACAO: *`), a
streamed size cap (a chunked body was buffered whole), validation of
extra fields, and a limit shared across isolates.

- **Origin allowlist** (`ALLOWED_ORIGINS`): exactly
  `https://meridian.knowledgetest.workers.dev` and
  `https://veeresh-bikkaneti.github.io`. No wildcards: previews and forks
  are refused on purpose.
  - `OPTIONS` from an allowed origin → 204 echoing that origin with
    `Vary: Origin`. Otherwise → 403 with no CORS headers.
  - `POST` without an allowed Origin → 403, and nothing is forwarded or
    counted.
  - Responses echo the origin, never `*`. `/health` has no CORS headers.
- **`sendBeacon` keeps working.** The app beacons a string, which is sent
  as `text/plain`, a CORS-safelisted type, so the browser does not
  preflight. Browsers still attach `Origin` to every cross-origin POST,
  beacons included, so the check holds. The body is read as text whatever
  its content-type. The app's `fetch` fallback and the boot watchdog's XHR
  send `application/json`, which is preflighted and covered by the
  `OPTIONS` path. A unit test posts a `text/plain` beacon-style body from
  the Pages origin, and the e2e `observability.spec.ts` drives the real
  beacon path.
- **Size cap:** `readBodyCapped()` stream-reads and cancels at 8 KB. The
  limit stays 8 KB, not 4 KB, because the inline watchdog's boot_failure
  report is capped at 8 KB (`F=8192`). The app's own events are 4 KB.
- **Schema:** the device bucket fields are typed (`os`, `form`, `screen` ≤
  24 chars, `dpr` / `screenW` / `screenH` numbers, `webgl1` / `webgl2`
  booleans, legacy `ua` ≤ 300). `breadcrumb.history` has at most 32
  entries. Unknown top-level fields must be short primitives, and an event
  has at most 24 fields. `ts` must be between 2020-01-01 and one day
  ahead.
- **Rate limiting** follows the same OOD pattern as the contact form:
  `IngestRateLimiter` with `InMemoryRateLimiter`, `BindingRateLimiter` and
  `LayeredRateLimiter`, chosen by `selectRateLimiter(env)`.
  - The in-memory layer now keys on a salted hash, so the raw IP is never
    held. The salt is created on first use, because Workers forbid random
    values at global scope.
  - `CRASH_RATE_LIMITER` (Workers Rate Limiting binding, free) adds a
    limit shared across isolates. Its key is a daily-rotating SHA-256
    pseudonym of the IP. A missing, malformed or throwing binding fails
    open to the in-memory floor.
  - Config record: `workers/crash-report/wrangler.toml`, namespace `72073`,
    10 per 60 s.
- Tests: 42 worker tests (33 before), including the CORS and Origin
  matrix, the beacon path, mid-stream cancel, schema rejects, the binding
  key and its refusal, fail-open, and the wrangler record.

### S3: pinned ingest host

`isValidObservabilityEndpoint()` now accepts a root-relative path (same
origin as `flags.json` itself) or an https URL whose hostname is in
`OBSERVABILITY_INGEST_HOSTS`, an exact match currently limited to
`meridian-crash-report.knowledgetest.workers.dev`. Look-alike prefixes and
suffixes and http are rejected, failing closed to "no endpoint".

The contact endpoint keeps the plain shape check (`isValidEndpointShape`),
since it points at `/api/contact`, not at the crash host.

The inline boot watchdog cannot import TS, so it carries its own copy of
the list, passed into the script at render. A drift test compares it with
`flags.ts`. `scripts/crash-smoke.mjs` applies the same pin and now sends
an Origin header (needed after S4).

Byte budget: the watchdog must stay within 5120 bytes. It is at
5118 bytes for a 10-character build id and 5116 for a 7-character git sha. To
fit the host list, the minifier now folds adjacent `"…"+"…"` literals and
drops the space in `return !1`, a few long locals were renamed, and
`indexOf()===-1` became `<0`. The next change to the watchdog will need to
find bytes, or the owner can raise the budget.

E2E specs (`observability`, `crash-watchdog`) now use the real ingest URL,
intercepted by `context.route`, so no request leaves the test.

### S5: `/_serverFn/`

TanStack Start throws for a bare `/_serverFn/` before any request
middleware runs, so `src/start.ts` cannot catch it. The build's
server-function manifest is empty: the only `createServerFn` is the
platform connector scaffold in `src/lib/app-data`, which no app code
imports.

A new server entry, `src/server.ts`, is TanStack's default entry plus
`ServerFnGuard`:

- bare base → 404
- any method other than GET/POST → 405 with `Allow: GET, POST`
- any function id while `SERVER_FUNCTIONS_IN_USE` is false → 404

All other requests, and real server-function calls once the flag is
true, go to the unchanged TanStack handler. The CSRF and security-header
middleware in `src/start.ts` therefore still run. Guard responses get the
same security headers directly.

A unit test scans `src/` and fails if app code starts using server
functions while the flag is still false.

Verified with `vite build` + `vite preview`:

- `GET`/`POST /_serverFn/` and `/_serverFn/abc` → `404 {"error":"not found"}`, with the security headers.
- `PUT` → 405.
- `/` → 200.
- `/api/contact` unchanged (403 with no Origin).

### R7: discovery files

- `/.well-known/security.txt` (RFC 9116):
  - `Contact: https://meridian.knowledgetest.workers.dev/contact`, no
    email, per the owner's no-email ruling.
  - `Expires: 2027-10-01T00:00:00.000Z`. A test fails once it passes, or
    if it is ever set more than a year out.
  - `Canonical` and `Preferred-Languages: en`.
  - Note: `/contact` only works once `contactEndpoint` is switched on in
    `flags.json` (#207 deploy step). Until then, reporters see "not
    switched on yet". A second `Contact:` for GitHub private
    vulnerability reporting
    (`https://github.com/veeresh-bikkaneti/Meridian/security/advisories/new`)
    would work today. That is the owner's call.
- `robots.txt`: allow all, with a `Sitemap:` line. Cloudflare may still
  prepend its managed content-signals block.
- `sitemap.xml`: `/`, `/privacy`, `/contact`. A test checks that every
  page route in `src/routes/` is listed.
- All three are static assets, so they get the `_headers` security
  headers. On GitHub Pages they sit under `/Meridian/`, so crawlers ignore
  them there, which is harmless.

### S10: cookie config

Removed `cookie` and `legacyCookies` from `BRAND`, which nothing read or
wrote. `brand.test.ts` keeps cookie names from coming back. (`storageKey`
and `legacyStorageKeys` are also unreferenced today, but they are storage
keys, not cookies. They were left alone as out of scope.)

### P6: Ko-fi behind the grown-up gate

The cloud's Continue no longer calls `window.open`. It opens the same
arithmetic `GrownUpGate` that guards `/contact` and the age settings: a
two-digit multiplication, three strikes, a 60 s cooldown, and strikes
that persist across close/reopen. Only `onPass` opens Ko-fi.

- × in the gate cancels, the cloud reverts, and nothing opens.
- The gate is portaled to `<body>`, because the cloud lives inside
  animated, transformed ancestors where `position: fixed` would not cover
  the viewport.
- The click on "Check answer" is the user activation `window.open`
  needs.

E2E:

- The four existing Continue flows (`grandpa-coffee-run`,
  `kofi-persistent-cloud` ×2, `grandpa-tasting-tour`) now assert that
  nothing opened before the gate, then pass it with the new helper
  `passGrownUpGate()`.
- A new test shows that a wrong answer, or ×, keeps the child in
  Meridian.

### CI: Playwright in GitHub Actions

`playwright.config.ts` picks the browser in this order:

1. `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
2. `/opt/meta-chromium/chrome`, when it exists (this VM)
3. Playwright's bundled Chromium

`node.js.yml` gains an `e2e` job on `ubuntu-24.04`:

- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm run build:pages`
- Three stable specs: `grownups-privacy-contact`, `hydration-boot`,
  `observability`. None of them needs WebGL map clicks or Ko-fi.
- The report is uploaded on failure.

Specs that need map taps fail in headless Chromium without a GPU (the
`difficulty-picker` tier tests fail identically on unmodified `main` in
this VM), so they stay out of CI.

The job has not been run yet: this branch has no PR, so Actions does not
trigger. It will run on the first PR or push to `main`.

## Deferred, with recommendations

### R3: bundle and `names.json` size

**Recommendation: shard `names.json` by normalized-name prefix in a
follow-up. Not urgent.**

- Partly covered: #203 moved MapLibre, Loop and Trail behind `React.lazy`
  and deferred the TopoJSON, cutting the initial preload transfer by 64%.
- `loop/names.json` (11.5 MB raw, ~3.25 MB brotli) is already lazy. It is
  fetched only when the GeoDetective guess input first needs it
  (`src/game/loop/evaluate.ts`), and is never in the main bundle.
- The remaining cost lands on kids who open GeoDetective on slow or
  metered connections.
- The fix: shard by the first two characters of the normalized name
  (about 700 files of a few KB each) or a compact binary index, built in
  `scripts/build-loop.mjs`, with the SW precaching the shards used.
- The globe tier files (`globe-t3`/`t4`, ~4 MB raw each) could use
  quantized coordinates.
- Both are pipeline changes with their own tests. Sizing first:
  `npm run perf:bundle`.

### R4: SSR TTFB on `/`

**Recommendation: serve the root shell as a static asset, not
worker-rendered. Next step: a small spike to confirm which option works.**

- `/` is `ssr: false`, so the worker renders a near-static stub on every
  request (2–3.6 s TTFB measured in the review).
- Two free options:
  - Serve the prerendered `_shell.html` as the asset for `/`, with the
    worker only for `/api/*`.
  - Wrap the new `src/server.ts` with a Cache API lookup for `GET /`
    (60 s, keyed by build id).
- Either needs care:
  - The SSR dehydration script carries a per-request timestamp.
  - The security headers must still apply.
  - The P3 static CSP hashes already cover `_shell.html`, so the first
    option also lets `/` drop `'unsafe-inline'` for scripts. That makes
    it the better choice.

### P5: Esri World Imagery tiles

**Recommendation: owner decision. Prefer the free ArcGIS Location
Platform tier with a referrer-restricted key, or a worker tile proxy if
hiding child IPs matters more than worker CPU.**

- The map uses Esri's keyless `server.arcgisonline.com` endpoint.
  Attribution is shown and `/privacy` (#207) discloses Esri.
- Esri's terms for production use of the basemap generally expect an
  ArcGIS account and API key. ArcGIS Location Platform has a free monthly
  basemap tier, but check the current terms and quota before relying on
  it.
- A worker tile proxy (cache through the Cache API) would also hide
  children's IPs from Esri. It costs worker requests on the free plan
  (100k/day), and tile traffic could exceed that, so it needs a sizing
  check first.
- Free imagery alternatives exist with their own licence terms, for
  example EOX Sentinel-2 cloudless, which is CC BY-NC-SA (non-commercial).
- Not changed here: it is a licensing decision, not code.

### P7: on-device AI story text

**Recommendation: owner decision. Lean toward turning the runtime
fallback off by default for kids, or behind a flag.**

- `src/game/story-ai.ts` asks Chrome's on-device model for one story
  sentence, only for generated places with no build-time fact or history
  hook.
- Replies are validated: length, banned patterns, grounding against the
  source extract, scope and hedging checks. They are cached per device
  for 180 days. Sports-team lookups are checked against known team
  lists.
- The safer long-term path is the one the review suggests: generate and
  human-review these sentences in the build-time facts ladder (which
  already exists), and drop the runtime model.
- An interim, low-risk step: a `flags.json` kill switch (default off)
  around `useAiStory`.

### Easy pool: big world cities

**Recommendation: a content PR that adds history hooks for a curated
list of major cities, with the existing pool tests extended.**

- Easy curation (#207, `src/game/easy-curation.ts`) uses only places with
  history hooks, and falls back by rung (min pool 25).
- Cities such as Lagos and Moscow are absent because the Globe tier files
  lack them or they have no hook.
- The fix is content, not code: add fact-ladder or history hooks for
  about 50 world capitals and megacities, balanced across continents
  (the review also flagged the US/Nebraska skew), with sources.
  `easy-curation.test.ts` would assert the continental spread.

## Owner deploy steps (this branch)

1. **`meridian-crash-report` (API upload, not Workers Builds):**
   - Redeploy the worker so S4 is live. Follow the README "Deploy"
     section: `tsc` emit, then `cf.py deploy`, then re-set
     `DISCORD_WEBHOOK_URL`.
   - Keep the KV binding in the version metadata.
   - Optional and free: add the rate-limit binding to
     `metadata.bindings`:
     `{ "type": "ratelimit", "name": "CRASH_RATE_LIMITER", "namespace_id": "72073", "simple": { "limit": 10, "period": 60 } }`.
     Without it, the in-memory limiter applies, as before.
   - Deploy order: there is no client change that depends on the worker,
     and today's app already sends Origin. You can deploy the worker
     before or after the site.
   - Verify:
     - `curl -i -X POST https://meridian-crash-report.knowledgetest.workers.dev/ingest -d '{}'`
       → 403 (no Origin).
     - `node scripts/crash-smoke.mjs <worker> https://meridian.knowledgetest.workers.dev`
       → passes (it sends Origin).
2. **`meridian`:** the normal Workers Builds deploy after merge. Verify:
   - `curl -i https://meridian.knowledgetest.workers.dev/_serverFn/` → 404
   - `/.well-known/security.txt` → 200
   - `/robots.txt` and `/sitemap.xml` → 200
3. **Before 2027-10-01:** renew `Expires` in `security.txt`. CI fails
   once it lapses.
4. **CI:** the new `e2e` job runs automatically on the first PR. If
   ubuntu runners turn out flaky for any of the three specs, drop that
   spec from the job rather than adding retries.
