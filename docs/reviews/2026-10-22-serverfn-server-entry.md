# WI-19: make production run `src/server.ts` so `/_serverFn/` returns 404

Branch: `fix/serverfn-server-entry` — this PR. Based on `main` at
`76630ba` (the PR #212 merge). **Docs only**: the fix itself is one
field in a Cloudflare dashboard configuration, edited by the owner.
No code changes, no Cloudflare state changes by any agent.

Origin: PR #222 (review item S5) added `src/server.ts` and
`src/lib/server/server-fn-guard.ts` so probes of `/_serverFn/` get a
clean 404/405 instead of an unhandled 500. The code merged; production
never ran it. This document records why, the owner's ruling, the exact
owner steps for path (a), the rollback, and how to verify.

## Root cause

The repository has **no root Wrangler configuration file** — on
purpose (see `config/cloudflare/meridian.wrangler.toml`: "CONFIG
RECORD, NOT READ BY ANY BUILD. The `meridian` worker deploys through
Cloudflare Workers Builds, and its wrangler config lives with that
project, not in this repo").

When a project has no Wrangler configuration file, Workers Builds
runs its automatic configuration: it detects the framework and
generates the configuration for the project. For TanStack Start, the
generated configuration sets the entry point to the framework default
(Cloudflare's TanStack Start guide shows the generated
`wrangler.jsonc` with `"main": "@tanstack/react-start/server-entry"`,
and `wrangler@4.152.0 setup --dry-run` against this repo prints the
same). That default entry is what production runs.

TanStack's default entry loads `src/start.ts` — the Start instance
with the request middleware — but it never loads `src/server.ts`. A
custom server entry only runs when the Wrangler configuration points
`main` at it (Cloudflare's guide, "Custom entrypoints": "TanStack
Start uses `@tanstack/react-start/server-entry` as your default
entrypoint… Update your Wrangler configuration to point to your custom
entrypoint: `{ "main": "src/server.ts" }`"). So the S5 guard in
`src/server.ts` is not in the production bundle at all, while
everything in `src/start.ts` works fine.

### The three live signals (2026-10-22, production at `76630ba`)

1. `GET /_serverFn/` → **500**
   `{"status":500,"statusText":"","unhandled":true,"message":"HTTPError"}`,
   with **no security headers**. The guard never saw the request: the
   default handler itself throws the unhandled 500 on the bare
   server-function path.
2. `GET /_serverFn/abc` → **403** `text/plain` "Forbidden". That is
   TanStack's CSRF middleware rejecting a request with no valid
   origin/token — middleware that `src/start.ts` registers. So
   `start.ts` is in the bundle and active; the entry wrapped around
   it is the default one.
3. `/`, `/privacy`, and the 404 page all serve the **full security
   header set** (Content-Security-Policy, Strict-Transport-Security,
   X-Frame-Options, and the rest). That is `start.ts`'s
   `securityHeadersMiddleware` running on rendered HTML. Only
   `src/server.ts` is missing from production — nothing else is.

### Local reproduction (from the WI-19 investigation)

A Cloudflare-style build run under `wrangler dev` reproduces
production exactly: 500 on `/_serverFn/`, 403 on `/_serverFn/abc`,
and a 500 "Server function info not found" with same-origin headers.
None of the guard's strings (`serverFnGuard`, `functionsInUse`) are
in that bundle. They **are** in the repo's own `npm run build` output
— which uses Nitro's `vercel` preset (`vite.config.ts:275`) — but
production does not use that output. With `main` set to
`src/server.ts` in the Wrangler configuration, the guard is in the
bundle and the same local build answers: `/_serverFn/` and
`/_serverFn/abc` → 404 JSON with `no-store` and the security headers,
`OPTIONS /_serverFn/x` → 405, and HTML and static files unchanged.

## Owner ruling

Veeresh, 2026-10-22: **"19a now, 19b as follow-up"** (from "18 go
(plain value), 19a now, 19b as follow-up").

- **Path (a) — dashboard, now.** Edit the Builds-side configuration
  so `main` is `src/server.ts`. No app code. This PR is the
  documentation half of that ruling.
- **Path (b) — repo config, follow-up.** Commit a root
  `wrangler.jsonc`. Deferred; see the last section.

## The change (path (a)) — exact owner steps

One field, in one place, changed by the owner:

1. In the Cloudflare dashboard, go to **Workers & Pages** and open
   the **`meridian`** Worker.
2. Open **Settings > Build**. This is the screen Cloudflare's Workers
   Builds documentation names for a project's build settings
   ("Build settings can be found by navigating to **Settings** >
   **Build** within your Worker"). The Builds project's **Wrangler
   configuration** — the configuration Builds generated for this
   project — is part of that project's configuration. (Not **Settings
   > Variables & Secrets**: that screen holds runtime variables and
   is the wrong place; and not a file in this repo: adding one is
   path (b).)
3. In that Wrangler configuration, change exactly one field:

   ```diff
   - "main": "@tanstack/react-start/server-entry"
   + "main": "src/server.ts"
   ```

   This is the precise field and value Cloudflare's TanStack Start
   guide prescribes for running a custom entrypoint
   (`src/server.ts` already exists and is the S5 entry from PR #222).
4. Change nothing else in that configuration in this step — not the
   name, not the compatibility date or flags, not the assets
   settings. One field only.
5. Save. Per the Builds documentation, "when you update and save
   build settings, the updated settings will be applied to your
   *next* build." The edit therefore takes effect on the **next
   Workers Builds deploy after the edit** — the next push to `main`,
   or an owner-triggered redeploy of the current commit from the
   Builds deployments list. Until that deploy finishes, production
   still runs the default entry and `/_serverFn/` still 500s; that
   is expected, not a failed edit.

## Rollback

Set `main` back to `"@tanstack/react-start/server-entry"` in the
same screen (step 2 above) and redeploy (next build, or an
owner-triggered redeploy). One field, same as the change. No code
revert is involved on either side.

## Post-change verification

After the first deploy that follows the edit, confirm
`/build-meta.json` is serving the new build, then run:

```sh
B=https://meridian.knowledgetest.workers.dev
curl -si $B/_serverFn/ | head -20
curl -si $B/_serverFn/abc | head -20
curl -si -X OPTIONS $B/_serverFn/x | head -5
curl -sI $B/ | grep -iE "^(HTTP|content-security-policy|strict-transport)"
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/contact -H 'content-type: application/json' -H "Origin: $B" -d '{}'   # expect 400 validation, not 500
```

Expected results:

| Check | Expected |
| --- | --- |
| `GET /_serverFn/` | **404** JSON, `Cache-Control: no-store`, security headers present |
| `GET /_serverFn/abc` | **404** JSON, `no-store`, security headers present |
| `OPTIONS /_serverFn/x` | **405** |
| `GET /` | **200** with Content-Security-Policy and Strict-Transport-Security (unchanged) |
| `POST /api/contact` (empty JSON) | **400** validation — not 500 |

One caveat on the last row: `/api/contact`'s env path also needs
`compatibility_flags = ["nodejs_compat"]` with
`compatibility_date >= "2025-04-01"` in the Builds configuration
(see the header of `config/cloudflare/meridian.wrangler.toml`; the
generated TanStack Start configuration includes `nodejs_compat`, and
the live script settings report compatibility_date 2026-10-19). If
the POST returns something other than 400, record the real output on
the PR — it points at the contact config, not at this entry change.
The `/_serverFn/` rows are the proof of the entry change. Post the
real output on this PR.

### Smoke coverage: PR #225 already checks the core signal

PR #225 (branch `fix/wave2-build-stamp`, WI-7b) adds
`scripts/prod-smoke.mjs`, a post-deploy production smoke check. Its
check 2 is exactly this fix's core signal: the header comment
(`scripts/prod-smoke.mjs:17-18`) specifies
`GET /_serverFn/ → 404` ("no server functions are in use; a bare or
unknown id must never 500 — review S5, PR #222"), the implementation
fetches `${base}/_serverFn/` and requires status 404
(`scripts/prod-smoke.mjs:86-95`), and its test file pins the
pre-#222 failure mode (`scripts/prod-smoke.test.mjs:91`,
"runProdSmoke fails when /_serverFn/ 500s and security.txt 404s
(pre-#222 prod)"). Once #225 merges, `node scripts/prod-smoke.mjs`
is the repeatable check after every deploy. It covers the bare path
only — the `/<id>`, OPTIONS, and `no-store`/header expectations in
the table above stay manual curl checks. Extending the smoke script
belongs with #225's owner; this PR deliberately adds no script.

## Risks

- **The custom entry runs in production for the first time.**
  `src/server.ts` wraps the unchanged TanStack handler
  (`createStartHandler(defaultStreamHandler)`) with one addition in
  front: `ServerFnGuard.check()`. The guard is unit-tested
  (`src/lib/server/server-fn-guard.test.ts`) and
  `SERVER_FUNCTIONS_IN_USE` is `false`, so every `/_serverFn/*` id
  is impossible by construction and is answered by the guard; every
  other request — pages, assets, `/api/contact` — passes through to
  the same handler production runs today, still behind `start.ts`'s
  CSRF and security-header middleware. Guard responses get the same
  security headers applied directly in `src/server.ts`.
- **Expected behavior changes are narrow**: `/_serverFn/*` answers
  (today's 500/403 → 404/405 JSON with `no-store` and the security
  headers) and the entry wrapper itself. HTML and static files are
  unchanged per the local reproduction.
- **If anything else misbehaves after the deploy**, the rollback is
  the one-field revert above — no code change, no repo revert.
- The local `wrangler dev` behavior cited here was established
  during the WI-19 investigation (2026-10-22); this docs PR did not
  re-run it. The production verification above is the deciding
  evidence.

## Deferred: path (b) — a root `wrangler.jsonc` in the repo

Ruled a follow-up by the owner (2026-10-22). Path (b) commits a root
`wrangler.jsonc` with `"main": "src/server.ts"`. Committing a root
config turns **off** the automatic setup, so the file has to
deliberately redeclare everything the automatic setup supplies
today:

- the entry: `"main": "src/server.ts"`;
- the `@cloudflare/vite-plugin` setup in `vite.config.ts` (the repo
  build currently wires Nitro instead — `vite.config.ts:275`,
  `preset: "vercel"` — and has no Cloudflare plugin wiring);
- `compatibility_flags: ["nodejs_compat"]`, which `/api/contact`'s
  `process.env` path needs;
- the compatibility date (the live script settings report
  2026-10-19);
- the assets directory and binding;
- the worker name, `meridian`;
- every binding the live worker uses. Bindings ride with Builds
  versions — the script settings API reports none at script level —
  so the inventory must come from the Builds project, never from
  guesses. The known set is recorded in
  `config/cloudflare/meridian.wrangler.toml` (the two
  `[[ratelimits]]` blocks for `/api/contact`).

Why the repo avoided a root config until now is stated in that
record file's header: a root Wrangler config changes what
`wrangler deploy` uploads, so the config stayed with the Builds
project and the repo kept only the human record. Path (b) reverses
that trade deliberately, and must also show the GitHub Pages build
(`npm run build:pages`) and the repo's own build are unaffected. No
implementation in this PR.

## Files in this PR

- `docs/reviews/2026-10-22-serverfn-server-entry.md` — this record.
- `BRANCH_STATUS.md` — this branch's own record.
- `config/cloudflare/meridian.wrangler.toml` — one header comment
  pointing here (comments only; the `[[ratelimits]]` blocks and
  binding names are untouched — `src/lib/contact/rate-limiter.server.test.ts`
  checks them).

No other PR is touched: not #219, #220, #221, #197, #217, #225, #215,
or #216.

## Sources (Cloudflare documentation, checked 2026-10-22)

- TanStack Start framework guide — generated configuration
  (`main: @tanstack/react-start/server-entry`) and "Custom
  entrypoints" (`"main": "src/server.ts"`):
  https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Workers Builds configuration — **Settings** > **Build**, and saved
  settings applying to the next build:
  https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Deploy an existing project (automatic configuration) — how
  Wrangler generates configuration for projects without a Wrangler
  configuration file, and `wrangler setup --dry-run`:
  https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/
