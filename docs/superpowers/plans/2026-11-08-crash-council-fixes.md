# Crash-report council fixes — implementation plan (2026-11-08)

> **For agentic workers:** executed inline (superpowers:executing-plans + test-driven-development). Steps use checkboxes.

**Goal:** repair the six existing-policy-safe defects the crash/health council found in the crash-report worker on PR #353 (`feat/crash-provenance-gate`), without new telemetry fields, identifiers, GPU/location collection, merges, or deploys.

**Architecture:** worker-only except one client change (error-text scrubbing inside the existing `sanitizeError`). Player reports keep the public `/ingest` lane; the trusted platform `scheduled()` handler is the only producer of ops health. Provenance is computed statelessly and never bypassed by KV state.

**Tech stack:** Cloudflare Workers (TypeScript, `node --experimental-strip-types --test`), KV (`TELEMETRY_COUNTS`), Discord webhook / Resend email (existing secrets, presence only).

## Global constraints (from owner + council)
- Owner word t287u: "Fix based on the council verdict." Fixing only — NO merge, deploy, delete, force-push, production telemetry, PR comments, routine edits, secret output.
- No new outbound client fields, no session identifiers in stored/logged/forwarded data, no GPU strings/limits, no colo/country/location, no stacks.
- No fake js_error probes; health is never inferred from absence of crash reports; browser health is never claimed from a server check.
- No exactly-once claims: dedupe is per-isolate / best-effort unless an atomic store exists (it does not).
- Do not delete historical KV data; readers stay backward compatible.
- Gates: npm ci · tsc --noEmit · typecheck:worker · build · npm test · test:worker · lint-cards (GATE PASSED) · build:pages (VITE_KOFI_URL dummy).

## Council finding → task matrix
| Council finding | Task | Code | Tests | Status |
|---|---|---|---|---|
| Rel V3/P1, Arch #6: URL query/fragment + tokens reach Discord | T1 | worker `scrubErrorText`, normalise + render; client `sanitizeError` | redaction suite, parity, legacy payload | planned |
| Rel §3.4: mentions/markdown in error text | T1 | Discord `allowed_mentions: {parse: []}` | payload assertion | planned |
| Arch #3, Dev "still open", Rel V1/A3: `!tele.counted` fail-open | T2 | remove bypass; per-isolate bounded uncorroborated summary | KV absent / throwing / concurrency / forged full shape | planned |
| Rel V2/A9: response oracle | T2 | stable `{ok:true}` body; outcome via test accessor + logs | body identical across outcomes | planned |
| Rel V6/A5: fire-and-forget without waitUntil; no delivery record | T3 | `fetch(req, env, ctx)`, `ctx.waitUntil`, 1 bounded retry, `ops:delivery:last` (TTL) | ctx spy, 429 retry once, outcome unknown≠ok | planned |
| Rel V4/A6: counters without TTL; count-map numeric guard | T4 | `expirationTtl` on every put; `numericRecord` on all maps | put-options spy, corrupted map read | planned |
| Dev §2.9, Arch #5: "app failed to start" for payload-less js_error | T5 | whyLine/priority wording + `failure(v1)` evidence line | golden text, no-claim tests | planned |
| Arch #4/#5, Rel A1/V5: static /health, vacuous healthy, KV readback | T6 | scheduled health run (separate cron, digest untouched); `/health` liveness + evidence summary; unknown on missing/stale/future/invalid | evaluator totality, freshness, ingress can't write health | planned |
| Arch #1/#2, Dev §3 v2 diag, Rel new fields | — | none | — | **deferred: needs owner schema-policy + AGENTS amendment** |
| Rel A2 independent watchdog | — | none (needs external monitor choice) | — | **deferred: owner decision** |
| Rel P2 sessionId ruling | — | none | — | **deferred: owner/panel ruling** |

## Tasks (each: failing test → run red → minimal code → run green → commit)

### T1 Privacy scrubbing
Files: `workers/crash-report/src/index.ts` (new `scrubErrorText`, `normaliseEvent` error block, `buildAlert`, `whyLineFor`, `recordTelemetry` errorNames, `forwardToDiscord` payload); `src/lib/observability.ts` (`sanitizeError`); tests in `workers/crash-report/src/index.test.ts` and `src/lib/observability.test.ts`.
Rules: URL → keep scheme/host/path, drop `?query` and `#fragment`; emails → `<email>`; UUID → `<id>`; hex runs ≥20 → `<id>`; mixed alnum token runs ≥32 with a digit → `<redacted>`; keep `file.js:12:34` and identifiers; bounded output (name 80, message 300 at intake, 140 in alerts). Error object keeps only `name`/`message` (drops stack/cause/nested).
Test: `npm run test:worker -- --test-name-pattern="P1"`; client `node --experimental-strip-types --test src/lib/observability.test.ts`.

### T2 KV-independent gate + bounded summary + stable body
Files: `index.ts` `handleRequest`; new `UncorroboratedSummary` (per-isolate, window 15 min, ≤1 summary/window/isolate, ≤32 distinct pattern keys then "other").
Test names: `T2 KV absent: probe 0 individual pages`, `T2 KV throws: ...`, `T2 corroborated still pages with KV down`, `T2 50 probes → ≤1 summary per window`, `T2 stable body`.

### T3 Delivery lifecycle
Files: `index.ts` default export (`fetch(request, env, ctx)`), `handleRequest(request, env, ctx?)`, `deliver()` with 1 retry on 429/5xx (Retry-After capped 2 s), outcome `provider_accepted|failed|unknown` recorded to `ops:delivery:last` (TTL 7 d) when KV present; failures never trigger alerts (no recursion). dev-entry re-exports default (unchanged).

### T4 Retention + numeric normalisation
`KvLike.put(key, value, opts?)`; counts `expirationTtl: 90 d`; ops keys 7 d; `numericRecord` for every count map.

### T5 Honest failure wording
`whyLineFor("captured_error")` and `priorityRead` when no error/last step: say what was observed and that failed startup is not shown; add `failure(v1): domain · phase · error · bootAge · cause=unconfirmed` line. whyKey values unchanged (counter compatibility).

### T6 Truthful health
`scheduled()` dispatches by `event.cron`: `15 * * * *` → digest (unchanged); `*/15 * * * *` → `runHealthCheck` (bindings presence, KV write ack, KV read of previous record (miss = unknown), provenance self-test). Store `ops:health:last` (TTL 7 d). Healthy → one log line. Unhealthy → one Discord ops message per incident (2 consecutive failures; bindings 1; KV-unreadable → ≤1/scheduled hour). `/health` → `{v:1, live:true, health, sampledAt, ageSec, failing}`; missing/stale(>35 min)/future(>60 s)/invalid → `unknown`. wrangler.toml records the extra cron as config only; NOT live until a separately approved deploy.

## Not in scope (explicit)
Client v2 diagnostics, new manifest fields, GPU, colo/country, external watchdog, Durable Object dedupe, healthy Discord cadence, sessionId policy, deploy.
