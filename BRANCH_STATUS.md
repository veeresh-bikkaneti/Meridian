# BRANCH_STATUS.md — fix/gis-review-gaps

**Branch:** `fix/gis-review-gaps` off `origin/main` @ `fab222e`
**Worktree:** `~/workspace/meridian-worktrees/gis-gaps`
**Mission:** Implement the two P0 gaps from the GIS Analyst map review (2026-10-05). Game code only. Veeresh merges.

## Scope (from gis-analyst-map-review.md)
- [ ] **P0-1 — Legend lies about color.** Card legend says "gold is the true spot" but the answer mark renders `#8fb8c6` (light blue). Verify against the live render, then make legend and mark agree. Brand Guardian decides; default gold (long-standing legend text).
- [ ] **P0-2 — Bearing on the reveal.** Misses teach magnitude ("457 km off") but not direction. Add bearing ("457 km northeast of your pin"), 8-wind snap, kid-readable copy. UX Researcher/Architect validate the copy. Check whether `initialBearing()` (prescribed for GeoDetective share grammar) exists; reuse or implement cleanly.
- [x] **Ticket-3 — Admin-1 data gap** (scoped ticket, NO implementation this run): delivered as `docs/admin1-gap-ticket.md`. Measured: 1.2 MB / 116 features (AU 9, BR 27, CA 13, CN 31, IN 36), 121 props/feature (119 dead). Gameplay gap = exactly 7 countries (EG/FR/DE/IT/JP/MX/GB); map-context gap is global. Sources sized from published specs (no downloads): NE 50m full 2.22 MB (public domain, coverage unverified — Step 0 for impl crew), NE 10m 38.84 MB, GeoBoundaries gbOpen per-country simplified (7 countries ≈ 9.9 MB raw, mixed per-file licenses incl. ODbL/Etalab), GADM disqualified (no-redistribution license). Joint recommendation: narrow scope (7 countries) as lazy per-country chunks mirroring `loadRegionChunk`; PR #58 fallbacks stay. **Veeresh decision needed:** narrow vs global scope; if global, source (NE 10m→50m vs GeoBoundaries); bundled-data rule check.
- [ ] **Handoff-4 — GeoDetective between-guess shading** belongs to the edition build (Multi-Agent Systems Architect coordinator). Confirm handoff; do not implement here.

## Gates (every code task)
`npx tsc --noEmit` · `npm test` · `node scripts/lint-cards.mjs` (GATE PASSED) · `npm run build:pages` · real-browser E2E on changed reveal paths · review crew (code-reviewer + software-architect + SRE) sign-off with ZERO blockers.

## Rules
- Stage named files only. Push early and often. Never break State/Country/Globe editions — the PR #58 Your-pin lines are regression-tested.
- Learning outcomes first. No labels on the map — ever.
