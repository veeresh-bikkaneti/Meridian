# feat/feature-flags — status

Zero-cost, dependency-free feature flag system for Meridian.
Veeresh's intent: experimental tracks merge behind flags, dark in prod until proven.

## Done
- [x] Worktree `~/workspace/meridian-worktrees/feature-flags`, branch `feat/feature-flags` from `origin/main` (3c32085) — replaced stale crash-investigation BRANCH_STATUS.md inherited by the worktree
- [x] node_modules symlinked; AGENTS.md read

## Pending
- [ ] `src/lib/flags.ts` — typed flag definitions, baked-in defaults (= current prod behavior), `isEnabled()`, `loadFlags()` (network-first, ~1.5s timeout, parallel with boot, never blocks first paint, silent fallback to defaults)
- [ ] `public/flags.json` — remote overrides, versioned in repo
- [ ] Boot wiring — `loadFlags()` early in boot; flag checks run BEFORE gated systems initialize
- [ ] First consumer: gate the PWA update flow (`pwaUpdateToast`, default true) as the kill-switch proof
- [ ] `public/sw.js` — `flags.json` served network-first (never stale-cache a kill decision) + tests
- [ ] `flags.test.ts` — defaults, override merge, timeout/offline fallback
- [ ] Adopter docs (`docs/feature-flags.md`) — the pattern other crews follow
- [ ] Gates: tsc, full unit suite, card gate, `build:pages`, E2E (flag on/off flips surface; offline boot → defaults)
- [ ] Technical-architect review + tone/docs review
- [ ] PR → merge → live verification

## Out of scope (by design)
- Do NOT touch the difficulty crew's picker files (separate branch, mid-build). This track ships the system + adoption pattern; the parent directs adoption after landing.
