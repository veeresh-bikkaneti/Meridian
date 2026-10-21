# BRANCH_STATUS — feat/contact-activation-wiring (contact activation code, prepared; NOT for merge yet)

**State: PREPARED AND PUSHED. Holding. Nothing is probed, deployed, merged or
configured. Not opened as a PR.** Only the owner merges.

- **Base:** PR #207's tip `0430c93` (branch `fix/review-p0-p2-kids-privacy-ux`),
  brought in by a **merge into this branch** (merge commit `0ef18ac`). Nothing
  was ever pushed to #207's branch. This branch is based on #207; it is not
  part of it.
- **Owner direction (2026-10-21):** #207's scope is frozen. Sequence: #207 merges
  on the owner's word → deploys → **probe A1 runs first** → this branch rebases
  onto the new `main`, goes through its own full review, the owner merges →
  parked smoke → owner sets the secret → Discord smoke → owner flips
  `contactEndpoint`. The activation follow-up is owned by tinkabot after #207
  merges. Runbook: `docs/contact-activation.md`.

## Files touched (15, relative to #207's tip, listed below)

| File | What |
| --- | --- |
| `src/lib/contact/runtime-env.server.ts` (new) | the one reader of the worker's runtime env (`globalThis.__env__`, then `cloudflare:workers`) |
| `src/lib/contact/contact-handler.server.ts` | `readContactRuntimeEnv()` reads worker env first, `process.env` fallback; production origin on the allowlist; honeypot silent 200 before the origin refusal; `GET` readiness; Origin comment corrected |
| `src/lib/contact/rate-limiter.server.ts` | binding lookup now goes through the shared env reader (behaviour unchanged) |
| `src/lib/contact/contact-readiness.ts` | same reader as the route; `--url` mode; "sink selected" wording; sanitised output |
| `src/lib/contact/contact-handler.server.test.ts` | new tests (worker-env, origin, honeypot ordering, GET readiness, size cap) |
| `src/lib/contact/contact-readiness.test.ts` | readiness tests (shell vs `--url`, hostile answers, non-OK) |
| `scripts/contact-readiness.mjs` + `.test.mjs` | `check:contact [-- --url <origin>]`, strict argument parsing |
| `scripts/contact-smoke.mjs` + `.test.mjs` | `--parked` and wired smoke |
| `scripts/entry-fingerprint-probe.mjs` + `.test.mjs` | probe A1 |
| `config/cloudflare/meridian.wrangler.toml` | config record: nodejs_compat note, secret name, probe-result placeholder |
| `docs/contact-activation.md` (new) | the runbook |
| `BRANCH_STATUS.md` | this file |

`docs/reviews/2026-10-21-p0-p2-remediation.md` is **not** touched (it is #207's
doc under panel review). Its item 3 still says the handler reads `process.env`;
the activation PR should correct that line when it lands.

## Assumptions the code makes (probe-dependent — NOT proven)

None of these is confirmed until probe A1 runs on a deployed #207. If the probe
shows the Nitro entry serving, the design changes; do not treat these as fixed.

1. `src/start.ts` middleware runs on worker responses (security headers on
   `/api/contact` and the HTML). Baseline on production before #207: no
   security headers on `/`, `GET /api/contact` = 404.
2. `POST /api/contact` is mounted and answered by this handler. The probe's
   decisive request is a POST with a bad Origin: **403 JSON** = live;
   404 / SPA HTML / 405 = not live.
3. The worker env is reachable via `globalThis.__env__` (Nitro) or
   `import("cloudflare:workers")`. Only the `__env__` source is unit-tested;
   the `cloudflare:workers` import cannot run on Node. If neither works the sink
   stays noop (fails safe), and `check:contact --url` shows it.
4. `process.env` is kept as a fallback on the worker too, not only locally.
   Whether it can be dropped depends on the probe.
5. `PRODUCTION_ORIGIN` is hard-coded as `https://meridian.knowledgetest.workers.dev`
   (a public hostname). Same-origin is still checked first.
6. Local rehearsal (Node preview of the Nitro build) passes the probe and the
   parked smoke; that says nothing about the Cloudflare serving path.

## Differences from the activation spec

| Spec | This branch |
| --- | --- |
| Read the secret from `cloudflare:workers` env; `process.env` only as a local-dev fallback | Reads `globalThis.__env__` first, then `cloudflare:workers`, then `process.env` — and the `process.env` fallback also runs on the worker (see assumption 4) |
| Workers Rate Limiting binding is the real limiter | Binding is used when present; the in-memory limiter is still the always-on floor, so the binding is not *required* by the code. The runbook recommends adopting it before the secret is set |
| Smoke with the form off: 403, 413, 429, NoopSink cases | `scripts/contact-smoke.mjs --parked` does exactly those (plus honeypot); wired mode (`--yes-send-real-messages`) is the later Discord test |
| Probe: `curl -sI /` for headers; POST `/api/contact` with a bad Origin | Same two signals, but via GET (not HEAD) on `/` and `/privacy`, plus the POST; verdict logic is in the script |
| — (not in spec) | New public `GET /api/contact` → `{ "sink": "discord" \| "noop" }`, name only. Added so production can be checked without seeing the secret. Reviewers flagged that it tells anyone whether delivery is wired; **owner may veto** and the readiness check can then rely on the smoke alone |
| — (not in spec) | A filled honeypot gets a silent 200 even with a missing/refused Origin (earlier brief) |
| Before activation: a "don't include personal info" note, and stripping emails and phone numbers from message text | **NOT on this branch.** The grown-up gate exists (#207). The note and the stripping are not implemented; tinkabot's follow-up |
| Ship dark; owner flips `contactEndpoint`; delete the GitHub copy of the secret | Runbook covers both; nothing here flips or deletes anything |

## Gates on this tip (VM)

tsc clean · `npm test`: scripts 836 tests / 827 pass / 0 fail / 9 skipped,
src 1481 pass / 0 fail · `lint-cards` GATE PASSED · `build:pages` green.
Unit tests only for the contact code: the repo's Playwright harness serves
static files, so the route has no Playwright coverage. Independent reviews
(round 1): Security & Privacy no BLOCK; Reality Checker NEEDS WORK, all
findings fixed except the accepted `GET` exposure and the honeypot response
shape. Round 2 on the final diff is still owed after rebase.

## Pending

- [ ] #207 merges on the owner's word, deploys; probe A1 runs; record the raw result in `config/cloudflare/meridian.wrangler.toml` and here.
- [ ] Rebase/merge onto the new `main`; resolve `BRANCH_STATUS.md`; re-run gates.
- [ ] Safeguards before activation: personal-info note; email/phone stripping.
- [ ] Full review round 2; owner merges.
- [ ] Parked smoke → owner sets secret → Discord smoke → owner flips → public wording and the two e2e pins (`contact-parked-note`, "from players") updated in the same change.
