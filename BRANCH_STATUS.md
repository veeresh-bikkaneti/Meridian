# BRANCH_STATUS — fix/wave2-build-stamp

**State: PR #225 open. Engineering Lead verdict: READY (round 1, 6 non-blocking nits — 3 fixed in the nit round, 3 deferred in the PR comment). Next: Chitti — only the owner merges.**
Base: `origin/main d77ee52` (rebased 2026-10-22 after #226, #212, #229 and #230 landed; original base was the PR #222 merge commit `1ca4c04`). Only conflict was this file, resolved per convention (the branch's own status wins).
Full write-up: `docs/reviews/2026-10-21-wave2-build-stamp.md`.

## What this branch does

- **WI-7a — build stamping for the Workers build.** One build id,
  computed once in `vite.config.ts` (`BUILD_ID`), is shared by the
  bundle define, the sw.js fingerprint plugin and the new build-meta
  plugin, which writes `build-meta.json` into the build output
  inside the Vite build itself. Before this, build-meta.json was
  generated only by npm `prebuild` hooks, so a direct `vite build`
  (the Workers Builds shape) on a fresh checkout served none.
  `scripts/verify-build-stamp.mjs` proves meta == sw.js VERSION ==
  a prefix of HEAD for any built tree.
- **WI-7b — production smoke script.** `node scripts/prod-smoke.mjs
  [baseUrl]` (GET only, non-zero exit on failure) checks the live
  site's security headers, `/_serverFn/` 404, security.txt, manifest
  start_url and the build stamp. Documented in the README Deployment
  section; a manual-only GitHub Actions workflow runs it
  (`workflow_dispatch`, no schedule).

## Context finding (WI-7a)

Production's earlier `36bad5e` stamp was real, not coincidence:
`resolveBuildId()` uses the 12-char `GITHUB_SHA` prefix on GitHub
Actions (Pages) and falls back to the 7-char `git rev-parse --short
HEAD` on Workers Builds. Details and the divergence gaps in the
review doc.

## Finding (not this branch's files)

The smoke script fails ONE check against current production:
`GET /_serverFn/` returns TanStack's unhandled 500, not the 404
PR #222's ServerFnGuard produces on main. The guard is not effective
in the deployed Workers/Nitro build. Needs an owner-assigned
follow-up branch (server-entry wiring); `src/` is outside this
branch's file list.

## Files

- `scripts/build-meta-plugin.mjs` (new)
- `scripts/build-meta-plugin.test.mjs` (new)
- `scripts/verify-build-stamp.mjs` (new)
- `scripts/prod-smoke.mjs` (new)
- `scripts/prod-smoke.test.mjs` (new)
- `scripts/fingerprint-sw-plugin.mjs` (optional pinned build id)
- `vite.config.ts` (one shared BUILD_ID; build-meta plugin registered)
- `package.json` (`smoke:prod`, `verify:build-stamp` scripts)
- `.github/workflows/prod-smoke.yml` (new, manual only)
- `README.md` (Deployment: stamping + smoke subsections)
- `docs/reviews/2026-10-21-wave2-build-stamp.md` (new)
- `BRANCH_STATUS.md` (this file)

## Gates

- typecheck clean · npm test green (scripts 831, src 1473, 0 fail)
- lint-cards GATE PASSED
- `npm run build`, `npm run build:pages`, direct `npx vite build`
  all green; `verify-build-stamp` PASS on both output trees
- Playwright hydration-boot against the built artifact: 1/1
- prod-smoke vs live production: 4 PASS / 1 FAIL (the S5-prod
  finding above — pre-existing, not this branch)

## Pending

- Chitti → owner's merge call. ("Ready to merge? NO" until both.)
- After the owner merges: run `node scripts/prod-smoke.mjs` against
  production and post the real output on the PR (it will keep
  failing the `/_serverFn/` check until the S5-prod follow-up lands).
