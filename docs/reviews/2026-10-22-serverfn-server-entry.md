# WI-19: make production run `src/server.ts` so `/_serverFn/` returns 404

Branch: `fix/serverfn-server-entry` — this PR. Based on `main` at
`76630ba` (the PR #212 merge). **Docs only**: as written, the fix was
one field in a Cloudflare dashboard configuration, edited by the
owner. No code changes, no Cloudflare state changes by any agent.

**SUPERSEDED (2026-10-22): the path-(a) dashboard steps in this
document describe a configuration editor that does not exist.** The
owner went to the screen (screenshot, 2026-10-22) and found no
Wrangler configuration and no `main` field; a follow-up
investigation proved no dashboard or API surface exposes that
config — it is generated inside the Builds workspace on every
build and discarded. The steps below are kept as history, exactly
as the supersede note at the end of this document required. WI-19
is delivered by **path (b)** instead: the #228 PR (root
`wrangler.jsonc` + Cloudflare Vite plugin wiring). Live record:
`docs/reviews/2026-10-22-wrangler-config-entry.md`.

**Status: DELIVERED BY THE WI-19b PR (issue #228) — pending merge
and post-merge verification** (2026-10-22). When the #228 PR has
merged and a Builds deploy has carried it, this line becomes:
**DONE — \<date\>, deploy \<the completed deploy in the Builds
deployments list\>, verification output posted on the #228 PR.**
The verifier is Chitti: after the deploy, Chitti runs the
post-change probes in the WI-19b record and posts the real output
on the #228 PR.

**In plain language:** the *entry* (or *entrypoint*) is the first
file run for every request — it decides what handles the request.
Production currently runs a default entry file supplied by the
framework instead of this repo's own entry file, `src/server.ts`.
**WI-19** is this work item: get production running `src/server.ts`.
**S5** is the review item from PR #222 that added the
server-function guard (`src/lib/server/server-fn-guard.ts`) inside
that entry — the guard is what answers `/_serverFn/` probes with a
clean 404/405.

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
and — the differing condition — a 500 "Server function info not
found" when the request carries same-origin headers (an `Origin`
matching the host, which gets past the CSRF origin check, after
which the default handler fails on the missing server-function
payload). None of the guard's strings (`serverFnGuard`,
`functionsInUse`) are in that bundle (the *bundle* is the single
built file Cloudflare actually runs). They **are** in the repo's own `npm run build` output
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

> **Superseded — do not follow these steps.** The configuration
> editor they describe does not exist; see the banner at the top
> of this document. Kept as history.

One field, in one place, changed by the owner:

1. In the Cloudflare dashboard, go to **Workers & Pages** and open
   the **`meridian`** Worker.
2. Open **Settings > Build**. This is the screen Cloudflare's Workers
   Builds documentation names for a project's build settings
   ("Build settings can be found by navigating to **Settings** >
   **Build** within your Worker"). On that screen, open the Builds
   project's **Wrangler configuration** — the configuration Builds
   generated for this project, the one its deploy command
   (`npx wrangler deploy`) runs with; it is the text containing
   `"main"`. Honest flag: the cited docs name the **Settings >
   Build** screen and its settings, but they do not spell out the
   exact on-screen hop from that screen to the configuration text —
   that hop is **inferred** from the Builds UI and is unverified.

   > **Not: Settings > Variables & Secrets.** That screen holds
   > runtime variables, not the build configuration. Editing it does
   > not change the entry, and it is the wrong screen for this step.
   > (And not a file in this repo: adding one is path (b).)

   **Stop condition: if you cannot find a configuration containing
   "main", stop and report — do not improvise, do not edit Variables
   & Secrets, do not create a root file (that is path (b)).**
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
   or a redeploy. A *redeploy* means telling Workers Builds to build
   and deploy the current `main` again without any new commit; the
   owner triggers it from the `meridian` worker's **Deployments**
   list in the dashboard (retry/deploy the latest build). Until that
   deploy finishes, production still runs the default entry and
   `/_serverFn/` still 500s; that is expected, not a failed edit.

## Rollback

Set `main` back to `"@tanstack/react-start/server-entry"` in the
same screen (step 2 above) and redeploy. A *redeploy* is telling
Workers Builds to build and deploy the current `main` again without
any new commit, triggered from the `meridian` worker's
**Deployments** list (retry/deploy the latest build) — or simply
wait for the next build, since saved build settings apply to the
*next* build, so the revert also lags by one deploy. One field, same
as the change. No code revert is involved on either side. Rolling
back restores the known baseline exactly: `/_serverFn/` 500,
`/_serverFn/abc` 403.

## Post-change verification

**Readiness check first — is the new deploy actually serving?**
Run this *before* the edit (step 1 of the change) and again after
the deploy:

```sh
curl -s https://meridian.knowledgetest.workers.dev/build-meta.json
# today (2026-10-22, before the change): {"buildId": "76630ba"}
```

The `buildId` derives from the commit SHA (`scripts/build-id.mjs`),
so what "ready" looks like depends on how the deploy happened:

- **The deploy carries a new commit** (for example the push that
  merges this PR): the `buildId` must be **different** from the one
  captured before. A different buildId is the readiness signal.
- **The owner redeployed the same commit**: the `buildId` is
  **identical** — that is correct, not a failed deploy. There, the
  readiness signal is the Builds **deployments list** showing that
  deploy completed after the edit.

Only run the checks below once one of those two signals holds.

```sh
B=https://meridian.knowledgetest.workers.dev
curl -si $B/_serverFn/ | head -20
curl -si $B/_serverFn/abc | head -20
curl -si -X OPTIONS $B/_serverFn/x | head -5
curl -sI $B/ | grep -iE "^(HTTP|content-type|content-security-policy|strict-transport)"
curl -s $B/ | head -c 100   # expect real HTML: "<!doctype html..." — a non-empty body
curl -sI $B/privacy | grep -iE "^(HTTP|content-security-policy|strict-transport)"
curl -sI $B/does-not-exist | grep -iE "^(HTTP|content-security-policy|strict-transport)"   # the 404 page
curl -s $B/ | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -1   # note one hashed asset path, then:
curl -sI $B/assets/<that-file> | grep -iE "^(HTTP|cache-control)"   # expect the immutable year-long value
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/contact -H 'content-type: application/json' -H "Origin: $B" -d '{}'   # expect 400, as today
```

Expected results:

| Check | Expected |
| --- | --- |
| `GET /_serverFn/` | **404** JSON, `Cache-Control: no-store`, security headers present |
| `GET /_serverFn/abc` | **404** JSON, `no-store`, security headers present |
| `OPTIONS /_serverFn/x` | **405** |
| `GET /` | **200**, `Content-Type: text/html`, non-empty HTML body, Content-Security-Policy and Strict-Transport-Security present (unchanged) |
| `GET /privacy` | **200** with the security headers (unchanged) |
| `GET /does-not-exist` | **404** page with the security headers (unchanged) |
| One hashed `/assets/*` file | **200**, `Cache-Control: public, max-age=31536000, immutable` (unchanged) |
| `POST /api/contact` (empty JSON) | **400** — unchanged from today; see the caveat below |

**Players and parents should notice nothing at all.** Pages, the
map, and static files behave exactly as before. If anything looks
different to a player after the deploy, that is a failure — roll
back (below).

**Caveat on the contact row — a 400 proves pass-through only.**
`POST /api/contact` returns 400 **today**, before this change
(live-probed 2026-10-22: `400 {"error":"invalid message", …}`), so a
post-change 400 is expected either way. It proves only that the
route still answers behind the new entry — **not** that the entry
change worked, and **not** end-to-end contact delivery (the contact
form stays parked; its activation is issue #220). The
`/_serverFn/` rows are the proof of the entry change. One honesty
note behind this: the header of
`config/cloudflare/meridian.wrangler.toml` says `/api/contact`'s
`process.env` path needs `compatibility_flags = ["nodejs_compat"]`
with `compatibility_date >= "2025-04-01"`, but the live script
settings — read through the Cloudflare API on 2026-10-22 — report
**`compatibility_flags = []`** with compatibility_date 2026-10-19:
an **empty** flag set. So do not assume the live configuration has
`nodejs_compat`; what the Builds generated configuration contains
is not directly readable from this repo, and the observed behavior
(the route answering 400 today) is the ground truth either way. If
the POST returns something other than 400 after the change, record
the real output on the PR — it points at the contact path, not at
this entry change.

**Failure branch.** If `/_serverFn/` still returns **500 after a
deploy has completed** (per the readiness check above — not merely
while a deploy is still running): **stop.** Do not improvise further
changes. Report the full output on PR #229 and escalate to the
owner. The rollback below restores the known baseline
(`/_serverFn/` 500, `/_serverFn/abc` 403).

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
  (`createStartHandler(defaultStreamHandler)` — the standard
  TanStack request handler, untouched) with one addition in front:
  `ServerFnGuard.check()`. The guard is unit-tested
  (`src/lib/server/server-fn-guard.test.ts`) and
  `SERVER_FUNCTIONS_IN_USE` is `false`, so every `/_serverFn/*` id
  is impossible by construction and is answered by the guard; every
  other request — pages, assets, `/api/contact` — passes through to
  the same handler production runs today, behind `start.ts`'s
  security-headers middleware. (The CSRF middleware in the same
  file is *not* a general shield: its filter
  (`src/start.ts:20-22`) engages only for `handlerType ===
  "serverFn"` requests, so pages and `/api/contact` were never
  behind CSRF — only behind the security-headers middleware.)
  Guard responses get the same security headers applied directly in
  `src/server.ts`.
- **Expected behavior changes are narrow**: `/_serverFn/*` answers
  (today's 500/403 → 404/405 JSON with `no-store` and the security
  headers) and the entry wrapper itself. In the local reproduction,
  HTML and static files behaved exactly as before; the production
  proof is the extended verification above (`/`, `/privacy`, a 404
  route, one hashed asset) — that, not the local run, is the
  deciding evidence.
- **If anything else misbehaves after the deploy**, the rollback is
  the one-field revert above — no code change, no repo revert.
- The local `wrangler dev` behavior cited here was established
  during the WI-19 investigation (2026-10-22); this docs PR did not
  re-run it. The production verification above is the deciding
  evidence.

## Deferred: path (b) — a root `wrangler.jsonc` in the repo

Ruled a follow-up by the owner (2026-10-22) and filed as **issue
#228**. Path (b) commits a root
`wrangler.jsonc` with `"main": "src/server.ts"`. Committing a root
config turns **off** the automatic setup, so the file has to
deliberately redeclare everything the automatic setup supplies
today:

- the entry: `"main": "src/server.ts"`;
- the `@cloudflare/vite-plugin` setup in `vite.config.ts` (the repo
  build currently wires Nitro instead — `vite.config.ts:275`,
  `preset: "vercel"` — and has no Cloudflare plugin wiring);
- the compatibility flags, resolved deliberately. The record file
  says `/api/contact`'s `process.env` path needs
  `compatibility_flags: ["nodejs_compat"]`, but the live script
  settings — read through the Cloudflare API on 2026-10-22 —
  report **`compatibility_flags = []`**: an empty flag set, and
  `/api/contact` answers 400 today anyway. What the Builds
  generated configuration contains is not directly readable from
  this repo, so path (b) must not copy a presumed flag set as fact:
  it either declares `nodejs_compat` and proves `/api/contact`
  still answers 400, or establishes why the route works without it;
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

**Supersede obligation, recorded so it is not lost:** when path
(b) lands (#228), this document's framing — "the repository has no
root Wrangler configuration file" (Root cause, above) and the
dashboard-steps model of path (a) — becomes history, and the
pointer comment in `config/cloudflare/meridian.wrangler.toml` must
be updated in the same PR. Updating both is part of #228's job.

**Implemented (2026-10-22):** the #228 PR lands path (b) — with
one shape change the experiments forced: a committed root config
ALONE was proven unable to deploy (wrangler's own bundler cannot
resolve TanStack Start's plugin-injected virtual modules), so the
PR also wires `@cloudflare/vite-plugin` into `vite.config.ts`
and pins `wrangler` as a devDependency. The shipped inventory
follows the locally proven shape — no assets key and no bindings
in the root config; the plugin's emitted config supplies both —
which differs from the speculative inventory above. The WI-19b
record is the authority:
`docs/reviews/2026-10-22-wrangler-config-entry.md`. Both
supersede updates named above (this document's framing and the
TOML pointer comment) are made in that same PR, as required.

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
