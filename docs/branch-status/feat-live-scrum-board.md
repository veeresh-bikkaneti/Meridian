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

## Upgrade — 2026-11-13 (owner's word in chat, same PR)

Owner asked for: a draggable 3D dependency map (modern three.js +
motion), and a separate page showing issues and PRs mapped to stories.
Also cures the independent review's blocker B1 and minor S7, and the
stale PR 434 copy in S6.

- **Step 0 (data reality check).** No structured dependency data exists:
  every story has only `lane/title/status/waitsOn/owner/prs/inferred`,
  and there is no `dependsOn`/`blockedBy` anywhere in the repo. The one
  mechanical signal is a `waitsOn` that explicitly names a PR number;
  mapped back through the stories' own `prs` lists that yields exactly
  8 edges (5 waiting stories). Prose waits naming no PR ("Pennant port",
  "Scene engine", educator sign-off…) were NOT turned into edges — that
  would need a looser matcher. A complete graph needs a structured
  `dependsOn` per story in the snapshot/story-map source.
- **Map (`feature-map.tsx`).** OrbitControls via dynamic import (three
  stays in its lazy chunk; a separate OrbitControls chunk) — damped
  rotate / pan / zoom. Dragging a story block moves it and its lines
  follow; clicking a block highlights its transitive chain (ancestors +
  descendants) and dims the rest, with a plain-text summary under the
  canvas naming the selected story and its explicit PR waits. Edges are
  directed lines with arrow cones, laid out so chains read left to
  right (inside a lane: dependency depth, then status, then snapshot
  order). Turntable removed — no auto-rotation; the only non-user
  motion is the highlight ease. Reduced motion: static frame, no
  controls, as before. Lane labels are measured and right-edge
  anchored inside a scene frame shifted by the widest label — S7
  (left-edge clipping) fixed; verified in screenshots. The canvas
  publishes `data-edge-count`, `data-selected-story` and projected
  `data-node-points` for tests/debugging.
- **Issues page (`src/routes/board_.issues.tsx` → `/board/issues`).**
  noindex, linked only from /board. Live GitHub issues + PRs grouped by
  story: a PR maps by the snapshot's `prs` membership (the board's own
  rule, unchanged); an issue maps only when a story explicitly names it
  (`explicitIssueNumbers` — today only "Open issues 344 and 319");
  everything else is an explicit Unmapped group. Issues come from the
  issues endpoint with PR-shaped items filtered out (`pull_request`
  key); PRs reuse `fetchLivePrs`. `fetchLiveIssues` mirrors the overlay
  pattern (ETag, 10-minute cache, one attempt, stale/snapshot fallback)
  under its own cache key.
- **B1 cure (`scripts/static-wellknown.test.mjs`).** The sitemap test
  now scans page routes recursively (dots and slashes as separators,
  pathless `_` segments handled), excludes an explicit `NOINDEX_ROUTES`
  list (`/board`, `/board/issues`), asserts each excluded route's
  source declares `noindex`, and asserts excluded routes are NOT in the
  sitemap — a public route missing from the sitemap still fails. (Both
  pages are deliberately noindex; listing them in a sitemap would
  contradict the noindex.)
- **S6 copy.** snapshot.json: `next[1]` and the done-path gate now say
  PR 434 merged Nov 13; story "Math subject screen" `waitsOn` now
  "Shipped Nov 13" (statuses still derive live from PR state).
- **Gates (this tip).** `npx tsc --noEmit` clean; `npm test` green —
  scripts 1192 tests / 0 fail (was 1 fail = B1), src 2472/2472
  (includes 9 new board-data tests: edges, depths, layout, issue
  parsing/mapping, issues fetch); `test:worker` 235/235;
  `lint-cards` GATE PASSED; `lint:content` GATE PASSED (0 new);
  `build:pages` green; entry JS gzip 325,182 B — +374 B over the
  review's locally measured base of 324,808 B (the 323,865 B budget
  overage is pre-existing; CI passed the size check on the prior tip);
  board Playwright spec 7/7 on the built artifact (3 original + drag
  changes the view, click highlights the chain, /board/issues groups
  incl. Unmapped with the network mocked, reduced motion lands on the
  list view). Screenshots are in the PR record (chain highlighted,
  390px map, issues page both sizes).
- **Not checked / observed.** A React #418 hydration pageerror (root
  `<html>` attributes) appears in the local harness when the shell is
  fulfilled for /board; it is a shell-harness artifact pattern, not
  board content — worth a glance on the real deploy. E2E ran only the
  board spec locally per the testing-on-a-budget rule; CI carries the
  full suite. The issues page was verified with mocked GitHub payloads,
  not the live API.
- **Next step:** owner's second-agent review of the new tip, then owner
  merge. Still owner's separate calls: the `fix/turnstile-csp` PR
  stacked on this branch's previous head, and the feature-request
  secrets/site-key setup.

## Graph (upgrade additions, for the integrator)

- Adds node: route `/board/issues` (depends-on: snapshot, GitHub issues
  API, GitHub pulls API via the board overlay fetch).
- Adds edges: story → story "waits-on (explicit PR)" ×8, derived from
  snapshot `waitsOn` PR references through `prs` membership — data of
  record is `src/board/snapshot.json`, builder is
  `buildDependencyEdges` in `src/board/board-data.ts`.
