# BRANCH_STATUS — fix/review-p0-p2-kids-privacy-ux

**State: PR #207 open. Review follow-ups (request-changes round) pushed; `origin/main` (with PR #203) merged in; rebased onto `4ef6875` (PR #206) on the owner's order, 2026-10-21.**
Base: `origin/main f9fa7e4` (rebased; the work started from the live build `157d215`), then
`origin/main 41e1121` (PR #203, perf) and then `b430d28` (PR #208, docs) **merged** in on 2026-10-21. They were merges, not rebases, so there was no force-push. The final step onto `4ef6875` WAS a rebase (owner-ordered, after PR #206 merged): the two conflicts were `BRANCH_STATUS.md` and `public/_headers`, both resolved to this branch's own versions — the `_headers` below is byte-identical to the merge-resolved file, and this file is the merge-resolved record with only this base paragraph updated.
Full write-up: `docs/reviews/2026-10-21-p0-p2-remediation.md`.

The previous records are in git history: ops/telemetry-phase1-deploy (PR #204)
at `f9fa7e4:BRANCH_STATUS.md`, and perf/performance-tuning (PR #203) at
`41e1121:BRANCH_STATUS.md`. The #203-landed header (PR #208) is at `b430d28:BRANCH_STATUS.md`.

#203 merge conflicts:
- `public/_headers` (add/add): kept #207's version. It is a superset: the
  `/*` security block plus no-cache rules plus #203's F1 `/assets/*` immutable rule and its three
  `! Cache-Control` detach carve-outs, text-identical. Nothing from #203 was lost.
- `BRANCH_STATUS.md` (both merges): this branch's version, updated (repo convention).
- Open PR #212 (explicit Cache-Control for the carved assets + HTML) also edits
  `public/_headers` and will conflict with this file. Whichever lands second must union the two:
  keep this branch's `/*` security block and #212's detach-plus-explicit-set carve-outs, and pick ONE
  Cache-Control per path for `/flags.json` and `/`.

## Done
- [x] P0-1 Microsoft Clarity removed (code, env typing, Pages workflow)
- [x] P0-2 Google Analytics removed entirely. Owner (2026-10-21): "I deleted clarity and ga4 from cloudflare account" — both IDs deleted from the `meridian` worker's Workers Builds variables, and the repo's GitHub Actions secrets deleted the same day (done and verified). Optional cookieless Cloudflare Web Analytics via `VITE_CF_BEACON_TOKEN`
- [x] P0-3 `/privacy` page, linked from the footer and the For grown-ups card
- [x] P1-4 PWA base path: manifest `./`, `sw.js` derives BASE from its own URL (+ test under both bases)
- [x] P1-5 "Begin exploring" starts a Globe round at the picked difficulty
- [x] P1-6 Easy curation (`src/game/easy-curation.ts`, rung fallback, min pool 25)
- [x] P1-7 Prefer the Full map: a 2 GB reading with a clean WebGL probe stays Full
- [x] P2-8/9 `public/_headers` + worker middleware (`src/start.ts`) from one source (`src/lib/security-headers.ts`) (+ drift test)
- [x] P2-10 Gate strikes persist across close/reopen (cooldown can't be dodged)
- [x] P2-11 "Take the tour" re-entry in the footer
- [x] Crash telemetry coarsened (no memory/cores; screen bucket; rounded DPR)
- [x] `/contact` page behind the math gate + `POST /api/contact` on the main `meridian` worker, with no third worker (validation, 4 KB cap, salted-hash rate limit, honeypot, `ContactSink` with `NoopSink` default, `DiscordWebhookSink` only with `CONTACT_DISCORD_WEBHOOK_URL`)
- [x] Docs: README, handbook ch01/ch07, observability, scout policy, scoring contract, security-headers, remediation doc

## Pending / owner actions
- [x] `public/_headers` overlap with PR #203: resolved in the merge above
- [x] Remove the GA/Clarity env vars from Cloudflare Workers Builds + GitHub secrets — DONE and verified 2026-10-21 (see the line above and remediation-doc decision 1)
- [ ] Verify the `_headers` are live after deploy (`docs/security-headers.md`)
- [ ] Contact activation is PARKED (path B) — do NOT smoke-test-and-flip as if the GitHub-side state were sufficient. Record correction (verified 2026-10-21): a GitHub **repo** secret named `CONTACT_DISCORD_WEBHOOK_URL` exists (added by the owner 2026-10-21) but **nothing reads it**; the handler expects a **worker runtime secret** on `meridian`. Activation (follow-up chain in the cure-round section below) sets it on the worker with a separate channel (never the crash `DISCORD_WEBHOOK_URL`), then deletes the GitHub secret — one secret, one store
- [ ] Add the `[[ratelimits]]` blocks from `config/cloudflare/meridian.wrangler.toml` to the `meridian` worker config (free; optional, with an in-memory fallback)
- [ ] Delete contact messages in Discord within 90 days (`docs/contact-rate-limiting.md`, `/privacy`)
- [ ] P3 hardening (static CSP hashes, Easy first-run default) is stacked on branch `fix/review-p3-hardening` (no PR yet)

## Cure round (2026-10-21) — panel NOT READY → path B

- **Panel verdict: NOT READY** on tip `e361937` (voted pre-rebase; the content was carried to `3250f02`). The privacy posture was sound; the blocks were (a) contact delivery cannot work in production as shipped while docs/copy implied it does, and (b) record defects.
- **Owner's adoption, verbatim (2026-10-21): "Adopt B — start the cure round"** — the Senior Architect's path B from the panel review: this PR lands with delivery honestly PARKED (form off, docs truthful); activation is a tracked follow-up filed the day this PR merges.
- **Cure items and dispositions:**
  1. *Truthfulness (delivery parked, everywhere)* — DONE: remediation doc states delivery is PARKED and qualifies every "works when the secret is set" claim (a); `/privacy` rewritten for the parked state — form off, future-tense delivery, server transit disclosed, reply-to-to-Discord disclosed, retention = manual deletion once resolved within 90 days, gate still described as a check that keeps kids out, NOT verified parental consent (b); footer line qualified to "…collected from players" (c); `/contact` carries a plain parked note and no longer promises "we read every message" (d).
  2. *Readiness-check honesty* — DONE (built, none existed): searched package.json, `scripts/`, `src/lib/contact/`, docs and workflows — no readiness/delivery check existed in the tree. Added `evaluateContactReadiness` (`src/lib/contact/contact-readiness.ts`) + CLI `npm run check:contact` (`scripts/contact-readiness.mjs`): with no secret it prints "contact delivery: NOT configured (parked)" and exits 1. Pinning tests in `src/lib/contact/contact-readiness.test.ts` cover no-secret → not-configured and the strict-discord.com → Discord-sink-selected assertion for the follow-up. Sink selection, env reading, allowlist and honeypot untouched.
  3. *Off-state completeness* — VERIFIED 2026-10-21: `public/flags.json` (source) carries **no** `contactEndpoint`; with no endpoint, `sendContact` returns not-configured and the page says "isn't switched on yet" (pinned by the E2E spec). The footer and the For grown-ups card link to `/contact`, whose page now presents the parked state plainly at the top; no surface presents `/contact` as live.
  4. *Citations* — DONE: remediation-doc decision 1 cites the owner's actual words + the verified deletions; decision 4 cites the path-B adoption above; decisions 3 and 5 relabelled team rationale; decision 2 relabelled a code change; the "(owner decision: COPPA first)" gloss on the P0-2 line above replaced with the citable record; the same fixes applied to the matching code comments (`privacy.tsx`, `contact.tsx`, `contact-handler.server.ts`, `contact-form.ts`).
  5. *Doc cures* — DONE: retired GA4/Clarity ID values scrubbed from the remediation doc; GA/Clarity deletion TODOs marked DONE (verified 2026-10-21); the stale TODO-2 remedy marked implemented by this PR (`src/start.ts` + `src/lib/security-headers.ts`); the fused 403/200 sentence split into two accurate sentences; `docs/observability.md` device-facts prose rewritten to the coarse buckets its own table states, and its stale deploy note replaced with the real flow (bindings ride with the version upload; `cf-version.py` ops helper outside the repo); `docs/contact-rate-limiting.md` gained the `cf-connecting-ip` trust assumption + the shared "unknown" fallback bucket; the `CONTACT_DISCORD_WEBHOOK_URL` record corrected in the remediation doc and in the Pending item above (GitHub repo secret exists, nothing reads it; worker runtime secret is what the handler expects).
  6. *This section* — DONE (this record).
- **Follow-up chain after merge (committed next step, in order):**
  1. Probe which server entry actually serves on the deployed worker (Nitro `.vercel/output` vs `dist/server` start entry) — if Nitro serves, the `start.ts` security-headers middleware is dead code TODAY and fixing that takes priority over contact wiring.
  2. Set `CONTACT_DISCORD_WEBHOOK_URL` as a worker secret on `meridian` (plus optionally the `[[ratelimits]]` blocks), then delete the same-named GitHub repo secret.
  3. Wiring PR: env read via runtime bindings (not `process.env`), production origin allowlisted or endpoint same-origin, honeypot silent-200 reordered ahead of the origin gate, readiness check asserts the Discord sink.
  4. Post-deploy smoke with the form still off.
  5. Only then add `contactEndpoint` to `flags.json`.
