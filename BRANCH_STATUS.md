# BRANCH_STATUS — fix/review-p0-p2-kids-privacy-ux

**State: READY FOR PEER REVIEW. Committed locally; not pushed, and no PR is open yet.**
Base: `origin/main 4ef6875` (rebased 2026-10-21 on the owner's order, after PR #206 merged; previously merged up to `b430d28`; the work started from the live build `157d215`). Full write-up:
`docs/reviews/2026-10-21-p0-p2-remediation.md`.

The previous record (ops/telemetry-phase1-deploy, PR #204) is in git
history at `f9fa7e4:BRANCH_STATUS.md`.

## Done
- [x] P0-1 Microsoft Clarity removed (code, env typing, Pages workflow)
- [x] P0-2 Google Analytics removed entirely (owner decision: COPPA first). Optional cookieless Cloudflare Web Analytics via `VITE_CF_BEACON_TOKEN`
- [x] P0-3 `/privacy` page, linked from the footer and the For grown-ups card
- [x] P1-4 PWA base path: manifest `./`, `sw.js` derives BASE from its own URL (+ test under both bases)
- [x] P1-5 "Begin exploring" starts a Globe round at the picked difficulty
- [x] P1-6 Easy curation (`src/game/easy-curation.ts`, rung fallback, min pool 25)
- [x] P1-7 Prefer the Full map: a 2 GB reading with a clean WebGL probe stays Full
- [x] P2-8/9 `public/_headers`: CSP + security headers + cache policy (+ test)
- [x] P2-10 Gate strikes persist across close/reopen (cooldown can't be dodged)
- [x] P2-11 "Take the tour" re-entry in the footer
- [x] Crash telemetry coarsened (no memory/cores; screen bucket; rounded DPR)
- [x] `/contact` page behind the math gate + `POST /api/contact` on the main `meridian` worker, with no third worker (validation, 4 KB cap, salted-hash rate limit, honeypot, `ContactSink` with `NoopSink` default, `DiscordWebhookSink` only with `CONTACT_DISCORD_WEBHOOK_URL`)
- [x] Docs: README, handbook ch01/ch07, observability, scout policy, scoring contract, security-headers, remediation doc

## Pending / owner actions
- [ ] `public/_headers` overlaps with open PR #203 (perf), which adds the same file. Whichever lands second merges the two sets into one file (see the remediation doc)
- [ ] Remove the GA/Clarity env vars from Cloudflare Workers Builds + GitHub secrets
- [ ] Verify the `_headers` are live after deploy (`docs/security-headers.md`)
- [ ] After the normal `meridian` deploy: smoke-test `/api/contact`, then add `contactEndpoint` to `flags.json`. Later, set `CONTACT_DISCORD_WEBHOOK_URL` on `meridian` with a separate channel (never the crash `DISCORD_WEBHOOK_URL`)
- [ ] Playwright specs for `/privacy`, `/contact`, Begin exploring, tour re-entry (P3)
