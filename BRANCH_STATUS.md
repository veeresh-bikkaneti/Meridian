# BRANCH_STATUS — fix/serverfn-server-entry

**State: DOCS-ONLY PR open for review. The fix itself is an owner
dashboard action (one field in the Workers Builds configuration);
this branch only documents it. Not merged by any agent — the owner
merges.**

**Base:** origin/main @ `76630ba` (PR #212's merge). Branch created
2026-10-22 for WI-19 path (a), per the owner's ruling below.

**Owner ruling (Veeresh, 2026-10-22): "19a now, 19b as follow-up"**
— path (a) dashboard now; path (b) root `wrangler.jsonc` deferred.

## What this branch does

- [x] `docs/reviews/2026-10-22-serverfn-server-entry.md` — the full
      record: root cause (Builds automatic configuration set
      `main` to TanStack's default entry `@tanstack/react-start/server-entry`,
      which loads `src/start.ts` but never `src/server.ts`, so the
      S5 guard from PR #222 is not in the production bundle), the
      three live signals, the exact owner steps for path (a)
      (`main` → `src/server.ts` in the Builds project's Wrangler
      configuration, Workers & Pages → `meridian` → Settings > Build),
      the one-field rollback, post-change verification commands with
      expected results, the PR #225 smoke-coverage finding
      (`scripts/prod-smoke.mjs` already checks `GET /_serverFn/ → 404`),
      risk notes, and the deferred path (b) inventory.
- [x] `config/cloudflare/meridian.wrangler.toml` — one header
      comment pointing at the review doc (comments only; the
      `[[ratelimits]]` blocks and binding names untouched).
- [x] This file, replacing main's #212 record on this branch.

## What this branch deliberately does NOT do

- No code changes. `src/server.ts` and
  `src/lib/server/server-fn-guard.ts` are already on main (PR #222).
- No root `wrangler.jsonc` — that is path (b), the ruled follow-up.
- No `scripts/` smoke script — PR #225's `prod-smoke.mjs` covers
  `/_serverFn/`; extending it is #225's owner's work.
- No Cloudflare state changes. The dashboard edit is the owner's.

## Owner action (after merge, or any time — the doc is the record)

1. Workers & Pages → `meridian` → Settings > Build → the Builds
   project's Wrangler configuration: set
   `main` from `"@tanstack/react-start/server-entry"` to
   `"src/server.ts"`. Save.
2. Let the next Workers Builds deploy run (or trigger a redeploy).
3. Run the verification block in
   `docs/reviews/2026-10-22-serverfn-server-entry.md` and post the
   real output on the PR. Expected: `/_serverFn/` 404,
   `/_serverFn/abc` 404, OPTIONS 405, `/` 200 with security
   headers, POST `/api/contact` 400.
4. Rollback if needed: set `main` back and redeploy. One field.

## Gates (this branch, 2026-10-22)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts **808 pass / 0 fail**; src **1,473 pass /
      0 fail** — main-exact baselines (the `rate-limiter.server.test.ts`
      check on the config record is in the src suite: green)
- [x] `node scripts/lint-cards.mjs` — **GATE PASSED**
- [x] `npm run build:pages` — green
