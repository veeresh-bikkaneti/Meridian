# BRANCH_STATUS — perf/performance-tuning

**Mission (owner: Veeresh; ordered 2026-10-21):** build the performance
tuning fixes from `~/workspace/your_files/meridian-performance-spec.md`
as ONE cohesive change set on ONE branch, built by an orchestrated
scrum team. This branch covers the two findings that need no new owner
decision:

- **F1 — Immutable caching:** `/assets/*` (content-hashed) must serve
  `Cache-Control: public, max-age=31536000, immutable`; HTML and
  `/flags.json` stay short-cache. SW cache-version logic untouched.
- **F2 (+F6) — Split the initial bundle:** home must not modulepreload
  the ~2.36 MB game chunk (691 KB brotli) or the 130 KB routes CSS.
  Game chunk loads on play intent / prefetch-on-intent. Budget: home
  initial JS transfer from ~833 KB toward ≤200 KB; tap-to-play must
  not visibly regress.

**Base:** `origin/main` @ `25b3b68` (PR #205 header docs; branch
mechanically rebased onto it 2026-10-21 for the review pipeline —
only conflict was this file's header, resolved per branch convention).

**Out of scope (do not start):** F3 analytics (owner decision pending),
F4/F5 data pipeline, F7 fonts, F9 rendering.

## Team (orchestrated squads, shared branch)

- Game & Narrative — regression watch on gameplay/narration surfaces
- UX/UI & Frontend — F2 split + F6 CSS split
- Core Engineering — architecture + diff review of every squad change
- QA & Performance — before/after measurements from the BUILT artifact
- SecOps & DevOps — F1 serving layer (headers), no-merge discipline

## Status

- [x] Branch created off origin/main; recon complete (see below)
- [ ] QA baseline measurements (built artifact, pre-change)
- [ ] F1 implemented + header evidence (curl -I on served build)
- [ ] F2 mechanism pinned with evidence; split implemented
- [ ] Core Engineering diff review
- [ ] Gates: tsc / npm test / lint-cards / build:pages / E2E
- [ ] Rebase to zero conflicts + full retest
- [ ] Screenshots (home + game start, before/after) in
      ~/workspace/your_files/meridian-perf-tuning/
- [ ] PR opened — **Ready to merge? NO** (owner review → Chitti → his
      merge call). NEVER MERGE.

## Recon notes (2026-10-21, orchestrator)

- Single route `/` → `GameApp` (`ssr: false`, BootSplash pending).
  SatelliteMap, HomeGlobe, StorytellerHomeHost, AgeProfileSettings are
  already `React.lazy` — yet the live home document modulepreloads the
  2.36 MB routes chunk with maplibre strings in it. F2 must pin the
  mechanism with build evidence (static import path? router preload of
  lazy chunks? chunk merging? bulk is data/UI?) before cutting.
- `.vercel/output/config.json` (build artifact, untracked) already
  emits the immutable rule for `/assets/(.*)` — the Vercel-preset
  routing has it; the live Cloudflare deployment does not emit it.
  Live asset probe: `CF-Cache-Status: HIT`, `Cache-Control: public,
  max-age=0, must-revalidate`, `Server: cloudflare`.
- Candidate F1 layers: `public/_headers` (Cloudflare Pages / Workers
  Static Assets convention; build copies public/ → dist/client) or
  Nitro routeRules. The squad must prove which layer the production
  build honors. Immutable scope is `/assets/*` ONLY — `/audio/*`,
  `/icons/*`, `/flags.json` have stable names and mutable content
  (narration mp3s were replaced in PR #174) and must never go immutable.
