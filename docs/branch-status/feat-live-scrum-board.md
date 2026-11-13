# BRANCH_STATUS — feat/live-scrum-board

**Branch:** `feat/live-scrum-board` · **Base:** main `8eb34cb`
(main moved one commit after the snapshot — the math subject screen,
PR 434; it touches none of this branch's files, and the branch was
re-verified on the new base before publishing.)
**Task:** Owner's brief 2026-11-13: a live 3D scrum board and feature map
at `/board`, live from GitHub PRs with a snapshot fallback, plus a
grown-ups feature-request form posting to Discord via the Worker.
Tier 2 (new feature, 3+ files, API + security surface). Targeted tests
only per the owner's 2026-11-11 testing rule; CI carries the full suite.
Do not merge — the owner reviews with a second agent and merges himself.

## Plan (task capsule)

1. `src/board/snapshot.json` — the 46 stories / 8 lanes / done-path from
   the owner's story-map.html (provided 2026-11-13).
2. `src/board/board-data.ts` — status rule, GitHub fetch, 10-minute
   localStorage cache with ETags, snapshot/cache fallback. Pure + tested.
3. `src/routes/board.tsx` — scrum board (3 columns), feature map section
   (lazy three.js or list view), done path, feature-request form.
   noindex, no links from Home/menus/game, phone-first, list view is the
   default under reduced motion / no WebGL / toggle.
4. `src/board/feature-map.tsx` — three.js 0.160 scene, dynamic
   `import("three")` only (home-globe pattern), static frame under
   reduced motion, canvas aria-hidden.
5. `POST /api/feature-request` — built on the contact handler's code
   (body cap, origin, honeypot, rate limiter, Discord webhook checks are
   imported, not copied; contact's `corsOrigin`/`json` gained `export`
   for this), own `FEATURE_DISCORD_WEBHOOK_URL` secret, Turnstile
   siteverify, mention/link stripping, `allowed_mentions: {parse: []}`.
6. CSP: `https://api.github.com` added to `connect-src` only, in both
   `public/_headers` and `src/lib/security-headers.ts` (they must stay
   identical), with an assertion in `scripts/security-headers.test.mjs`.
7. flags.json: `featureRequestEndpoint` added (contact's pattern);
   `getFeatureRequestEndpoint` / `getFeatureTurnstileSiteKey` in
   `src/lib/flags.ts`.

## Findings that differ from the brief's assumptions

- **No Turnstile exists in this repo** (searched tree + sources: no site
  key, no siteverify, contact uses honeypot + origin + rate limits).
  The server-side verification and the client widget support are new
  code in `src/lib/feature-request/`. The CSP does not allow
  `challenges.cloudflare.com`, and per the brief's "add nothing
  broader" rule this PR does not widen it — enabling the widget in prod
  needs the owner's OK to add that host to `script-src`/`child-src`.
- `home-loading-orbs` exists only as a test; the three.js pattern was
  taken from `src/components/home-globe.tsx` (dynamic import, reduced
  motion, WebGL failure fallback).
- `src/lib/security-headers.ts` is the CSP source of truth and its test
  fails on drift from `public/_headers`, so both files were edited
  together (the brief named only `_headers` + the scripts test).

## Graph (for the integrator)

- Adds node: route `/board` (depends-on: snapshot, GitHub pulls API).
- Adds node: endpoint `/api/feature-request` (depends-on: contact
  handler code, rate-limiter; governed-by: FEATURE_DISCORD_WEBHOOK_URL
  secret, owner setup).

## Status

- Done: implementation + targeted tests on the `8eb34cb` base —
  script checks 14 pass, unit/handler tests 145 pass,
  `tsc --noEmit` clean, `build:pages` green, entry JS gzip 319,716 B
  against the 323,865 B budget.
- Playwright not run: the build environment's browser refuses to
  launch ("Hatch WebGL domain policy is required for browser
  startup"); the pre-existing credits spec fails identically, so this
  is an environment limit, not a regression. No screenshots; the
  board spec ships in the PR for CI.
- Published as a draft PR; not merged.
- Next step: owner's second-agent review, then owner merge.
- Open questions: Turnstile CSP widening (above); whether the owner
  wants `FEATURE_RATE_LIMITER` bindings instead of reusing contact's.
- Ruled out: adding FEATURE_DISCORD_WEBHOOK_URL to wrangler
  `secrets.required` (a required secret would break deploys until the
  owner sets it; the endpoint must instead answer "not open yet").
