# BRANCH_STATUS — veer-c/adoring-volta-ql18ja

**State: DRAFT — docs-only (Tier 0). Adds the owner's ARCHETYPE v3.0 "law"
verbatim as `docs/ops/ARCHETYPE_law.md`. No source, test, config or
`AGENTS.md` is touched. Awaiting the owner's word on how it sits beside the
Constitution and `agent-council-protocol.md` (Pending, below).**

**Base:** origin/main @ `62b960a` (PR #229's merge), 0 behind. Owner's choice
(2026-10-22): "Adopt as governing law + commit". The text is committed
byte-for-byte as pasted, with its `{{YOUR_TASK}}` CONFIG placeholders unfilled:
they are a template slot to fill per task.

## Done
- [x] `docs/ops/ARCHETYPE_law.md` added, verbatim (70 lines; key rules spot-checked).
- [x] Gates, run on the `62b960a` tip: `npx tsc --noEmit` clean · `npm test`
      scripts **808 pass / 0 fail / 9 skip**, src **1,473 pass / 0 fail** ·
      `node scripts/lint-cards.mjs` **GATE PASSED** · `npm run build:pages` green
      (no tracked file dirtied by the build).
- [x] Not run: Playwright E2E. The change has no source surface, and
      protocol §6 scopes Playwright to "the specs that cover the changed surface".

## Pending — the owner's call
- [ ] **Where the law sits.** This PR does not edit `AGENTS.md` or
      `docs/ops/agent-council-protocol.md`. In this repo the protocol says "the
      Constitution in `AGENTS.md` governs throughout", which I read as the law's
      own "System Invariants" tier. Replace, sit beside, or fold in is undecided.
- [ ] **Overlaps with the existing protocol** (read from both files, not assumed):
      - Seats: the law adds Councilor D (Historian) and a Layer-3 execution team;
        protocol §1 has Chair + A/B/C only, requires C to be a separate agent,
        and fixes models (opus Chair, sonnet/haiku councilors).
      - Tiers: law T1/T2/T3 are **risk**-based (security/payments/auth);
        `AGENTS.md` Tier 0/1/2 are **scope**-based and convene a council only at Tier 2.
      - Budget: law caps `MAX_TOKENS: 15k/task`; protocol §3 controls cost with the
        tier gate and sets no cap.
      - Manifest: law has "Scoped Files (max 3)" and Token GRANTED/DENIED;
        protocol §5 has protected files, "max +/- N lines" and `AUTH_RUN_TDD_IMPLEMENTATION`.
      - Versioning: the law's Loop 3 mutates to "Archetype v1.1"; versioned
        copies would collide with Constitution rule 2 (no duplicate files).
- [ ] An earlier, different "ARCHETYPE v3.0" (seats A-E, 7 phases, per-tier token
      budgets 6000/3000/1500) was pasted in the same session. It is superseded by
      the owner's choice above and is **not** committed here.

---

*The record below is for `fix/serverfn-server-entry` (shipped as #229). It is kept
unmodified for history; this branch's own record is the section above.*

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
