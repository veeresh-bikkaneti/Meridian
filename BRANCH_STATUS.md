# BRANCH_STATUS — fix/228-root-wrangler-config

**Branch:** `fix/228-root-wrangler-config`
**Base:** origin/main @ `d77ee52` (PR #230 merge)
**State: BUILT + PROVEN LOCALLY — awaiting the full panel review,
then the owner's merge word.** All gates below are green and every
proof was reproduced on this branch (numbers in
`docs/reviews/2026-10-22-wrangler-config-entry.md`). The fix is
not called done until the post-merge production verification
(Acceptance, below) passes with verbatim results posted on the PR
after the owner merges and Workers Builds deploys.

**This branch closes issue #228 (WI-19b).**

## Owner ruling trail (Veeresh, all 2026-10-22, quoted)

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
- `BRANCH_STATUS.md` — this record.

## Gates (2026-10-22, this branch)

- `npm run build` — exit 0; 2253 / **2299** / 164 modules; the
  emitted ssr `wrangler.json` names this repo's `wrangler.jsonc`,
  carries the guard (×3), `compatibility_flags: []`, every
  binding list empty, assets → `.vercel/output/static`.
- `npx wrangler deploy --dry-run` (wrangler **4.152.0**) —
  exit 0; **Read 699 files** (production's number); Total Upload
  45,636.62 KiB; **No bindings found.**
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
- `node scripts/lint-cards.mjs` — **GATE PASSED**.

## Acceptance (still owed after merge)

Chitti runs, and posts verbatim on the PR, once the owner merges
and the Builds deploy completes:

1. `/build-meta.json` buildId = the merge commit.
2. The deploy's build log: the committed config governed (no
   automatic-configuration regeneration), asset read in the 699
   class.
3. Production probes: `/_serverFn/` → 404 JSON `no-store` +
   security headers; `/_serverFn/abc` → 404; OPTIONS → 405;
   `/` → 200 + headers + HTML Cache-Control; `POST /api/contact`
   → 400, same body; hashed asset, `/flags.json`, `/sw.js`, one
   storyteller MP3 → 200.
4. The WI-19 status line in the #229 document flips to DONE
   (date, deploy, where the output was posted).

**Rollback:** revert this PR — root config, plugin wiring, and
devDependencies leave together and automatic configuration
resumes on the next deploy (today's production behavior). A
failed build promotes nothing, so the site keeps serving the
current version while the revert is made.
