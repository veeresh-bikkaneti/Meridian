# BRANCH_STATUS — fix/228-root-wrangler-config

**Branch:** `fix/228-root-wrangler-config`
**Base:** origin/main @ `d77ee52` (PR #230 merge)
**State: CURED — awaiting panel re-vote.** Panel round 1 voted
NOT READY (BLOCK ×1 / NITS ×10 / APPROVE ×1 / DevEx PASS-WITH-NITS);
the cure round below addresses every item. All gates below are
green and every proof was reproduced on this branch (numbers in
`docs/reviews/2026-10-22-wrangler-config-entry.md`). The fix is
not called done until the post-merge production verification
(Acceptance, below) passes with verbatim results posted on the PR
after the owner merges and Workers Builds deploys.

**This branch closes issue #228 (WI-19b).**

## Owner ruling trail (Veeresh, all 2026-10-22, quoted where quotation marks appear; items 2, 4, 6 summarized)

1. **"18 go (plain value), 19a now, 19b as follow-up"** — WI-19
   path (a) (a dashboard edit to the Builds-generated config)
   first; path (b) (a root `wrangler.jsonc` in the repo) as the
   follow-up, filed as issue #228.
2. The path-(a) investigation then proved the dashboard edit
   **does not exist**: the owner's own screenshot showed Settings
   > Build has no Wrangler-configuration editor and no `main`
   field, and the Builds API exposes the identical field set. The
   generated config lives only inside the build workspace.
3. **"Start #228 now — it IS the fix"** — path (b) promoted to
   now, on the corrected premise that the 404 can only come from
   #228 itself.
4. The first build crew **stopped at a checkpoint**: a root
   config alone was unproven (nothing in the plain build reads
   it), and proving it needed the two packages Cloudflare's
   auto-setup installs invisibly — a download, which needs its
   audit and the owner's word first.
5. **"Approve both installs — prove it locally first"** — the
   audited pins (`wrangler@4.152.0`, `@cloudflare/vite-plugin@1.64.0`;
   Cloudflare official, OSV zero vulns) approved for a scratch
   worktree.
6. The experiments came back: **W2 (config alone) FAILED**
   (wrangler's bundler cannot resolve TanStack Start's
   plugin-injected virtual modules — a config-only deploy is
   structurally broken), **W1 (config + plugin wiring) PASSED**
   end-to-end locally.
7. **"Re-scope #228: plugin wiring + root config"** — this PR's
   scope, approved 2026-10-22 18:04 CDT.

## What this fixes, and why

Production has never run the repo's server entry `src/server.ts`:
Workers Builds' automatic configuration generates a config per
build whose `main` is TanStack Start's default entry, which loads
`src/start.ts` but never `src/server.ts`. PR #222's S5
server-function guard therefore never runs live — `/_serverFn/`
answers an unhandled 500 (live-verified again 2026-10-22).

This PR commits the deploy config to the repo — a root
`wrangler.jsonc` with `main: "src/server.ts"` — and wires
`@cloudflare/vite-plugin` into `vite.config.ts` (ssr environment
only), because the experiments proved the config cannot deploy
without the plugin build behind it. The two packages become real,
exact-pinned devDependencies: the install auto-setup did
invisibly is now visible and deterministic.

## Files

- `wrangler.jsonc` (new) — the root deploy config.
- `vite.config.ts` — one import + the `cloudflare(...)` call,
  with an explanatory comment; nothing else.
- `package.json`, `package-lock.json` — the two pinned
  devDependencies (`@cloudflare/vite-plugin` 1.64.0,
  `wrangler` 4.152.0).
- `docs/reviews/2026-10-22-wrangler-config-entry.md` (new) —
  the full record: root cause, W2/W1 experiments, inventory,
  verification numbers, omissions, previews unknown, rollback.
- `docs/reviews/2026-10-22-serverfn-server-entry.md` — the #229
  document: dashboard steps marked SUPERSEDED, status flipped to
  delivered-by-this-PR (history preserved).
- `config/cloudflare/meridian.wrangler.toml` — pointer comment
  corrected to the root config (comments only; `[[ratelimits]]`
  untouched; its test passes 11/11).
- Cure round (panel round 1): `workers/crash-report/README.md`
  (dev command now passes `-c wrangler.toml` explicitly),
  `README.md` (Deployment names the Worker deploy shape),
  `scripts/grok-pwa-plugin.test.mjs` (one added test pinning
  `cloudflare(...)` before `tanstackStart(...)`), plus
  comment/record corrections in `vite.config.ts`,
  `wrangler.jsonc`, `config/cloudflare/meridian.wrangler.toml`,
  and both review docs.
- `BRANCH_STATUS.md` — this record.

## Gates (2026-10-22, this branch)

- `npm run build` — exit 0; 2253 / **2299** / 164 modules; the
  emitted ssr `wrangler.json` names this repo's `wrangler.jsonc`,
  carries the guard (×3), `compatibility_flags: []`, every
  binding list empty, assets → `.vercel/output/static`.
- `npx wrangler deploy --dry-run` (wrangler **4.152.0**) —
  exit 0; **Read 699 files** (production's number); Total Upload
  ≈45,636.6 KiB (varies by a few bytes with the checkout path
  length); **No bindings found.**
- `npx wrangler dev` probes — `/` 200 + security headers + HTML
  Cache-Control; `/_serverFn/` and `/abc` **404** JSON `no-store`;
  OPTIONS **405**; `POST /api/contact` **400** with a body
  byte-identical to live production's; hashed asset, `/flags.json`,
  `/sw.js`, storyteller MP3 all 200.
- `npm run build:pages` — exit 0; the published artifact
  (`dist/client` only, per `.github/workflows/pages.yml`) is
  unchanged in substance: +306 bytes total (an inert 24-byte
  `.assetsignore` + the shell's manifest now listing the home
  route). The unpublished `dist/server` intermediate grows
  (43.2 → 96.4 MB) — recorded in the review doc.
- Client bundle (production build) — `.vercel/output/static`
  68,779,742 bytes vs main's 68,779,718: the only delta is the
  same 24-byte `.assetsignore`. No client asset changed.
- `npx tsc --noEmit` — clean.
- `npm test` — scripts **809 pass / 0 fail** (9 skipped), src
  **1479 pass / 0 fail** — exactly the main baselines.
  Cure round: scripts **810 pass / 0 fail** (the +1 is the new
  plugin-ordering test), src **1479 pass / 0 fail**;
  `npx tsc --noEmit` clean; rate-limiter test 11/11.
- `node scripts/lint-cards.mjs` — **GATE PASSED**.
- Cure-round smokes — `npm run dev` (port 8080) and
  `npm run preview` (port 8081): both started, `GET /` 200 with
  the app HTML, `GET /_serverFn/` 404 JSON `no-store`, both
  stopped cleanly. No plugin gate needed — the plugin works
  as-is in dev and preview.

## Panel round 1 + cure (2026-10-22)

Round 1 verdict: **NOT READY — BLOCK ×1 / NITS ×10 /
APPROVE ×1 / DevEx PASS-WITH-NITS.** The BLOCK: the root
`wrangler.jsonc` shadows `workers/crash-report/wrangler.toml`
for wrangler commands run inside that directory (find-up,
filename priority), so the crash worker's documented
`npx wrangler dev` silently targeted the main worker. Cured:
the documented command passes `-c wrangler.toml` explicitly,
and the review doc records the shadowing rule. The nits —
vite.config comment accuracy, TOML tense, #229-doc tense,
dev/preview smokes, README deploy shape, pin-bump and
stale-artifact notes, rollback reasoning, post-merge probe
hardenings (mirrored in Acceptance below), the previews
unknown made explicit (Unresolved, below) — are all cured in
the cure-round commits. **State: cured — awaiting panel
re-vote.**

## Acceptance (still owed after merge)

Chitti runs, and posts verbatim on the PR, once the owner merges
and the Builds deploy completes:

1. `/build-meta.json` buildId = the merge commit.
2. The deploy's build log: the committed config governed (no
   automatic-configuration regeneration), asset read in the 699
   class; the deploy's emitted (redirect) config pasted verbatim
   into the verification record on the PR.
3. Production probes: `/_serverFn/` → 404 JSON `no-store` +
   security headers; `/_serverFn/abc` → 404; OPTIONS → 405;
   `/` → 200 + headers + HTML Cache-Control; `POST /api/contact`
   → 400, same body; hashed asset, `/flags.json`, `/sw.js`, one
   storyteller MP3, one region chunk, and one GeoDetective clue
   file → 200. The storyteller MP3 probe also asserts
   `Content-Type: audio/mpeg` and a `Cache-Control` header. The
   served `/sw.js` `VERSION` line equals the merge buildId, with
   no literal `__BUILD_ID__` placeholder left.
4. The WI-19 status line in the #229 document flips to DONE
   (date, deploy, where the output was posted).
5. Keep the distinction straight while verifying: Workers
   observability (the config's `observability.enabled`,
   platform-side Worker logs) is not the client crash telemetry
   (the separate crash-report pipeline).

## Unresolved

- **Previews untested:** the branch Builds `npx wrangler preview`
  path has never been exercised. The first PR-branch Builds run
  after merge shows whether it works; non-blocking per the
  owner's 2026-10-15 ruling.

**Rollback:** revert this PR — root config, plugin wiring, and
devDependencies leave together and automatic configuration
resumes on the next deploy (today's production behavior). A
failed build promotes nothing, so the site keeps serving the
current version while the revert is made.
