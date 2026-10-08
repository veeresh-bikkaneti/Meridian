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
