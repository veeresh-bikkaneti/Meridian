# BRANCH_STATUS — fix/serverfn-server-entry

**State: DOCS-ONLY PR open for review. The fix itself is an owner
dashboard action (one field in the Workers Builds configuration);
this branch only documents it. Not merged by any agent — the owner
merges. Owner action status: PENDING — the dashboard change has not
been taken yet (2026-10-22).**

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

## Cure round 1 (panel re-vote fixes, 2026-10-22)

Round-1 panel verdict: **NOT READY** (BLOCK ×2, DevEx FAIL) — the
root-cause record was called airtight; the blocks were about the
owner steps being followable and the live-state record being
complete. Cures applied on this branch (docs/comments only):
`compatibility_flags = []` stated honestly (live API read) in the
verification caveat, the path-(b) inventory, and the config record;
the step-2 locator named with the inferred hop flagged, a bold
**Not:** callout for the wrong screen, and a verbatim stop
condition; a checkable `/build-meta.json` readiness step (capture
before; new buildId only when the deploy carries a new commit —
same-commit redeploys keep the buildId and readiness is the
deployments list); "redeploy" explained in plain words in the steps
and the rollback; a durable Status line (PENDING → DONE form) with
Chitti named as verifier and issue #228 cited for path (b); a
failure branch (still 500 after a completed deploy → stop, report
on the PR, escalate); plain-language openings (entry = the first
file run for every request; WI-19 and S5 defined at first use);
verification extended to `/privacy`, a 404 route, and one hashed
asset; the Risks CSRF sentence narrowed to what `src/start.ts`
actually does; and a supersede note for when path (b) lands.

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
   headers, POST `/api/contact` 400. Caveat on that last one: the
   contact POST returns 400 **today**, before the change, so a 400
   after it proves pass-through only — that the route still
   answers — not the entry change and not end-to-end contact
   delivery (the form stays parked; activation is issue #220).
4. Rollback if needed: set `main` back and redeploy. One field.

## Gates (this branch, 2026-10-22; re-run on the cure tip)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts **808 pass / 0 fail**; src **1,473 pass /
      0 fail** — main-exact baselines (the `rate-limiter.server.test.ts`
      check on the config record is in the src suite: green)
- [x] `node scripts/lint-cards.mjs` — **GATE PASSED**
- [x] `npm run build:pages` — green
- Playwright E2E — **N/A for this branch**: docs-only, no code or
  behavior change, so there is nothing for E2E to exercise. The
  post-change *production* probes are the verification (see the
  review doc), run by Chitti after the owner's dashboard action.
