# BRANCH_STATUS.md — fix/reveal-your-pin-country-globe

**Branch:** `fix/reveal-your-pin-country-globe` off `origin/main` @ `650065e`
**Bug:** Wrong-answer reveal card names only the true spot in country/globe editions — the "Your pin" line (PR #50) only fires in the state edition. Live-confirmed by Veeresh's screenshots 2026-10-04 (Italy: pin in Sardinia, card never says so).
**Suspected root cause:** `pinCompareLine()` returns "Right country, wrong town!" with no Your-pin line when admin-1 data is unavailable for the country (vendored admin-1 covers US + AU/BR/CA/CN/IN only). Design crew verifying.

## Done
- [x] Fresh worktree at `~/workspace/meridian-worktrees/reveal-your-pin`, branch created off origin/main
- [x] Recon: PR #50 implementation mapped (`reverse-geocode.ts`, `result-card.tsx` pin-compare wiring)
- [x] Design crew spawned (software-architect persona) — resolution strategy + API design

## In progress
- [ ] Design doc: `docs/reveal-your-pin-design.md` (what's in memory per edition, nearest-place vs boundaries, API, edge cases, perf budget)

## Pending
- [ ] Implement per design (country: "Your pin: <city>, <state>"; globe: "Your pin: <city>, <state>, <country>")
- [ ] State-edition regression check ("Your pin: <state>" unchanged)
- [ ] Gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`
- [ ] Technical-architect review (APPROVE, no blockers) + tone/docs review (APPROVE)
- [ ] E2E: pin-compare line in country AND globe editions; state unchanged
- [ ] Open PR (no merge — Veeresh merges)

## Notes
- Game code only. Nothing touches GeoDetective content or the clue pipeline.
- Honesty rule: nearest-match resolution must be qualified ("near <city>"), never presented as the exact pick.
