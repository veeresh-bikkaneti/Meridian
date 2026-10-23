# BRANCH_STATUS — docs/232-verification-record

**Branch:** `docs/232-verification-record`
**Base:** origin/main @ `d15e191` (PR #232 merge)
**State: BUILT — awaiting panel review and the owner's merge
word.** Docs only: this PR carries the close-out record for
PR #232 plus the round-2 panel's recorded follow-ups. No code
changes. It supersedes the previous contents of this file (the
`fix/228-root-wrangler-config` branch record, whose history
lives on PR #232 and in
`docs/reviews/2026-10-22-wrangler-config-entry.md`).

## Where main stands (2026-10-23)

- **Main is `d15e191`.**
- **PR #230 (WI-18, explicit Cache-Control on server-rendered
  HTML) MERGED** 2026-10-22 (squash `d77ee52`) on the owner's
  word and **production-verified** — probes passed on every
  path class; **issue #227 CLOSED**.
- **PR #232 (WI-19b, root `wrangler.jsonc` + Cloudflare Vite
  plugin wiring) MERGED** 2026-10-23 (squash `d15e191`) on the
  owner's word, after the round-2 panel re-vote voted **READY**
  (APPROVE ×5 · APPROVE-WITH-NITS ×7 · BLOCK ×0 · DevEx
  PASS-WITH-NITS; verdict comment on PR #232). **Issue #228
  CLOSED by the merge.**
- **PR #232 post-merge verification PASSED** (full record:
  PR #232, comment 6358078391) — evidence summary below.

## Verification evidence for #232 (summary)

- Workers Builds build `691c3bf7` — **success**; deployed
  version `b5de3350`; `/build-meta.json` buildId = `d15e191`.
- Build log (verbatim lines): "Using redirected Wrangler
  configuration — Original user's configuration:
  `wrangler.jsonc`"; "Read 699 files" from
  `.vercel/output/static`; Total Upload 45,680.03 KiB. The
  committed root config governed the deploy — no
  auto-generated config was used.
- Live probes: `/_serverFn/` → **404**
  `{"error":"not found"}` + `no-store` + the full security
  header set (the pre-merge unhandled **500 is gone**);
  `/_serverFn/abc` → 404; `OPTIONS /_serverFn/` → 405;
  `/`, `/privacy` and the 404 page carry the WI-18 cache value
  (`public, max-age=0, must-revalidate`) + the security set;
  `POST /api/contact` → 400 with an Origin header (parity with
  pre-merge behavior); `/flags.json`, `/sw.js` → `no-cache`;
  served `sw.js` VERSION = `meridian-d15e191` (no `__BUILD_ID__`
  placeholder); storyteller MP3 → `audio/mpeg` + the carved
  cache value; clue JSON → 200; hashed asset → `immutable`.

## Files in this PR

- `BRANCH_STATUS.md` — this record: main brought current
  (supersedes the #232 branch record that previously occupied
  this file).
- `docs/reviews/2026-10-22-serverfn-server-entry.md` — the
  #229 document: its WI-19 status line flips to **DONE**
  (delivered by PR #232, merged `d15e191`, verified
  2026-10-23; evidence summary + pointer to the PR #232
  verification comment). For the record: at PR #232's own
  merge time the line read **TO BE DELIVERED BY THE WI-19b
  PR** — it was never marked delivered before verification.
  The document's history (superseded banners, dashboard-step
  record) is unchanged.
- `docs/reviews/2026-10-22-wrangler-config-entry.md` — the
  #232 review document: header status → final (panel READY on
  the cured tip, merged `d15e191`, verification passed, with
  the PR-comment pointer); a #234 pointer added to the
  config-shadowing paragraph; the Gates bullets now lead with
  the current numbers (scripts 810 / src 1479); the
  post-merge checklist is marked EXECUTED with outcomes.
- `worker/observability/README.md` — the documented log-tail
  command now selects this worker's own config explicitly
  (`npx wrangler tail -c wrangler.toml`, run from
  `worker/observability` after the documented one-time copy
  of `wrangler.toml.example`; the directory ships no committed
  `wrangler.toml`). A bare `npx wrangler tail` there is the
  same shadowing class as the #232 round-1 BLOCK: the root
  `wrangler.jsonc` wins by filename priority and tail would
  attach to the main worker. Mitigants: this receiver is
  undeployed/reference-only and `tail` is read-only.

## Gates (this branch)

- `npx tsc --noEmit` — clean.
- `npm test` — scripts **810 pass / 0 fail** (9 skipped), src
  **1479 pass / 0 fail** — the main baselines.
- `node scripts/lint-cards.mjs` — **GATE PASSED**.
- Docs only — no build re-run required.

## Unresolved / standing queue

- **#234 (open, non-blocking):** the crash worker's documented
  local boot — `npx wrangler dev -c wrangler.toml` in
  `workers/crash-report` — *selects* the right worker, but
  workerd refuses to boot it on the pre-existing
  `ANOMALY_MIN_COUNT` named export
  (`workers/crash-report/src/index.ts`). Not caused by #232
  (byte-identical on main); production unaffected — the worker
  deploys by direct API upload and is live and healthy.
  Recorded here so nobody misattributes the boot failure to
  #232.
- **#233 (open, non-blocking):** post-build assertion test —
  pin the emitted ssr `wrangler.json` fields + the guard
  literals in the ssr bundle.
- **PR #219:** cure-2 (four one-liners) is with its author →
  round-3 panel vote → owner's merge word.
- **Memos #215 (Esri licensing) / #216 (on-device AI):**
  panel accuracy review pending.
- **Wave-2 code #225 / #217:** full pipeline each.
- **PR #197:** evidence cure outstanding (failure
  classification on branch and main).
- **PR #187:** dependabot vite bump — anytime slot.
- **Previews untested** (carried from the #232 record): the
  branch Builds `npx wrangler preview` path remains
  unexercised; non-blocking per the owner's 2026-10-15
  ruling.

Only the owner merges.
