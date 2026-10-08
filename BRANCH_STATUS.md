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
- Gates baseline (branch @ f07dad3, before scout code lands): `npx tsc --noEmit` ✅ ·
  `npm test` ✅ (exit 0) · `node scripts/lint-cards.mjs` ✅ GATE PASSED ·
  `npm run build:pages` ⏳ running.
- Test files added (PBI-9 + Phase A contracts):
  - `tests/e2e/scout-helpers.ts` — shared contracts (testids, storage record,
    capable-device spoof, tile counter).
  - `tests/e2e/scout-offer.desktop.spec.ts` — boot offer modal: once-per-boot,
    Esc/"Not now"/scrim decline, focus trap, decline retires flag, fail-closed
    clean boot, manual-override suppression (PBI-6).
  - `tests/e2e/scout-toggle.desktop.spec.ts` — toggle in Play top bar (not in
    .satellite-map), localStorage round-trip, next-place-mount effect, no
    mid-round remount, manual beats probe (PBI-7).
  - `tests/e2e/scout-switch-note.desktop.spec.ts` — role="status" note: hidden
    in aim / shown at card reveal, ResultCard sibling, fixed inset-x-4 top-16,
    bubble non-overlap, 360px width, mode persisted (PBI-5).
  - `tests/e2e/scout-throttled.desktop.spec.ts` — SwiftShader (native on this
    VM) + 6x CPU throttle → scout qualifies, game completes (PBI-9a).
  - `tests/e2e/scout-false-demotion.desktop.spec.ts` — P0 GOLDEN: spoofed
    capable device (NVIDIA renderer, deviceMemory 8, DPR 2) never demotes on
    cold boot / crash-resume-to-menu / idle-kill return; satellite tiles
    requested; maxZoom stays 8 (PBI-9b).
  - `tests/e2e/scout-context-lost.desktop.spec.ts` — webglcontextlost mid-round:
    state preserved byte-identical, no reload, storm → single mount,
    meridian:map-mode persisted (PBI-5/9c).
- `src/map/capability.test.ts` (33 unit tests: order precedence, decay,
  SSR-safety, no-UA-read, P0 false-demotion goldens) drafted against the QA→dev
  contract in its header; HELD in /tmp (not committed) until the dev lands
  `src/map/capability.ts` — committing now would break tsc. Needs registering
  in package.json `test` script (coordinator/dev).
- Contracts the dev must implement for the E2E to pass: `data-map-mode` +
  `data-max-zoom` on `.satellite-map`; `meridian:map-mode` JSON record shape
  (see scout-helpers.ts); accept-button label for the offer (accept-path test
  pending). Note-shows-on-card rule: story AND done phases (ResultCard up),
  hidden in aim.
- P0 false-demotion status: unit goldens drafted (held); E2E golden written,
  runs once PBI-1..3 land. No false demotion possible yet (no scout code).
- E2E run commands (serialized VM-wide, --workers=1):
  `flock ~/workspace/.e2e.lock npx playwright test --workers=1 --project=desktop <spec>`
  per spec file; all run against the built artifact via serveBuiltArtifact
  (127.0.0.1:4123/Meridian/).
