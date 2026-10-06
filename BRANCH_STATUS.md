# BRANCH_STATUS.md — fix/review-deck-framing

**Branch:** `fix/review-deck-framing` off `origin/main` @ `a838fc6`
**Task:** Fix the live misses-review bug (Veeresh's report): the review map
doesn't reframe per card — a Nebraska state card renders over a stuck globe
showing Africa. The map must reframe per card (flat editions zoom to the
card's region bounds; globe cards stay globe), and the reveal must show the
pin-vs-true-spot mapping exactly like normal play.

## Done
- [x] Branch created off origin/main
- [x] Repro/regression spec: tests/e2e/review-framing.desktop.spec.ts
- [x] Production build for E2E (build:pages)
- [x] Root cause identified + fix implemented
- [x] tsc clean, unit tests 716/716 green

## Root cause
On review card advance, the SatelliteMap mount effect re-ran (bounds identity
change) and tore down/recreated the MapLibre instance — but the narrow beat
to the new card's region did not reliably complete, leaving the fresh map
stuck at its [0,0]/zoom-1 intro globe (Africa). The question bubble proved the
React props were correct (STATE · NEBRASKA) — the failure was inside the
in-place effect remount path.

## Fix
`src/components/game-app.tsx`: key the SatelliteMap by review card
(`review:${place.id}:${mapKey}` in review mode). Each card now gets a full
React remount through the proven fresh-mount narrow path — the same
established pattern as the replay remount. Normal play is untouched
(key stays `mapKey` when not reviewing).

## In progress
- [ ] E2E validation (blocked on VM lock held by game-sfx crew)
- [ ] Full E2E suite green
- [ ] Open PR (base: main) — Veeresh merges, I do not
