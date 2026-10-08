# BRANCH_STATUS.md — feat/scout-map

Owner: Dinesh · Branch: `feat/scout-map` · Base: origin/main @ f07dad3 · Created: 2026-10-08
Feature: Meridian "Scout Map" lite map mode (PBIs 1–10 from ~/workspace/your_files/meridian-scout-map-pbis.md).
Standing rules: PRs only, owner merges; named-file staging only; gates before handover (tsc, npm test, lint-cards, build:pages, Playwright).

## Done
- Branch created off origin/main @ f07dad3.
- PBI-1: `src/map/capability.ts` — qualification module (order: manual toggle >
  map-attributed prior-crash flag > WebGL probe > deviceMemory; 7-day decay on
  auto assignments; SSR/test-safe; no UA read). Gates: tsc clean, npm test
  green (fail 0), logic smoke-checked in node.
- PBI-2: mode threaded through `src/map/map-options.ts` → `satellite-map.tsx`
  (`mapMode` prop, fail-closed to "full"; scout → DPR cap 1 via
  SCOUT_PIXEL_RATIO_CAP, maxZoom 3 flat / 2 globe; mapModeRef for PBI-5).
  Full-mode path byte-identical. Gates: tsc clean, npm test 852/852 green.
- PBI-3: scout outline renderer — new `src/map/scout-style.ts` (label-free,
  tile-free style from shared atlas-data.ts geometry: land fill + coast +
  borders, NO geometry fork, ZERO labels); satellite-map mounts it in scout
  mode, skips tile lifecycle (starts "ready"), starfield, motion
  (ZoomSpaceController forced reduced-motion); CelebrationOverlay gains
  motionOff (confetti off in scout). Full-mode path byte-identical.
  Gates: tsc clean, lint-cards GATE PASSED, build:pages green.
- PBI-4: static fallback — `scripts/gen-scout-fallback.mjs` generates
  `public/scout-fallback.svg` (18.5 kB ≤ 100 kB, coast mesh, no labels,
  preserveAspectRatio="none"); new `src/map/scout-fallback.tsx` (exact
  equirectangular tap→lon/lat mapping, keyboard crosshair, marks/spot);
  satellite-map drops to it when scout outline construction/render fails;
  reveal completes immediately so scoring/rounds proceed.
  Gates: tsc clean, lint-cards GATE PASSED, build:pages green.
- QA handover: `src/map/capability.test.ts` added to the `npm test` script
  (22/22 pass); capability.ts documents the settled semantics — Q1 (offer on
  source==="prior-crash" only, enforced by the PBI-6 boot modal), Q2 (record
  stores source+setAt; stale auto records decay to null; re-demotion needs a
  fresh qualifying event), Q3 (writeStoredMapMode only on new qualifying
  event/state change; resolveMapMode never writes).
- PBI-5: webglcontextlost → state-preserving scout switch + deferred note.
  satellite-map: `onWebglContextLost(view)` prop (viewport handoff, full-mode
  mounts only — repeat-storm guard) + `initialView` prop (re-opens mid-SPACE
  like the tile-Retry restore). GameApp owns mapMode (threaded Play →
  PlayLoaded → SatelliteMap; remount via nonce-key, never mid-round);
  switch writes meridian:map-mode=scout/"contextlost" (Q3). Deferred note:
  GameApp-level sibling of ResultCard, fixed inset-x-4 top-16 z-50,
  role="status", verbatim copy, keyed to switch event + place id, clears on
  Continue/dismiss — never mid-round.
- PBI-8: observability — `mapMode` stamped on every observability event via
  setReportMapMode (GameApp applies it on every assignment); `tileErrors`
  on the crash breadcrumb (satellite-map syncs the tile-status count;
  suggestive only, never a switch signal) → suspected_crash carries both.
  flags.json has NO generator (hand-maintained static file) — a static
  mapMode value would be misinformation, so mapMode observability lives in
  the crash reports. Watchdog boot_failure NOT stamped: the inline script
  has a hard 5120-byte budget with 12 bytes of headroom (pre-PBI-8: 5108),
  and boot_failure fires when the app never boots — the map never mounted,
  so the mode isn't attributive for that failure class.

## Pending (sequenced)
- [ ] Phase A: Game Designer + UI/UX Expert finalize UX copy + settings placement.
- [ ] PBI-1 capability.ts (probe + order + decay + unit tests).
- [ ] PBI-2 thread mode through map-options.ts → satellite-map.tsx (full mode byte-identical).
- [ ] PBI-3 scout outline renderer, label-free (reuse globe-mesh.ts / atlas-data.ts).
- [ ] PBI-4 static fallback asset (≤100 kB, pin-drop mapping).
- [ ] PBI-5 webglcontextlost → state-preserving switch + deferred note.
- [ ] PBI-6 map-attributed prior-crash boot offer.
- [ ] PBI-7 settings toggle UI.
- [ ] PBI-8 observability: mapMode in flags.json + crash reports + tile_failed counts.
- [ ] PBI-9 E2E regression (SwiftShader/6x throttle + false-demotion golden).
- [ ] PBI-10 PR opened, never merged.

## Notes
- Review finding vs current main: tile_failed counts do NOT flow into crash reports — folded into PBI-8.
- Spec correction made (2026-10-08): DPR premise corrected — touch devices already capped at 1.5 in map-options.ts.

## QA (Software Tester — updated 2026-10-08)
- Gates (branch @ f07dad3 + QA commits, pre-scout-code): `npx tsc --noEmit` ✅ ·
  `npm test` ✅ (exit 0, 0 failures) · `node scripts/lint-cards.mjs` ✅ GATE PASSED ·
  `npm run build:pages` ✅ (EXIT:0, dist ready).
- Unit: `src/map/capability.test.ts` — 22/22 ✅, committed + pushed. Written
  against the dev's landed API (`MAP_MODE_STORAGE_KEY`, `{mode, source, setAt}`,
  `qualifyMapMode`/`readStoredMapMode`/`probeWebGL`/`resolveMapMode`). Covers:
  order precedence, decay (stale auto → null, manual never decays), SSR-safety,
  SwiftShader/llvmpipe probe patterns, fail-closed goldens, no-UA source scan.
  ⚠️ NOT yet in `npm test`: needs `src/map/capability.test.ts` added to the
  package.json `test` script (coordinator/dev — QA may not edit package.json).
- E2E (6 spec files, 24 tests, desktop project; all vs built artifact via
  serveBuiltArtifact, serialized with `flock ~/workspace/.e2e.lock --workers=1`):
  - `scout-false-demotion` P0 GOLDEN: 3/3 ✅ on current build (cold boot,
    crash-resume-to-menu, idle-kill return — capable spoof: NVIDIA renderer,
    deviceMemory 8, DPR 2; tiles requested; no offer). Fixed 1 QA bug: the
    ?idle-ms seam killed the return run — now dropped before the return run.
  - `scout-offer` fail-closed tests: 2/2 ✅ (no modal on clean boot, manual
    override suppresses).
  - Remaining 19 tests EXPECTED-RED until the dev lands PBI-5/6/7 (offer modal,
    toggle, switch note, data-map-mode wiring). They fail only on the missing
    feature, not on harness issues (verified listing: 24 tests parse).
- Dev contracts needed for the E2E to pass: `data-map-mode` + `data-max-zoom`
  on `.satellite-map` (follow the data-zoom pattern); `meridian:map-mode`
  record shape `{mode, source, setAt}`; offer accept-button label (accept-path
  test pending the label); note shows whenever the ResultCard is up
  (story AND done), hidden in aim.
- Open semantics for the coordinator (in capability.test.ts header):
  Q1 — prior-crash → scout at the qualify layer; the APP must show the offer
  modal when source === "prior-crash" (spec: offer, not force).
  Q2 — fresh auto record re-demotes without a fresh signal (7-day hysteresis)
  vs spec's "never demoted twice in a row without a fresh qualifying event".
  Q3 — decay only fires if the app does NOT rewrite the auto record every
  boot; confirm the write policy.
- P0 false-demotion status: no false demotion possible yet (scout code still
  landing); unit + E2E goldens in place and green where runnable.
- Reproduce:
  `flock ~/workspace/.e2e.lock npx playwright test --workers=1 --project=desktop <spec>`
  per spec file; unit: `node --experimental-strip-types --test src/map/capability.test.ts`.
