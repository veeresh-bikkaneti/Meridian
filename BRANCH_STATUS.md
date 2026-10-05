# BRANCH_STATUS.md — fix/reveal-your-pin-country-globe

**Branch:** `fix/reveal-your-pin-country-globe` off `origin/main` @ `650065e`
**Bug (fallback fix, not a feature):** Wrong-answer reveal card silently dropped the "Your pin" line in country/globe editions when vendored admin-1 data was missing. Veeresh's live-play diagnostic (2026-10-04) confirmed the root cause precisely: `src/map/data/ne-50m-admin-1.json` carries admin-1 features for exactly AU/BR/CA/CN/IN (36 for IN) and ZERO for IT/FR — US comes from us-atlas. India works because its 36 vendored features let the classic `pinCompareLine` name both states; Italy/France fall through to the bare "Right country, wrong town!" with no named Your-pin location.
**Fix shape:** nearest-place-in-pool fallback with honest "near <city>" qualification, layered over the untouched classic `pinCompareLine` (which stays the fail-closed fallback). Per the design doc contract.
**Root cause:** `pinCompareLine()` returns "Right country, wrong town!" with no Your-pin line when admin-1 data is unavailable for the country. Confirmed by data audit (see above).

## Done
- [x] Fresh worktree at `~/workspace/meridian-worktrees/reveal-your-pin`, branch created off origin/main
- [x] Recon: PR #50 implementation mapped (`reverse-geocode.ts`, `result-card.tsx` pin-compare wiring)
- [x] Design crew spawned (software-architect persona) — resolution strategy + API design
- [x] Design doc: `docs/reveal-your-pin-design.md` — committed (design contract)
- [x] Implementation per design:
  - `src/game/reverse-geocode.ts` (ADD ONLY — `pinCompareLine`/`resolvePin` untouched): `NEAREST_PLACE_MAX_KM = 100`, `PoolPlace`/`NearestPoolPlace`/`PlayerPinDetail` types, `nearestPoolPlace()` (haversine scan, same-territory numeric-key gate, 100 km cap, fail-closed), `RevealPinLineInput`/`revealPinLine()` (state → classic byte-identical; country/globe → "near <city>, <state>" detail with country suffixes; gate failure → classic)
  - `src/components/game-app.tsx`: passes `poolPlaces={places}` (full dealing pool, not banded) to ResultCard
  - `src/components/result-card.tsx`: optional `poolPlaces?: Starter[]` prop; pinLine memo now calls `revealPinLine()`; miss-only rendering unchanged
- [x] India regression lock (Veeresh's working reference): Mumbai/Bengaluru-verified test asserts both locations named, never dropped — detail supersedes classic there ("Your pin: near Mumbai, Maharashtra · True spot: Bengaluru, Karnataka"); classic reference path independently asserted ("Your pin: Maharashtra · True spot: Karnataka")
- [x] Gates (all four, BUILD crew ran them 2026-10-04): `npx tsc --noEmit` clean · `npm test` 584/584 green (36 suites) · `node scripts/lint-cards.mjs` → GATE PASSED · `npm run build:pages` green
- [x] Pushed to origin (commit c705e7d)

## In progress
- [ ] E2E: pin-compare line in country AND globe editions; state unchanged (standing Meridian E2E gate — design §4.3: `tests/e2e/reveal-pin-compare.desktop.spec.ts`, `EXPECTED_BAHIA_LINE` preserved by the classic fallback)

## Pending
- [ ] Technical-architect review (APPROVE, no blockers) + tone/docs review (APPROVE)
- [ ] Open PR (no merge — Veeresh merges)

## Notes
- Game code only. Nothing touches GeoDetective content or the clue pipeline.
- Honesty rule: the "near" qualifier is unconditional, even at distance ≈ 0 (no fabrication, card rule 5).
- Deviation from design doc §5.2 (measured data, documented in tests): world-atlas 50m places Chiasso inside Italy (key "380"), so the territory-gate test uses Mendrisio, CH ("756", 48.1 km from the Milan pin) instead.
- `pinCompareLine`/`resolvePin` and their four copy variants: zero changes — state-edition output byte-identical, locked by test.
- New dependencies: none. New JSON vendored: none. No module-top-level data parsing (Safari jetsam rule holds).
- Perf: O(n) haversine scan per reveal inside `useMemo` (measured ≤ 11.4 ms @ 59.4k on node; budget ≤ 50 ms); zero memory delta (reuses the `places` array already in state).
- Open questions for Veeresh live in the design doc §9 ("near" wording, 100 km budget, globe pins in the 13 chunk-countries).
