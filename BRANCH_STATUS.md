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
- [x] P0-2 Google Analytics removed entirely (owner decision: COPPA first). Optional cookieless Cloudflare Web Analytics via `VITE_CF_BEACON_TOKEN`
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
- [ ] Remove the GA/Clarity env vars from Cloudflare Workers Builds + GitHub secrets
- [ ] Verify the `_headers` are live after deploy (`docs/security-headers.md`)
- [ ] After the normal `meridian` deploy: smoke-test `/api/contact`, then add `contactEndpoint` to `flags.json`. Later, set `CONTACT_DISCORD_WEBHOOK_URL` on `meridian` with a separate channel (never the crash `DISCORD_WEBHOOK_URL`)
- [ ] Add the `[[ratelimits]]` blocks from `config/cloudflare/meridian.wrangler.toml` to the `meridian` worker config (free; optional, with an in-memory fallback)
- [ ] Delete contact messages in Discord within 90 days (`docs/contact-rate-limiting.md`, `/privacy`)
- [ ] P3 hardening (static CSP hashes, Easy first-run default) is stacked on branch `fix/review-p3-hardening` (no PR yet)
