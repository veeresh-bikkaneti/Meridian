# Wave 2 — build stamping + production smoke (WI-7a / WI-7b)

Branch: `fix/wave2-build-stamp` · Base: `origin/main 1ca4c04` (PR #222 merged)
Small, infra only. No app UI, no game content, no security-header values changed.

## WI-7a context question: is production's `36bad5e` real stamping?

Answered against production on 2026-10-21, before this branch started
(main was then `36bad5e`, PR #207):

- Workers (`meridian.knowledgetest.workers.dev`): `/build-meta.json`
  buildId `36bad5e`, `/sw.js` VERSION `meridian-36bad5e` — consistent.
- Pages mirror: buildId and VERSION both `36bad5e5877e` (12 chars).

**It was real stamping, not a coincidence of the commit.** How it is
produced: `scripts/build-id.mjs` `resolveBuildId()` takes the first
12 chars of `GITHUB_SHA` when present (GitHub Actions → the Pages
build), else falls back to `git rev-parse --short HEAD` (7 chars —
the Workers Builds path, which sets no `GITHUB_SHA`), else a
`local-<timestamp>`. PR #145's `fingerprint-sw-plugin` already stamps
sw.js inside the Vite build itself.

The two real gaps this branch closes:

1. **`build-meta.json` was generated only by npm lifecycle hooks**
   (`prebuild` / `prebuild:pages` → `scripts/write-build-meta.mjs`).
   The output is gitignored, so on a fresh checkout a build invoked
   without npm (a direct `vite build` — the Workers Builds shape)
   served no build-meta.json at all. Production had one only because
   its build command happens to run the hooks today.
2. **Three independent id resolutions could diverge.** The served
   meta (prebuild resolution), the bundle's baked id
   (`buildIdForBundle()`: meta-first, else fresh resolution) and the
   sw.js VERSION (fingerprint plugin: fresh resolution) each resolved
   separately. On the SHA and git paths they agree because the inputs
   are deterministic; on the timestamp fallback (no git, no SHA —
   tarball builds) they would all three differ, and the staleness
   check would offer a refresh that can never clear.

After #222 deployed, production re-stamped itself to `1ca4c04` on
both files — the git-short path working as described.

## What changed (WI-7a)

- `scripts/build-meta-plugin.mjs` (new): a Vite plugin in the exact
  pattern of `fingerprint-sw-plugin`. Its `writeBundle` writes
  `build-meta.json` into the client output dir (identified by the
  presence of `sw.js`, so SSR/server bundle dirs are skipped); its
  `closeBundle` stamps the Nitro `.vercel/output/static` tree as a
  safety net, only when that tree already exists.
- `vite.config.ts`: the build id is now computed **once**
  (`const BUILD_ID = buildIdForBundle()`) and shared by the bundle
  `define`, `fingerprintSwPlugin(BUILD_ID)` and
  `buildMetaPlugin(BUILD_ID)`. One value by construction.
- `scripts/fingerprint-sw-plugin.mjs`: accepts an optional pinned
  build id; `undefined` keeps the previous resolve-at-stamp behaviour.
- `scripts/verify-build-stamp.mjs` (new): for each output dir,
  asserts build-meta.json exists with a non-empty buildId, sw.js
  VERSION equals `meridian-<buildId>`, and (in a git checkout) the
  buildId is a prefix of HEAD. `npm run verify:build-stamp`.
- `scripts/build-meta-plugin.test.mjs` (new): unit tests for the
  writer, the plugin (pinned/unpinned, server-dir skip), the verifier
  (match, mismatch, missing meta, non-HEAD id), and a source pin on
  the vite.config wiring.

ADR: keep the npm `prebuild` writers untouched (Pages CI and local
`npm run build` rely on them; the plugin overwrite is byte-identical
when the id is shared). Rollback = remove the two plugin lines from
`vite.config.ts`; the hook path restores today's behaviour exactly.

### Proof the stamping runs for the Workers build, not only build:pages

From a tree with `public/build-meta.json` deleted and no outputs:

```sh
rm -f public/build-meta.json && rm -rf dist .vercel
npx vite build            # direct invocation — no npm hooks at all
node scripts/verify-build-stamp.mjs
# [fingerprint-sw-plugin] stamped buildId=1ca4c04 into .vercel/output/static/sw.js
# [build-meta-plugin] wrote buildId=1ca4c04 into .vercel/output/static
# PASS .vercel/output/static: buildId=1ca4c04 (meta == sw.js VERSION)
```

`npm run build` and `npm run build:pages` were also run; the verifier
passes on `.vercel/output/static` and on `dist/client` respectively,
and the Pages shell still references `/Meridian/` assets.

## What changed (WI-7b)

- `scripts/prod-smoke.mjs` (new): `node scripts/prod-smoke.mjs [baseUrl]`,
  default `https://meridian.knowledgetest.workers.dev`. GET only,
  15 s timeout per request, exit non-zero on any failure. Checks:
  `/` 200 + all seven security headers; `/_serverFn/` 404;
  `/.well-known/security.txt` 200; manifest `start_url` resolves to
  200; `/build-meta.json` has a buildId. `runProdSmoke(base, fetchFn)`
  is exported for tests. Also `npm run smoke:prod`.
- `scripts/prod-smoke.test.mjs` (new): healthy surface passes; each
  individual failure (missing header, _serverFn 500, security.txt
  404, missing buildId, dead start_url, network error) fails the run.
- `.github/workflows/prod-smoke.yml` (new): `workflow_dispatch` only,
  optional `base_url` input. No schedule.
- `README.md` Deployment section: "Build version stamping" and
  "Production smoke check" subsections.

## Finding (not this branch's files): S5 is not live in production

Running the new smoke script against production on 2026-10-21
(post-#222 deploy, buildId `1ca4c04`):

```text
PASS GET / → 200 with all security headers — 200, all 7 headers present
FAIL GET /_serverFn/ → 404 — status 500
PASS GET /.well-known/security.txt → 200 — status 200
PASS manifest start_url → 200 — ./ → https://meridian.knowledgetest.workers.dev/ status 200
PASS GET /build-meta.json → 200 with buildId — buildId 1ca4c04
SMOKE FAILED (exit 1)
```

The 500 body is TanStack's unhandled
`{"status":500,"unhandled":true,"message":"HTTPError"}` — repeated
10+ times (curl and node fetch agree). PR #222's `ServerFnGuard`
(src/server.ts) is correct on main and its unit tests pass, but the
guard is not effective in the deployed Workers/Nitro build.
`/_serverFn` without the trailing slash returns the guard-documented
router 404. This branch does not touch `src/` (outside its file list);
the smoke script is doing its job by catching it. Owner decision
needed: a follow-up branch to wire the server entry into the Nitro
output, owned by whoever takes S5-prod.

## Gates (this branch, real numbers)

- `npm run typecheck` — clean.
- `npm test` — scripts 831 tests (822 pass, 0 fail, rest skipped),
  src 1473 pass / 0 fail. (Final re-run after review fixes recorded
  in the PR body.)
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build` — green; verifier PASS on `.vercel/output/static`.
- `npm run build:pages` — green; verifier PASS on `dist/client`;
  `/Meridian/` base intact.
- Direct `npx vite build` (no hooks) — green; verifier PASS.
- Playwright `hydration-boot.desktop.spec.ts` against the built
  Pages artifact — 1/1 passed.
- `node scripts/prod-smoke.mjs` against production — exit 1, the one
  FAIL is the S5-prod finding above (pre-existing, not this branch).

## Out of scope / deferred

- The S5-prod wiring fix (above) — separate branch, owner to assign.
- Unifying the 7-char (Workers/git) vs 12-char (Pages/GITHUB_SHA)
  buildId lengths. Acceptance is per-deploy consistency ("both equal
  the deployed commit's short SHA"); each host's id is a true prefix
  of its deployed commit and all three copies agree within a deploy.
  Changing the length would churn the pinned build-id test and every
  existing deploy's format for no correctness gain.
