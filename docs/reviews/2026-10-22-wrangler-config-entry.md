# WI-19b: run `src/server.ts` in production — root `wrangler.jsonc` + Cloudflare Vite plugin

Branch: `fix/228-root-wrangler-config` — this PR. Based on `main` at
`d77ee52` (the PR #230 merge). Closes issue #228.

**Status: BUILT AND PROVEN LOCALLY — awaiting panel review and the
owner's merge word.** The fix is not called done until the
post-merge verification at the end of this document passes against
production, with the real output posted on this PR. Verifier:
Chitti.

**In plain language:** every request to the site is handled by an
*entry* file — the first file run. Production has never run this
repo's own entry, `src/server.ts`, so the server-function guard it
carries (PR #222, item S5) is dead code in production and
`/_serverFn/` answers an unhandled 500. This PR makes the deployed
Worker start at `src/server.ts`, so the guard answers those probes
with a clean 404/405. Nothing else about the site's behavior is
meant to change.

## Root cause

The repo deliberately had **no root Wrangler configuration file**.
Cloudflare Workers Builds therefore deploys with `wrangler
deploy`'s *automatic configuration*: on every build, in a temporary
workspace, wrangler detects the framework, writes a generated
config whose `main` is TanStack Start's **default** entry
(`@tanstack/react-start/server-entry`), installs `@cloudflare/vite-plugin`
into that workspace, and re-runs the build under the plugin. The
default entry loads `src/start.ts` (which is why the security
headers work live) but never `src/server.ts` — so the guard never
runs. The generated config exists only inside the build machine:
the 2026-10-22 investigation proved no dashboard screen and no API
surface exposes it for editing (the #229 dashboard-steps document
is superseded for exactly this reason; see its banner).

## The experiment record — why the fix has three parts

The owner first ruled the config-only version of this fix (a root
`wrangler.jsonc` on its own). The build crew stopped at a
checkpoint instead of shipping it unproven, the owner approved
installing the two Cloudflare packages in a scratch copy ("Approve
both installs — prove it locally first", 2026-10-22), and the
experiments below were run. Both outcomes were independently
reproduced by a Reality Checker.

**W2 — root config alone (what a config-only PR would deploy):
PROVEN BROKEN.** With the root config committed and no plugin,
`wrangler deploy --dry-run` (wrangler 4.152.0, the production
version) fails, and `wrangler dev` fails the same way:

```
✘ [ERROR] Build failed with 3 errors:
  ✘ Could not resolve "#tanstack-router-entry"
  ✘ Could not resolve "#tanstack-start-entry"
  ✘ Could not resolve "tanstack-start-manifest:v"
```

Those are *virtual modules* — names that exist only inside the
Vite build graph, injected by the TanStack Start Vite plugin.
Wrangler's own bundler, handed the raw `src/server.ts`, can never
resolve them. No config content fixes this; it is structural.
Because committing a root config is also what switches automatic
configuration **off**, a config-only merge would have stopped
auto-setup from installing the plugin and broken **every**
subsequent Builds deploy until reverted (failed builds promote
nothing, so the site would have kept serving the then-current
version — but the deploy pipeline would be down). Shipping it
anyway ("let the deploy decide") was taken off the table on this
evidence.

**W1 — root config + the plugin wired in: PROVEN.** With
`@cloudflare/vite-plugin` imported in `vite.config.ts`
(`cloudflare({ viteEnvironment: { name: "ssr" } })` before
`tanstackStart(...)` — Cloudflare's documented TanStack Start
recipe), the production build shape appears locally: 2,299 ssr
modules transformed (production log: 2,297), the plugin emits
`node_modules/.nitro/vite/services/ssr/wrangler.json` (the
*redirect* config wrangler follows: the plugin-built bundle as the
entry, the guard present in it, assets pointing at
`.vercel/output/static`, `compatibility_flags: []`, no bindings),
`wrangler deploy --dry-run` exits 0 reading exactly 699 asset
files, and every behavior probe passes. The owner then approved
the re-scope ("Re-scope #228: plugin wiring + root config",
2026-10-22). W1 *is* this PR's change; the branch reproduction
numbers are under Verification below.

## The change

1. **`package.json` + `package-lock.json`** — two new
   devDependencies, exact pins: `@cloudflare/vite-plugin`
   `1.64.0` and `wrangler` `4.152.0`. These are the same two
   packages automatic configuration already installs invisibly
   into every production build today (download-audited 2026-10-22:
   Cloudflare official, OSV zero known vulnerabilities for both).
   Making them real, pinned devDependencies makes that install
   visible and deterministic: Builds' `npx wrangler deploy` now
   resolves the repo-pinned wrangler 4.152.0 instead of fetching
   a floating one. Version topology as installed: the root
   `wrangler` is **4.152.0** (what `npx wrangler` and the deploy
   run); the plugin carries its own nested `wrangler` **4.151.0**
   (its pinned dependency, inside its `^4.151.0` requirement) for
   its internal use. Dev/build-time only — neither package ships
   in the deployed Worker bundle. The lockfile diff looks large
   (555 package entries vs 396) because the current npm writes
   out entries the older lockfile left implicit; verified
   name-by-name against the old lock: **no existing package was
   removed and none changed version** — three packages gained an
   additional nested copy inside the new trees, and everything
   else added is the two new trees themselves (including the
   per-platform workerd/sharp binaries).
2. **`vite.config.ts`** — one import and one plugin call, exactly
   as W1 proved, with a comment explaining why: the plugin builds
   the `ssr` environment into the deployable Worker shape and
   writes the config the deploy follows. Scoped to the `ssr`
   environment so the client build and the GitHub Pages build are
   not its concern (verified under build:pages below). Nothing
   else in the file changes.
3. **`wrangler.jsonc`** (new, repo root) — the deploy config,
   deliberately mirroring what automatic configuration generated,
   with the one value that is the fix:

   | Key | Value | Evidence |
   |---|---|---|
   | `$schema` | `node_modules/wrangler/config-schema.json` | the generated config |
   | `name` | `"meridian"` | generated config; live worker |
   | `main` | `"src/server.ts"` | **the fix** (owner ruling, 2026-10-22) |
   | `compatibility_date` | `"2026-10-19"` | generated config + script settings + live version |
   | `observability` | `{ "enabled": true }` | generated config |

   No `assets` key: the plugin's emitted redirect config supplies
   the assets directory (`.vercel/output/static`), W1-proven. No
   bindings and no vars: the live version has none.

## Verification on this branch (all run 2026-10-22)

**`npm run build`** (the Builds build command) — exit 0. Module
counts 2253 client / **2299 ssr** / 164 nitro-phase (pristine
main: 2253 / 330 / 2124 — the ssr phase is now the plugin build).
The emitted `node_modules/.nitro/vite/services/ssr/wrangler.json`
declares: `configPath` → this repo's `wrangler.jsonc`,
`main: "index.js"` (the plugin-built bundle; the guard string
appears 3× in it), `compatibility_date: "2026-10-19"`,
`compatibility_flags: []`, `assets.directory` →
`.vercel/output/static`, `no_bundle: true`,
`observability.enabled: true`, and **every binding list empty**
(kv, r2, d1, queues, durable objects, services, ratelimits —
all `[]`/`{}`).

**`npx wrangler deploy --dry-run`** (wrangler **4.152.0**) —
exit 0:

```
Using redirected Wrangler configuration.
 - Configuration being used: "node_modules/.nitro/vite/services/ssr/wrangler.json"
 - Original user's configuration: "wrangler.jsonc"
✨ Read 699 files from the assets directory .../.vercel/output/static
Total Upload: 45636.62 KiB / gzip: 6083.73 KiB
No bindings found.
```

699 is production's own asset-read number (build log, 2026-10-22)
and W1's. (A plain file count of the assets directory shows 682 —
wrangler's read count is the deploy-relevant invariant and it
matches across the production log, W1, and this branch.) The
quoted Total Upload is from this worktree's run; a fresh-checkout
reproduction printed 45,636.63 KiB / gzip 6,083.76 KiB — the
~0.01–0.03 KiB wobble is the absolute checkout path embedded in
the bundle, not a content difference (every other byte count in
this document matched the reproduction exactly).

**`npx wrangler dev`** — the full probe set, all as expected:

| Probe | Result |
|---|---|
| `GET /` | 200, `text/html`, `Cache-Control: public, max-age=0, must-revalidate` (the WI-18 header, live in the new entry), CSP + HSTS + `X-Frame-Options: DENY` |
| `GET /_serverFn/` | **404**, JSON `{"error":"not found"}`, `Cache-Control: no-store`, security headers |
| `GET /_serverFn/abc` | **404** |
| `OPTIONS /_serverFn/x` | **405** |
| `POST /api/contact` `{}` (with Origin) | **400**, body **byte-identical** to live production's 400 body |
| `GET /assets/<hashed>.js`, `/flags.json`, `/sw.js`, `/audio/storyteller/greet-01.mp3` | 200 each |

Production control taken the same hour: `/_serverFn/` still
answers 500 live — nothing in this PR is deployed yet.

**Client bundle** — `.vercel/output/static`: 682 files /
68,779,742 bytes vs pristine main's 681 / 68,779,718. The entire
delta is one new 24-byte file, `.assetsignore` (content:
`wrangler.json` / `.dev.vars` — wrangler's own marker telling the
assets uploader to skip those names if they ever land in the
directory). No client asset changed.

**`npm run build:pages`** (the GitHub Pages mirror build; the
re-scope's named unknown) — exit 0, and the **published**
artifact is unchanged in substance. The Pages workflow
(`.github/workflows/pages.yml`) publishes only `dist/client`
(it copies `_shell.html` to `index.html`/`404.html` inside it).
Baseline (pristine) vs this branch, per-file size comparison of
`dist/client`: 682 → 683 files, 68,792,419 → 68,792,725 bytes
(**+306 bytes total**), consisting of exactly:

- the same inert `.assetsignore` (+24 bytes; GitHub Pages does
  not read it), and
- `_shell.html` +282 bytes: with a real ssr build present, the
  prerendered shell's embedded router manifest now also lists
  the home (`/`) route and its preloads. Every asset the shell
  references is byte-identical, the fallback markup is
  unchanged, and the shell's size/hash already vary between
  pristine runs (it embeds per-run stream ids).

The unpublished build intermediate `dist/server` grows
(107 → 250 files, 43.2 MB → 96.4 MB): in Pages mode the ssr
environment now produces the full plugin build instead of the
small prerender-only bundle. It is never uploaded — but Pages
CI builds will spend the extra seconds and disk; recorded here
so the panel judges it with eyes open.

**Full gates** — `npx tsc --noEmit` clean; `npm test`:
scripts **809 pass / 0 fail** (9 skipped), src **1479 pass /
0 fail** — both exactly the pristine-main baselines;
`node scripts/lint-cards.mjs` **GATE PASSED**. Tests that
notice the change: no test reads `package.json`; one test
(`scripts/grok-pwa-plugin.test.mjs`) reads `vite.config.ts` and
passes. The rate-limiter test that checks
`config/cloudflare/meridian.wrangler.toml` passes (11/11) —
that file's edit in this PR is comments only.

## Deliberate omissions

- **No `compatibility_flags`** — in particular **no
  `nodejs_compat`**. The live flag set is empty (API-read), the
  production build log contains zero occurrences of it, and
  `/api/contact` answers 400 correctly without it (proven again
  above). Whether the contact endpoint's `process.env` path wants
  the flag when delivery is activated belongs to issue #220 —
  it is not smuggled in here on presumption.
- **No rate-limit bindings.** The two `[[ratelimits]]` blocks
  recorded in `config/cloudflare/meridian.wrangler.toml` are
  *not* copied into the root config by this PR: production runs
  with no bindings today, and adding them changes the contact
  endpoint's runtime behavior — a separate, recorded follow-up.
  That file's pointer comment is updated in this PR to name the
  root config as the blocks' future home.

## The previews unknown

The PR-branch Builds trigger deploys with `npx wrangler preview`.
Nothing in this work exercised that command, so whether branch
previews now work is **untested**. It shares the bundling path
that the config-only experiment proved broken without the plugin
and that this PR fixes — so there is reason to expect previews
to work for the first time — but that is inference, not
evidence. The first PR-branch Builds run after this merges will
show it; branch Builds failures remain owner-ruled non-blocking
(2026-10-15) either way.

## Risks, rollback, and the honest limit

Local proof here is strong — the same build command, the same
wrangler version, the same asset count, and the full probe set —
but **the first real Workers Builds deploy after merge is the
deciding test**: the Builds workspace is Cloudflare's, not this
machine. If that deploy fails or the post-merge probes fail, the
rollback is reverting this one PR: the root config, the plugin
wiring, and the two devDependencies go away together, and
automatic configuration resumes on the next deploy — the exact
behavior production runs today. A failed build promotes nothing,
so the site keeps serving the current version while the revert
is made.

## Post-merge verification (still owed)

Run by Chitti after the owner merges and the Builds deploy
completes; real output posted on this PR:

1. `/build-meta.json` shows the merge commit's buildId (the new
   deploy is the live one).
2. The Builds build log for that deploy: the deploy followed the
   committed config (redirect to the emitted ssr config naming
   `wrangler.jsonc` as the original user configuration; no
   automatic-configuration regeneration), asset read in the 699
   class.
3. The probe set against production: `/_serverFn/` → 404 JSON
   `no-store` + security headers; `/_serverFn/abc` → 404;
   `OPTIONS /_serverFn/x` → 405; `/` → 200 with the security
   headers and the HTML Cache-Control; `POST /api/contact` →
   400 with the same body as before; one hashed asset,
   `/flags.json`, `/sw.js`, one storyteller MP3 → 200.
4. The WI-19 status line in
   `docs/reviews/2026-10-22-serverfn-server-entry.md` flips to
   its DONE form (date, deploy, where this output was posted).

## Files in this PR

- `wrangler.jsonc` — new; the root deploy config (the fix).
- `vite.config.ts` — one import + the `cloudflare(...)` plugin
  call, with an explanatory comment.
- `package.json`, `package-lock.json` — the two pinned
  devDependencies.
- `docs/reviews/2026-10-22-wrangler-config-entry.md` — this
  record.
- `docs/reviews/2026-10-22-serverfn-server-entry.md` — the #229
  document: dashboard steps marked superseded, status flipped
  (history preserved, per its own supersede obligation).
- `config/cloudflare/meridian.wrangler.toml` — pointer comment
  corrected to the root config (comments only; `[[ratelimits]]`
  blocks untouched).
- `BRANCH_STATUS.md` — this branch's record.

Only the owner merges.
