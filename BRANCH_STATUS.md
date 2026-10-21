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

**Base:** `origin/main` @ `33a28fe` at branch creation; **rebased onto
`origin/main` @ `5948f8c`** (PRs #198/#201) on 2026-10-21 — 0 behind,
0 conflicts after the rebase (BRANCH_STATUS.md resolved per branch
convention). Full gate suite re-run post-rebase (below).

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
- [x] QA baseline measurements (built artifact, pre-change) —
      `baseline.md` in ~/workspace/your_files/meridian-perf-tuning/
- [x] F1 implemented + header evidence — `public/_headers`; carve-outs
      for the 3 stable-named mutable files use Cloudflare's documented
      `! Cache-Control` detach (ALL matching rules apply and duplicate
      values comma-join — no most-specific-wins). Evidence:
      `f1-headers-evidence.txt` (incl. POST-DEPLOY ACCEPTANCE check).
- [x] F2 implemented — Loop/Trail behind `React.lazy` (MapLibre out of
      the initial bundle); F2b deferred countries-50m TopoJSON behind a
      cached dynamic import; F6 routes CSS split with it.
- [x] Core Engineering diff review — round 1 BLOCK (3 real regressions:
      F1 carve scope, restore/replay territory preload, frozen tap
      names) → all fixed; re-review accepted the fixes; F-1 detach
      prescription applied verbatim.
- [x] Gates POST-REBASE (2026-10-21): tsc clean; `npm test` — src
      1,392 pass / 0 fail, scripts 799 tests / 0 fail; lint-cards GATE
      PASSED; build:pages green.
- [x] E2E POST-REBASE (built artifact, flock, workers=1): hint-button
      11 passed; geodetective 18 passed; geodetective-unlabeled-tap 2
      passed; geodetective-hint 7 passed.
- [x] Rebase to zero conflicts + full retest (above).
- [x] Screenshots (home + game start, before/after, 1280 + 390) in
      ~/workspace/your_files/meridian-perf-tuning/screens-{before,after}/
      — visually identical, no layout change.
- [x] **PR OPENED 2026-10-21:** https://github.com/veeresh-bikkaneti/Meridian/pull/203
      (owner pasted a fresh PAT; pushed + opened by the parent agent).
- **Ready to merge? NO** (owner review → live curl check of carved
  paths post-deploy → Chitti → his merge call). NEVER MERGE.

## Measured results (built artifact, same method both sides)

| Initial preloads (from `_shell.html`) | Before (main 5948f8c) | After (this branch) |
|---|---|---|
| JS | 4 files · 2,785,216 B raw · **686,731 B brotli** | 6 files · 884,428 B raw · **235,051 B brotli** |
| CSS | 198,762 B raw · 28,498 B brotli | 115,801 B raw · 20,248 B brotli |
| **Total initial transfer** | **715,229 B brotli** | **255,299 B brotli (−64%)** |

Honest remainder: ~55 KB brotli above the ≤200 KB direction — the
GameApp monolith "Cut 2" + index chunk, deferred per the spec's own
sequencing (spec Phase 2) to a follow-up branch.

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
