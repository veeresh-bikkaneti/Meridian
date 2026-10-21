# BRANCH_STATUS — feat/contact-activation-wiring (contact activation, steps 1-2 prepared)

**State: PREPARED, NOT OPEN FOR MERGE. Gate WI-0 has NOT cleared: PR #207 is
still open (unmerged), so `main` has no contact code and production has not
deployed it.** This branch is stacked on #207's head (`95cfa64`); it is pushed
for safekeeping and gets a PR against `main` only after #207 merges. Nothing
here has been probed, deployed, merged or configured.

Governing words (Veeresh, 2026-10-21): "Adopt B — start the cure round".
Runbook: `docs/contact-activation.md`.

## The five steps

| # | Step | State |
| --- | --- | --- |
| 0 | Entry gate: #207 merged and `meridian` deployed from new `main` | **BLOCKED** — #207 open |
| 1 | Probe A1: which server entry serves production | script + tests ready, **not run** (runs only after step 0) |
| 2 | Wiring PR (this branch) | code + tests + docs done, unreviewed, unmerged |
| 3 | Owner sets the worker secret | step sheet written; owner action |
| 4 | Smoke with the form OFF | script + tests ready, **not run** (needs step 3) |
| 5 | Flip `contactEndpoint` | owner's word only; one line, rollback written |

## What this branch changes (step 2 scope, nothing else)

- `runtime-env.server.ts` (new): the one place that finds the worker's `env`
  (`globalThis.__env__`, then `cloudflare:workers`). The contact webhook, the
  origin list and the rate-limit bindings all read through it; `process.env`
  stays only as a fallback. `readContactRuntimeEnv()` is the single reader for
  the route and the readiness check.
- Origin gate: production origin on the default allowlist; a filled honeypot
  gets a silent `200` even with a missing/refused Origin; real messages with a
  bad Origin still get `403`.
- Readiness: `check:contact` uses the same reader and says whose config it
  checked; `check:contact -- --url <origin>` asks the live worker via the new
  `GET /api/contact` → `{ "sink": "discord" | "noop" }` (name only). Anything
  unexpected is NOT confirmed, exit 1.
- `scripts/entry-fingerprint-probe.mjs` (step 1) and
  `scripts/contact-smoke.mjs` (step 4), each with a test that proves it
  discriminates.

Not changed: what the form collects, rate-limit thresholds, retention, the
gate, `ContactSink`, game code, dependencies.

## Done

- [x] Unit tests: `src/lib/contact/*.test.ts` 60/60; rate-limiter tests unchanged (11/11)
- [x] Discrimination vs the parked #207 handler: five new handler tests fail
      there (worker-env secret, worker-env origins, production origin,
      honeypot-before-origin, GET readiness). Caveat: the old handler lacks the
      `PRODUCTION_ORIGIN` export, so the check needs a one-line shim; without
      it the whole test file fails at import.
- [x] Smoke (`scripts/contact-smoke.test.mjs`, 9 tests): every check is shown
      to fail when its one behaviour is broken (no-Origin, foreign Origin,
      over-size, three honeypot variants, 429 absent / edge 429 / no
      Retry-After, recovery); a parked or look-alike run stops before any POST.
- [x] Probe (`scripts/entry-fingerprint-probe.test.mjs`, 12 tests): verdict
      keys on the worker-produced `/api/contact`; mixed pages, 404/5xx, failed
      requests, SPA-fallback HTML and a broken control are never green.
- [x] `scripts/contact-readiness.test.mjs`: unknown or mistyped arguments exit 2
- [x] Independent reviews, round 1 (fresh agents given only the diff):
      Security & Privacy: no BLOCK, no secret exposure; fixed the smoke
      guard (`--yes-send-real-messages`, abort before POST), readiness output
      sanitising, probe header allowlist, honeypot log flood, Origin wording.
      Reality Checker: NEEDS WORK; fixed `--url=` falling through to the shell
      check, probe verdict ignoring `/api/contact`, "will be delivered"
      overclaim, vacuous size-cap test, always-pass smoke checks, doc claims.
      Open owner decision from review: adopt the binding rate limiter BEFORE
      the secret is set (`docs/contact-activation.md`, "What the secret exposes").
- [x] Docs: runbook, config record, remediation-record note

## Pending

- [ ] Owner: merge #207 (WI-0). Then the coordinator records the deployed commit.
- [ ] Probe A1, run by the Platform Engineer and re-run by the Reality Checker.
      If the Nitro entry serves: escalate to the owner as its own item first.
- [ ] Open the wiring PR against `main`; full 12-role review; owner's per-PR merge word.
- [ ] Owner configuration (runbook step 3), then smoke (step 4), then the flip (step 5).
- [ ] Round 2 of the independent reviews on the final diff, after #207 merges and
      this is rebased/opened against `main`.
