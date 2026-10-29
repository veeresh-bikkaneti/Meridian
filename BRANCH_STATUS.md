# BRANCH_STATUS — fix/220-contact-wiring

- **Branch:** `fix/220-contact-wiring`
- **Base:** `origin/main` at `6abe3e6` (Package B, PR #283, merged).
- **Prior record:** this file previously carried the Package B branch
  record; that work merged as PR #283 and its full record lives in that
  PR and in git history.
- **State:** **READY FOR PANEL** (2026-10-29). All build units landed
  and pushed; gates green except the contact E2E, which is recorded
  below as lock-blocked (NOT run — no claim made). Issue #220: wire the
  Contact Us form's delivery (root `wrangler.jsonc` bindings) and make
  the page honest about delivery — SPEC §3 + §4 of
  `~/workspace/meridian-contact-activation/SPEC.md`. Animations are a
  separate follow-on PR and are NOT in this branch.

## Task capsule

```text
TASK / requested outcome:
  Implement SPEC §3 (wiring) + §4 (honesty states). When this branch is
  done it is green (typecheck + unit suite + build + contact E2E) and
  pushed, ready for the review pipeline. No merge, no deploy.

Interpretations considered and selected reading:
  - Env route: the SPEC §3.1 "pick one" is settled by the owner's
    2026-10-21 ruling — read the secret from the Worker runtime bindings
    (cloudflare:workers env / globalThis.__env__), with process.env ONLY
    as a local-dev fallback. nodejs_compat is NOT added.
  - Handler order: the mandated move is honeypot silent-200 BEFORE the
    origin gate (SPEC §3.2, §10.1, §12 all pin exactly that). The
    existing anti-flood rate limiter keeps its position ahead of the
    honeypot check: SPEC §3.2's prose lists rate limits later in the
    pipeline, but the verdictable surfaces (§10.1 tests, §12 checklist)
    pin only honeypot-vs-origin, and moving the limiter would change
    the counted-request arithmetic the full-stack E2E verifies (the
    honeypot submission is a counted request today). Flagged here so
    the panel can challenge the reading with full information.
  - Thank-you copy: §5's new copy arrives with the animation PR. This
    PR keeps the existing thank-you wording and only gates WHEN it
    shows (stored:true), per the two-track dispatch (wiring+honesty
    first, animations second).

Tier and rationale:
  Tier 2 surface (security/privacy, 3+ files), built under the
  owner-approved SPEC as the design of record plus the owner's
  2026-10-21 env-route ruling. Full review pipeline still gates the PR;
  merge only on the owner's word.

Done condition / scenarios / evidence:
  - Root wrangler.jsonc declares the CONTACT_DISCORD_WEBHOOK_URL secret
    (secrets.required, name only) + both ratelimits (72071 @ 3/60s,
    72072 @ 10/60s); comments describe the wired state.
  - Runtime env wins over process.env in readContactEnv /
    readContactRuntimeEnv; crash-secret isolation preserved.
  - Honeypot filled + bad/missing Origin -> silent 200; empty honeypot
    + bad origin -> 403.
  - Message text has emails + phone numbers stripped before delivery
    (kids' safeguard); replyTo is NOT stripped (it is the reply path).
  - Page: thank-you + draft clear ONLY on stored:true; stored:false
    shows the honest not-delivered state (existing not-configured copy)
    and preserves the draft verbatim.
  - Gates: npx tsc --noEmit, npm test, node scripts/lint-cards.mjs,
    npm run build + build:pages, contact E2E under the shared lock.

Files and interfaces in scope:
  wrangler.jsonc; src/lib/contact/contact-handler.server.ts (+ tests);
  src/lib/contact/contact-form.ts (+ tests); src/routes/contact.tsx;
  src/lib/contact/rate-limiter.server.ts (one stale comment line);
  src/routes/privacy.tsx (header comment only — body copy checked,
  see Notes); tests/e2e/grownups-privacy-contact.desktop.spec.ts
  (Part 4b honesty expectations); README.md (contact paragraph);
  BRANCH_STATUS.md.
  Out of scope: config/cloudflare/meridian.wrangler.toml (record only,
  no build reads it), workers/ (crash worker untouched), animations,
  flags.json, any secret value.

Verification contract (gates + isolation needs):
  AGENTS.md quality gates; E2E sequentially under flock
  ~/workspace/.e2e.lock against the built artifact.

Assumptions, risks, unknowns:
  - secrets.required is wrangler's config-level declaration of a secret
    binding by name (verified against wrangler 4.152.0's bundled
    config-schema.json). Whether a Builds deploy then preserves the
    dashboard-set value is exactly what SPEC §3.4 verifies post-merge;
    this PR cannot prove it from code.

Approvals needed (exact action + owner), checker, escalation:
  - OWNER STEP after merge + deploy (SPEC §3.3): Veeresh re-sets
    CONTACT_DISCORD_WEBHOOK_URL as an encrypted runtime secret on the
    meridian worker, then §3.4 verification runs (probe -> stored:true,
    message eyeballed in Discord, real-form submission, re-deploy
    probe). Until then the form correctly shows the honest
    not-delivered state instead of the old false thank-you.
  - Checker: the standing review panel on the final tip (not the
    builder).
```

## Status

- [x] Baseline: contact unit tests green on origin/main (43/43).
- [x] wrangler.jsonc — secret declaration + ratelimits + comments
      (`c09cec4`).
- [x] Handler — env precedence (runtime bindings first) (`5c4e6c2`).
- [x] Handler — honeypot before origin gate (`5c4e6c2`).
- [x] Handler — email/phone stripping in message text + tests
      (`5c4e6c2`, `b0a6c56`). NOT previously implemented — validateContact
      only stripped control chars; stripContactDetails is new.
- [x] Page — honesty states + draft preservation (+ sendOutcome helper)
      (`3c67e1b`).
- [x] E2E — Part 4b updated to the honesty contract; Part 3b's
      client-visible expectation updated with it (the honeypot 200 has
      no `stored` flag, so the client honestly treats it as
      not-delivered and keeps the text; the drop is proven server-side)
      (`c663be3`).
- [x] Docs — README contact paragraph; privacy header comment;
      rate-limiter comment line (`efe3edf`).
- [x] Gates — tsc / npm test / lint-cards / builds (numbers below).
- [ ] Gates — contact E2E: **NOT RUN — lock-blocked** (see Verification
      record). Must be run before merge, once the shared E2E lock frees.
- [x] Pushed to origin (standing authorization; this branch only).

## Verification record (builder-run, 2026-10-29, on the final code tip)

| Check | Result |
|---|---|
| Baseline contact unit tests (origin/main, pre-change) | 43/43 pass |
| `npx tsc --noEmit` | PASS — clean, exit 0 |
| `npm test` (scripts suite) | 861 tests: 850 pass / 0 fail / 11 skipped |
| `npm test` (src suite) | 1821/1821 pass, 0 fail |
| Contact unit files (handler + form + rate-limiter + readiness) | 50/50 pass (43 baseline + 7 new/updated) |
| `node scripts/lint-cards.mjs` | GATE PASSED |
| `npm run build` (Worker build) | PASS — exit 0 |
| Emitted SSR `wrangler.json` (the deploy shape) | Verified: carries `secrets.required: ["CONTACT_DISCORD_WEBHOOK_URL"]`, both `ratelimits` (72071 @ 3/60, 72072 @ 10/60), `configPath` → root `wrangler.jsonc` |
| `npm run build:pages` | PASS — exit 0 |
| `npm run test:worker` | Not applicable — no `workers/` changes (AGENTS.md requires it only for PRs touching `workers/`) |
| Contact E2E (`tests/e2e/grownups-privacy-contact.desktop.spec.ts`) | **NOT RUN — lock-blocked.** The shared `~/workspace/.e2e.lock` was held continuously by the Package C crew's full-suite Playwright run (from `~/workspace/meridian-challenge-c/repo`, 41+ min elapsed at last check). Two attempts by this builder (an initial ~17 min queue, then a bounded `flock -w 600`) never acquired the lock. Per the owner's instruction this is recorded, not waited out. The spec's updated Part 4b/3b expectations are unproven in a browser until this runs. |

## Notes for the panel

- The existing unit test "readContactEnv and readContactRuntimeEnv read
  from process.env and globalThis.__env__ (process.env wins)" pinned the
  OLD precedence. The owner's 2026-10-21 ruling reverses it (runtime
  bindings first, process.env = local-dev fallback), so that test's
  expectations and title were updated to the new contract — a mandated
  behavior change, not a weakening: both sources are still exercised,
  and a new test asserts the bindings-route value is the one that wires
  the sink.
- Privacy page (§11 check): the BODY copy already describes the wired
  state ("Discord receives the message…", retention, server keeps
  nothing) and matches post-fix reality — no body change. Two flags:
  (1) its header comment still described delivery as PARKED/future
  tense — comment updated for consistency, body untouched; (2) the body
  says the server "hands on" the message without mentioning that emails
  and phone numbers typed into the message are stripped first — the
  stripping only removes data, so no promise is broken, but the owner
  may want a sentence about it in a later copy pass.
- security.txt (SPEC §9): this fix is what closes the dead-end; the
  file itself is unchanged, per spec.
