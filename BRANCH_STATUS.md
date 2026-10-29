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

---

<!-- Record from origin/main (3aa16b5) kept byte-identical below. -->

# BRANCH_STATUS — feat/challenge-mc2-package-c

- **Branch:** `feat/challenge-mc2-package-c`
- **Base:** `origin/main` at `6abe3e6` (Package B, PR #283, merged + live). If the external End-game PR lands first, this branch rebases and this file resolves keeping both records accurate.
- **State:** **READY — panel re-vote on the cured tip `c62378f` is 13/13 approve-family, 0 BLOCK. PR open; NO MERGE without the owner's per-PR word.** Package C of all-editions friend challenges: the (e) review-surface creation entry. Owner order 2026-10-29: "Build C".
- **Governing manifest:** `.council/manifests/2026-10-28-challenge-all-editions.md` (unchanged; the Package C note lives in `docs/feature-flags.md`, per the Package A/B convention).
- **Prior record:** this file previously carried Package B's branch record; Package B merged as PR #283 at `6abe3e6`, and its full record lives in that PR and in git history. Package A merged as PR #282 at `063de0c`.
- **Task capsule:**
  - TASK / outcome: manifest §1(e) — a deck-level "Challenge a friend — pick a map" entry on the review surfaces, opening the shipped challenge-region mini-picker, dealing a fresh five from the picked region; NEVER the deck's cards (manifest §1(e)/§3 privacy rule — the design council's Chair ruling was never-the-deck; a labelled "Beat my misses" opt-in was deferred to the owner as an open question, recommendation NO, and is still open).
  - Tier: 2 (new surface under a signed manifest; privacy-sensitive). Process: manifest already signed; TDD → gates → panel on the final tip → PR. No merge without the owner's per-PR word.
  - Interpretations recorded (narrow/safe, per the AGENTS.md ambiguity rule):
    1. "Review deck / review-complete" surfaces = the home Review card + the ReviewComplete screen — the same pair the 2026-10-28 reset manifest (D10/D16) treated as the deck's two surfaces, and the pair the BRAINSTORM §1(e) sketch names ("list row under the due-count + secondary button at review-complete"). Never per-card: nothing is added to the review run's aim/reveal phases (Package B's entries stay suppressed on review runs).
    2. Home-card visibility mirrors the reset control's D10 rule (deck total > 0 — due or caught-up states), in-flow in the text column under the due line, above the card's stretch CTA layer. ReviewComplete visibility is flag-only (the entry is not a deck operation; the deck may be empty there).
    3. Both entries reuse what already shipped: the home card reuses Choose's existing `onChallenge` handler (the mini-picker menu, card-tap sound included); ReviewComplete threads a new GameApp handler that exits the finished review exactly like Editions and opens the same menu, re-checking the flag at tap (Package B's click-atomic precedent) and degrading to the plain exit if the flag flipped off.
  - Files in scope: `src/components/game-app.tsx` (Choose card entry, ReviewComplete entry, Play/PlayLoaded prop threading, GameApp handler), `src/components/home-v5.css` (one opener class beside `.reset-history-open`), `src/game/challenge.ts` (the label constant), `src/game/challenge.test.ts` (label + privacy contract), `tests/e2e/friend-challenge-mc2-review.desktop.spec.ts` (new), `docs/feature-flags.md`, `README.md`, this file.
  - Protected (untouched): `src/game/data/**`, `package-lock.json`, the mc1 decoder path + mc1 test blocks, `tests/e2e/friend-challenge.desktop.spec.ts` (frozen), GeoDetective (`src/game/loop/**`) and Cold Trail (`src/game/coldtrail/**`).
  - Done condition: entry visible on both review surfaces with the flag on and absent with it off (E2E); the deal is proven as a SOURCE rule — dealt ids come from the picked region's catalog, never from the deck (cross-region E2E proof: Texas-seeded deck → Nebraska deal, ids ⊆ Nebraska catalog ∧ disjoint from the deck; unit construction pin). Per manifest §3 this prevents one-tap disclosure of the deck; a same-region fresh deal can coincidentally include a catalog place that is also in the deck — a catalog deal, not a deck disclosure. Preview + share path completes; all 5 gates green; panel approves the final tip.
  - E2E environment (Package B's recorded note): Playwright's bundled chromium-1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — /opt/meta-chromium refuses headless launch on this VM.
- **Stage log:**
  - [x] Stage 0 — clone @ `6abe3e6`, branch created, npm ci, manifest + AGENTS.md read, surfaces mapped.
  - [x] Stage 1 — TDD: label test RED with the predicted signature (`does not provide an export named 'CHALLENGE_REVIEW_LABEL'`); privacy contract written as a construction pin (the behavioural proof is the E2E); E2E RED on the unmodified build (both entry tests fail on the missing entry; the flag-off guard passes; the seeded-Texas-deck review flow itself completes, proving the harness).
  - [x] Stage 2 — Build: `CHALLENGE_REVIEW_LABEL` in challenge.ts; home-card entry in both deck branches (`.review-challenge-open`, mirroring the reset opener's geometry); ReviewComplete secondary-button entry; `handleReviewChallenge` in GameApp (Editions exit + mini-picker in one state batch, flag re-read at tap) threaded GameApp → Play → PlayLoaded → ReviewComplete, gated on PlayLoaded's boot-authoritative flag read. tsc clean; challenge unit suite 37/37.
  - [x] Docs: `docs/feature-flags.md` Package C paragraph + README challenge row extended (manifest file itself untouched, per the A/B convention).
  - [x] Stage 3 — Gates: tsc clean; npm test green (src 1816/1816, scripts 850 pass/0 fail); worker 85/85; lint-cards GATE PASSED; build:pages green. E2E on the code tip: the new spec 3/3; adjacent batch (review-deck, reset-history, mc2-create) green after flake triage — mc2-create :130/:197 failed under VM contention and passed on sequential re-runs (branch + main), package-b :257 likewise; admin1-narrow :61/:97 fail identically on unmodified main `6abe3e6` (pre-existing, disclosed in the PR). The long-tail suite did not complete a full pass in this contended shared-VM window (two full runs reaped mid-flight); every spec touching the changed surfaces ran green — coverage stated exactly in the PR body.
  - [x] Stage 4 — Panel round 1 on code tip `f399af1` (12 seats + DevEx, personas verbatim from ~/.codex/agents/*.toml): **NOT READY — 4 APPROVE, 7 APPROVE-WITH-NITS, 2 BLOCK.** Both BLOCKs are record findings, verified by the coordinator against the primary sources before curing: (1) Reality Checker + DevEx — the never-deck rule was misattributed to an "owner ruling OQ4"; the manifest cites only Open Questions 1 and 3, and BRAINSTORM §5.6 records a Chair ruling with the "Beat my misses" opt-in deferred to the owner as an open question (the error came from the build brief and was propagated into comments/docs — owned here). (2) DevEx — README's "never your missed places, which stay private" overclaimed the manifest §3 source rule as an outcome guarantee. Cure (docs/comments only, zero behaviour change): re-attribution in challenge.ts, challenge.test.ts, game-app.tsx, the E2E spec header, feature-flags.md, this file; README reworded to the source claim. The first commit's message carries the same misattribution; it is not rewritten (no force-push) — the PR body carries the erratum. Remaining nits are follow-up class (stale picker-error one-liner, shared-testid pinning comment, focus-ring parity, caught-up-state E2E variant).
  - [x] Stage 4b — Panel re-vote on the cured tip `c62378f`: **READY — 6 APPROVE, 7 APPROVE-WITH-NITS, 0 BLOCK.** Both round-1 BLOCK seats (Reality Checker, DevEx) confirm their blocks cured exactly, verified against the primary sources. This status update is the only delta after the re-voted tip (Package B precedent).
  - [x] Stage 5 — PR opened. NO MERGE.
