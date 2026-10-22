# BRANCH_STATUS — fix/review-remaining-hardening-v2

**State: PR #222 open. Cure round pushed; awaiting Chitti's crew re-vote on the cured tip. Only the owner merges.**
Base: `origin/main 36bad5e5` (the PR #207 merge commit).
Full write-up: `docs/reviews/2026-10-21-remaining.md`.

## What this PR does

- **S3** — crash-endpoint host pin: `observabilityEndpoint` from
  `flags.json` is accepted only as a root-relative path or an https
  URL whose host is on the ingest allowlist.
- **S4** — worker ingest hardening: Origin allowlist, streamed 8 KB
  cap, stricter schema, and an optional rate-limit binding
  (`CRASH_RATE_LIMITER`) on the crash-report worker.
- **S5** — clean 404/405 for server functions: a custom server entry
  answers bare or unknown `/_serverFn/` requests instead of an
  unhandled 500.
- **P6** — the Ko-fi link sits behind the `GrownUpGate`.
- **R7** — `security.txt`, `robots.txt`, and `sitemap.xml` added.
- **S10** — dead cookie config removed.
- Stable Playwright e2e specs wired into CI (a new `e2e` job in
  GitHub Actions).

## Files

Original PR files (`git diff --name-only 36bad5e5..27a03596`), plus
the cure-round files listed after:

- `.github/workflows/node.js.yml`
- `docs/observability.md`
- `docs/reviews/2026-10-21-remaining.md`
- `docs/security-headers.md`
- `playwright.config.ts`
- `public/.well-known/security.txt`
- `public/robots.txt`
- `public/sitemap.xml`
- `scripts/crash-smoke.mjs`
- `scripts/crash-watchdog.mjs`
- `scripts/crash-watchdog.test.mjs`
- `scripts/static-wellknown.test.mjs`
- `src/components/grandpa-coffee-run.tsx`
- `src/game/brand.test.ts`
- `src/game/brand.ts`
- `src/lib/flags.test.ts`
- `src/lib/flags.ts`
- `src/lib/server/server-fn-guard.test.ts`
- `src/lib/server/server-fn-guard.ts`
- `src/server.ts`
- `tests/e2e/crash-watchdog.spec.ts`
- `tests/e2e/grandpa-coffee-run.desktop.spec.ts`
- `tests/e2e/grandpa-tasting-tour.spec.ts`
- `tests/e2e/helpers.ts`
- `tests/e2e/kofi-persistent-cloud.mobile.spec.ts`
- `tests/e2e/observability.spec.ts`
- `workers/crash-report/README.md`
- `workers/crash-report/src/index.test.ts`
- `workers/crash-report/src/index.ts`
- `workers/crash-report/wrangler.toml`

Cure-round files:

- `src/lib/flags.ts`
- `src/lib/flags.test.ts`
- `scripts/crash-watchdog.mjs`
- `scripts/crash-watchdog.test.mjs`
- `scripts/crash-smoke.mjs`
- `public/.well-known/security.txt`
- `scripts/static-wellknown.test.mjs`
- `docs/reviews/2026-10-21-remaining.md`
- `workers/crash-report/README.md`
- `BRANCH_STATUS.md`

## Review record

- Full crew review first returned **MERGE-READY** (2026-10-21).
- That verdict was **superseded by an external review: NOT READY —
  3 blocks**:
  1. **Block 1** — backslash bypass in the endpoint validators: a
     `/\evil.com`-style value could slip past the shape check and
     resolve to a third-party host.
  2. **Block 2** — platform-rejected deploy instructions: the docs
     prescribed an upload-then-re-set-the-secret flow that
     Cloudflare rejects (errors 10021 / 10215).
  3. **Block 3** — `security.txt` contact pointing at the parked
     `/contact` form while private vulnerability reporting was off.

## Cure round (2026-10-21)

- **Block 1** — backslash rejection added to all 3 validator copies,
  with regression tests and fail-before / pass-after proof.
- **Block 2** — deploy docs rewritten to the version-upload flow:
  bindings (the `DISCORD_WEBHOOK_URL` secret with its value, and
  the `TELEMETRY_COUNTS` KV binding) ride with the version upload;
  there is no re-set step afterwards. This file is part of that
  rewrite.
- **Block 3** — commit `679b268` folded in: a GitHub advisory
  `Contact:` was added to `security.txt`; private vulnerability
  reporting was enabled by the owner and verified on.
- **Status:** cure pushed, awaiting Chitti's crew re-vote on the
  cured tip; only the owner merges.

## Nits noticed, not fixed

- `workers/crash-report/README.md`, Files section (~line 38): still
  describes `wrangler.toml` as carrying a commented-out
  `TELEMETRY_COUNTS` KV binding block recorded on branch
  `ops/telemetry-phase1-deploy`, awaiting merge. That is stale
  (the uncommented block with the real namespace id is on `main`
  via PR #204, and Phase 1 is live), but the Files section was
  outside this round's touched sections — it belongs to the
  issue-#221 README rewrite.
- `workers/crash-report/README.md`, Staging section (~line 447):
  still says "`cf.py` is hardcoded to the production script name".
  Also outside this round's touched sections; same #221 follow-up.
