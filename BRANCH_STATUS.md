# BRANCH_STATUS — perf/performance-tuning

**State: MERGED 2026-10-21 — PR #203, squash `41e1121`, on the
owner's order ("review and merge #203").** The full review panel
voted READY on the mechanically rebased tip `68bcb74` (APPROVE
×2 / APPROVE-WITH-NITS ×10 / BLOCK ×0; DevEx PASS-WITH-NITS;
benchmark PASS — the claimed −64% initial preload transfer was
reproduced by paired builds: 714,972 → 256,913 B brotli,
−64.1%; total bundle +0.012%, no regression). Gates on the voted
tip: tsc clean, unit scripts 790 + src 1,399 green, lint-cards
GATE PASSED, build:pages green; live E2E 48 passed / 1 failed
(the one failure, a PWA update-reload test, fails identically on
unmodified main — pre-existing). Post-deploy probe on the live
Cloudflare host: hashed assets serve the immutable rule and
`/flags.json` serves `max-age=0, must-revalidate` as designed;
the three carved-out mutable files and the HTML serve **no
Cache-Control header at all** (ETag only, so browsers still
revalidate) — the safety property holds (no mutable file is
pinned immutable), but the `must-revalidate` the detach was
expected to restore did not materialize; whether to add explicit
header lines for those paths is the owner's pending call. The
pre-merge "Ready to merge? NO / NEVER MERGE" line further down
is this branch's own record from before the owner's order and is
superseded by this header. This header was cured by the
follow-up branch-status PR; the record below stands.

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

**Base:** `origin/main` @ `33a28fe` at branch creation; rebased onto
`5948f8c` (PRs #198/#201), then **rebased onto `origin/main` @ `f9fa7e4`**
(PR #204) on 2026-10-21 for the panel fix round, and **mechanically
rebased onto `origin/main` @ `25b3b68`** (PR #205) on 2026-10-21 for
the owner's review-and-merge pipeline — BRANCH_STATUS.md was the only
conflict each time (resolved per branch convention); all code replayed
clean. Full gate suite re-run on the final head (below).

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

## Panel fix round (2026-10-21) — independent panel verdict was NOT READY

Panel ran clean-context on submitted head `c87ecc2`; its 3 BLOCKs are
fixed here, exactly as prescribed:

- **Eng BLOCK (F-3 sheet remnant):** the confirm sheet rendered the
  frozen `selected` snapshot, so a pre-load land tap showed "Open
  Water" while the guess recorded under the correct name. Fix:
  LoopScreen derives the PlaceSheet entry via
  `unlabeledSpotEntry(selected.lon, selected.lat)` for `tap:` ids at
  render — sheet and submit now always agree. The F-3 source-pin test
  is extended to the sheet path (territory-lazy-boundary.test.ts).
- **Design BLOCK (loading fallback):** `<BootSplash />` (bottom-anchored,
  no status role) replaced as the Suspense fallback at both lazy sites
  by `SessionLoadingFallback` — cloned from MapLoadingFallback,
  top-anchored in the destination shell, destination-named text
  ("Loading GeoDetective…" / "Loading Cold Trail…"), `role="status"`,
  `.meridian-spinner`. BootSplash remains ONLY at the boot `!ready`
  gate (source-pinned). Arrival focus: LoopScreen's heading and
  TrailScreen's case heading take focus on mount.
- **Design BLOCK (Trail recovery asymmetry):** `coldTrailOpen` is now
  persisted (`meridian.coldtrail.open`, read/writeColdTrailOpen in
  coldtrail/store.ts, mirroring the loop flag) — the error boundary's
  reload-retry now restores a Trail player to the Trail screen, like
  GeoDetective, instead of home. Wired at open, leave, and the boot
  reset path; unit tests cover round-trip + fail-silent storage.
- **Product BLOCK (PR body):** corrected in the PR body — the false
  "Zero conflicts" claim restated against the rebased pushed head;
  F1's host scope stated plainly (dual-hosted; `_headers` inert on
  GitHub Pages, effective on the Cloudflare host pending the probe);
  spec cited as a workspace doc; GameApp-split follow-up noted; the
  post-deploy header probe recorded as a HARD acceptance gate.

QA nits disposition:
- Headline metric relabeled "initial preload transfer (JS+CSS)" in the
  PR body. DONE.
- Executed failure test for the territory import: DONE —
  `territory-failure.test.ts` exercises fail-closed + never-rejects +
  retry-eviction + recovery end-to-end via the new
  `territoryImporterForTests` seam (the never-rejects test in
  territory.test.ts now points at it).
- FOLLOW-UP: throttled Loop/Trail cold-click timing (tap-to-play
  regression currently unmeasured).
- FOLLOW-UP: the territory load has no timeout — a stalled import
  hangs openRun/restore fail-closed but indefinitely.
- FOLLOW-UP: GameApp monolith split ("Cut 2", ~55 KB brotli toward
  the ≤200 KB direction) — tracked as the spec's Phase 2 follow-up.

Gates on the final head of this round (`c7d37a7`, pushed — a
mid-round head; the panel later voted on `68bcb74`, the same
branch mechanically rebased onto main `25b3b68`, and re-ran the
suite there with identical counts: src 1,399 / scripts 790; the
tree difference between the two heads is this file only. The
Status section's earlier set — src 1,392 / scripts 799 — was the
post-rebase builder round on an earlier head; both sets are kept
as round history): tsc clean;
`npm test` — src 1,399 pass / 0 fail, scripts 790 pass / 0 fail (one
mid-round failure set, 3 tests, traced to the new arrival-focus effect
under react-test-renderer and fixed with a typeof guard — see commit
`c7d37a7`); lint-cards GATE PASSED; build:pages green; E2E (built
artifact, flock, workers=1): hint-button 11, geodetective 18,
geodetective-unlabeled-tap 2, geodetective-hint 5 — 36 passed, 0 failed.

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
